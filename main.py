"""
SkillForge AI — SINGLE FILE BACKEND (v4.0 — Groq Edition)
Fixed: HuggingFace replaced with Groq API (instant responses, no cold-start timeout)
Run:  uvicorn main:app --reload
"""

import os, re, json, uuid, time, logging, asyncio
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

load_dotenv()

try:
    import bcrypt as _bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

try:
    import jwt as _jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False

# Groq replaces HuggingFace — instant LLM inference, no cold-start delays
try:
    from groq import Groq as _Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
logger = logging.getLogger("skillforge")

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════════════════
SECRET       = os.getenv("JWT_SECRET", "skillforge-secret-key")
ALGO         = "HS256"
GROQ_KEY     = os.getenv("GROQ_API_KEY", "")
USERS_FILE   = "users.json"

# ── Adzuna Real-Time Job API (free — get at developer.adzuna.com) ─────────────
ADZUNA_APP_ID  = os.getenv("ADZUNA_APP_ID",  "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
ADZUNA_BASE    = "https://api.adzuna.com/v1/api/jobs"
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "in")   # "in"=India, "gb"=UK, "us"=USA

# ══════════════════════════════════════════════════════════════════════════════
# APP
# ══════════════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="SkillForge AI API",
    description="AI-Powered Career Intelligence — Groq-Powered Backend",
    version="4.0.0",
    docs_url="/docs",
)

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"])

class _RateLimit(BaseHTTPMiddleware):
    def __init__(self, app, max_req=200, window=60):
        super().__init__(app)
        self.max_req = max_req
        self.window  = window
        self._store  = defaultdict(list)

    async def dispatch(self, req: Request, call_next):
        ip  = req.client.host if req.client else "unknown"
        now = time.time()
        self._store[ip] = [t for t in self._store[ip] if now - t < self.window]
        if len(self._store[ip]) >= self.max_req:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
        self._store[ip].append(now)
        return await call_next(req)

app.add_middleware(_RateLimit)

# ══════════════════════════════════════════════════════════════════════════════
# STORE
# ══════════════════════════════════════════════════════════════════════════════
def _load_db() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE) as f:
        return json.load(f)

def _save_db(data: dict):
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)

def get_by_email(email: str):
    return _load_db().get(email)

def get_by_id(uid: str):
    for u in _load_db().values():
        if u.get("id") == uid:
            return u

def create_user(data: dict) -> dict:
    db = _load_db()
    data["id"]         = str(uuid.uuid4())
    data["created_at"] = datetime.utcnow().isoformat()
    db[data["email"]]  = data
    _save_db(db)
    return data

def update_user(email: str, updates: dict) -> dict:
    db = _load_db()
    if email in db:
        db[email].update(updates)
        _save_db(db)
        return db[email]
    raise HTTPException(404, "User not found")

def safe_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "hashed_pw"}

# ══════════════════════════════════════════════════════════════════════════════
# AUTH HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def hash_pw(pw: str) -> str:
    if HAS_BCRYPT:
        return _bcrypt.hashpw(pw.encode(), _bcrypt.gensalt()).decode()
    import hashlib
    return hashlib.sha256(pw.encode()).hexdigest()

def verify_pw(pw: str, hashed: str) -> bool:
    if HAS_BCRYPT:
        try:
            return _bcrypt.checkpw(pw.encode(), hashed.encode())
        except Exception:
            pass
    import hashlib
    return hashlib.sha256(pw.encode()).hexdigest() == hashed

def make_token(uid: str) -> str:
    payload = {"sub": uid, "exp": datetime.utcnow() + timedelta(hours=24)}
    if HAS_JWT:
        return _jwt.encode(payload, SECRET, algorithm=ALGO)
    import base64
    return base64.b64encode(json.dumps({"sub": uid}).encode()).decode()

def decode_token(token: str) -> Optional[str]:
    """Returns user ID string, or None for local/guest tokens. Never raises."""
    # Local fallback tokens from frontend (when backend was offline during signup)
    if token.startswith("local_"):
        return None  # guest — handled by current_user

    if HAS_JWT:
        try:
            return _jwt.decode(token, SECRET, algorithms=[ALGO])["sub"]
        except Exception:
            return None
    import base64
    try:
        return json.loads(base64.b64decode(token.encode()))["sub"]
    except Exception:
        return None

security = HTTPBearer(auto_error=False)

# Guest user returned when token is local/missing — allows read-only endpoints to work
_GUEST_USER = {
    "id": "guest",
    "email": "guest@skillforge.local",
    "full_name": "Guest",
    "skills": [],
    "target_role": "",
    "user_type": "guest",
    "avatar": "G",
}

def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Returns authenticated user, or guest for local tokens. Raises 401 only if no token at all."""
    if not creds:
        raise HTTPException(401, "Not authenticated")
    uid = decode_token(creds.credentials)
    if uid is None:
        # local_ token or decode failure — return guest so read-only endpoints work
        return _GUEST_USER
    user = get_by_id(uid)
    if not user:
        # Token decoded but user not in DB (e.g. users.json deleted) — return guest
        return _GUEST_USER
    return user

def current_user_strict(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Strict version — requires real JWT. Used for write operations (profile update etc.)."""
    if not creds:
        raise HTTPException(401, "Not authenticated")
    uid = decode_token(creds.credentials)
    if uid is None:
        raise HTTPException(401, "Invalid or expired token. Please log in again.")
    user = get_by_id(uid)
    if not user:
        raise HTTPException(401, "User not found")
    return user

# ══════════════════════════════════════════════════════════════════════════════
# ML HELPERS
# ══════════════════════════════════════════════════════════════════════════════
SKILL_VOCAB = [
    "python","pytorch","tensorflow","keras","scikit-learn","numpy","pandas",
    "matplotlib","jupyter","kubernetes","docker","aws","gcp","azure","sagemaker",
    "fastapi","flask","django","nodejs","react","typescript","javascript","vue",
    "nextjs","html","css","tailwind","redux","graphql","grpc",
    "sql","postgresql","mysql","mongodb","redis","elasticsearch",
    "mlflow","airflow","spark","kafka","hadoop","dbt",
    "git","linux","bash","terraform","ansible","prometheus","grafana",
    "llm","rag","rlhf","transformers","bert","langchain","pinecone",
    "ci/cd","rest api","jwt","rust","golang","java","r","scala","tableau","power bi",
    "machine learning","deep learning","nlp","data science","computer vision",
    "mlops","devops","cloud computing","microservices","system design",
    "communication","leadership","teamwork","agile","scrum",
]

DISPLAY_MAP = {
    "sql":"SQL","html":"HTML","css":"CSS","aws":"AWS","gcp":"GCP","nlp":"NLP",
    "llm":"LLM","rag":"RAG","rlhf":"RLHF","ci/cd":"CI/CD","rest api":"REST API",
    "grpc":"gRPC","jwt":"JWT","mlops":"MLOps","mlflow":"MLflow",
    "scikit-learn":"Scikit-learn","pytorch":"PyTorch","tensorflow":"TensorFlow",
    "fastapi":"FastAPI","nodejs":"Node.js","nextjs":"Next.js","r":"R",
    "machine learning":"Machine Learning","deep learning":"Deep Learning",
    "data science":"Data Science","computer vision":"Computer Vision",
    "cloud computing":"Cloud Computing","system design":"System Design",
    "power bi":"Power BI",
}

def _display(s: str) -> str:
    return DISPLAY_MAP.get(s, s.title())

def extract_skills(text: str) -> dict:
    # Normalise common variants before scanning
    tl = text.lower()
    tl = re.sub(r"scikit[\s\-]learn", "scikit-learn", tl)
    tl = re.sub(r"ci[/\s]cd",          "ci/cd",        tl)
    tl = re.sub(r"rest[\s]api",        "rest api",     tl)
    tl = re.sub(r"node\.js",           "nodejs",       tl)
    tl = re.sub(r"\btf\b",            "tensorflow",   tl)
    tl = re.sub(r"\btorch\b",         "pytorch",      tl)
    tl = re.sub(r"\b(ml|machine-learning)\b", "machine learning", tl)
    tl = re.sub(r"\b(dl|deep-learning)\b",    "deep learning",    tl)
    tl = re.sub(r"\bk8s\b",           "kubernetes",   tl)
    tl = re.sub(r"\bjs\b",            "javascript",   tl)
    tl = re.sub(r"\bts\b",            "typescript",   tl)
    tl = re.sub(r"\bpostgres\b",      "postgresql",   tl)
    tl = re.sub(r"\bsklearn\b",       "scikit-learn", tl)
    tl = re.sub(r"\bpyspark\b",       "spark",        tl)
    tl = re.sub(r"\b(github|gitlab|bitbucket)\b", "git", tl)
    found, seen = [], set()
    for s in SKILL_VOCAB:
        if s in seen: continue
        # Direct match OR alias match
        direct = re.search(r"(?<![a-z])" + re.escape(s) + r"(?![a-z])", tl)
        alias_match = any(
            re.search(r"(?<![a-z])" + re.escape(alias) + r"(?![a-z])", tl)
            for alias in SKILL_ALIASES.get(s, [])
        )
        if direct or alias_match:
            freq = len(re.findall(r"(?<![a-z])" + re.escape(s) + r"(?![a-z])", tl)) + (1 if alias_match else 0)
            cat  = ("soft" if s in ["communication","leadership","teamwork","agile","scrum"]
                    else "domain" if s in ["machine learning","deep learning","nlp","data science","mlops","computer vision","cloud computing","devops","microservices"]
                    else "technical")
            found.append({"name":_display(s),"raw":s,"category":cat,"confidence":round(min(0.99,0.75+freq*0.06),2),"frequency":freq})
            seen.add(s)
    found.sort(key=lambda x: x["frequency"], reverse=True)
    return {
        "all": found,
        "technical": [x for x in found if x["category"]=="technical"],
        "soft":      [x for x in found if x["category"]=="soft"],
        "domain":    [x for x in found if x["category"]=="domain"],
        "total":     len(found),
    }

ROLE_REQUIREMENTS = {
    "ml engineer":        ["Python","PyTorch","TensorFlow","Machine Learning","Deep Learning","Kubernetes","Docker","AWS","MLflow","Airflow","SQL","FastAPI","Git","Linux","Statistics"],
    "data scientist":     ["Python","SQL","Machine Learning","Statistics","Pandas","Scikit-learn","Matplotlib","R","Tableau","Git"],
    "frontend developer": ["React","JavaScript","TypeScript","HTML","CSS","Next.js","Git","Redux","Tailwind","GraphQL"],
    "backend developer":  ["Python","FastAPI","Django","PostgreSQL","Redis","Docker","AWS","REST API","Git","SQL","Linux","Kubernetes"],
    "full stack developer":["React","JavaScript","TypeScript","Python","FastAPI","PostgreSQL","Docker","Git","REST API","HTML","CSS"],
    "devops engineer":    ["Kubernetes","Docker","AWS","Terraform","Linux","CI/CD","Git","Python","Ansible","Prometheus","Grafana","Bash"],
    "data analyst":       ["SQL","Python","Excel","Tableau","Power BI","Statistics","Pandas","Communication"],
    "ai researcher":      ["Python","PyTorch","Mathematics","LLMs","Transformers","RLHF","NLP","Research","Git"],
    "data engineer":      ["Python","SQL","Spark","Kafka","Airflow","dbt","AWS","Docker","PostgreSQL","Git"],
    "cloud engineer":     ["AWS","GCP","Azure","Terraform","Kubernetes","Docker","Linux","CI/CD","Python"],
}

SKILL_CATEGORIES = {
    "programming": ["python","java","javascript","typescript","sql","r","scala","rust","golang"],
    "ml_ai":       ["machine learning","deep learning","nlp","pytorch","tensorflow","llm","rag","transformers"],
    "cloud_infra": ["aws","gcp","azure","kubernetes","docker","terraform","linux","ci/cd"],
    "data":        ["pandas","spark","kafka","airflow","mlflow","postgresql","mongodb","redis","dbt"],
    "frontend":    ["react","nextjs","angular","vue","html","css","tailwind","typescript","graphql"],
    "backend":     ["fastapi","django","flask","nodejs","rest api","grpc","jwt"],
    "soft_skills": ["communication","leadership","teamwork","agile","scrum"],
}

# Aliases — common abbreviations and alternate spellings map to canonical skill names
SKILL_ALIASES = {
    "tensorflow": ["tf","tensor flow","tensorflow2","tf2","keras"],
    "pytorch":    ["torch","pt","pytorch2"],
    "machine learning": ["ml","machine-learning","machinelearning"],
    "deep learning":    ["dl","deep-learning","deeplearning"],
    "kubernetes":       ["k8s","kube","k8"],
    "javascript":       ["js","javascript es6","es6","es2015"],
    "typescript":       ["ts"],
    "python":           ["py","python3","python2"],
    "postgresql":       ["postgres","psql","pg"],
    "mongodb":          ["mongo","mongodb atlas"],
    "fastapi":          ["fast api","fast-api"],
    "scikit-learn":     ["sklearn","scikit learn"],
    "nlp":              ["natural language processing","natural-language-processing"],
    "llm":              ["llms","large language model","large language models","gpt","chatgpt","gemini","claude"],
    "rag":              ["retrieval augmented generation","retrieval-augmented"],
    "transformers":     ["transformer","huggingface","hugging face","hf transformers"],
    "ci/cd":            ["cicd","ci cd","github actions","gitlab ci","jenkins","devops pipeline"],
    "rest api":         ["rest","restful","restful api","api development"],
    "docker":           ["containerization","container","dockerfile"],
    "aws":              ["amazon web services","ec2","s3","lambda","aws cloud","amazon aws"],
    "gcp":              ["google cloud","google cloud platform","gcloud","bigquery","vertex ai"],
    "azure":            ["microsoft azure","azure cloud"],
    "mlflow":           ["ml flow","experiment tracking"],
    "airflow":          ["apache airflow","workflow orchestration"],
    "spark":            ["apache spark","pyspark"],
    "kafka":            ["apache kafka","event streaming"],
    "git":              ["github","gitlab","bitbucket","version control"],
    "linux":            ["unix","ubuntu","centos","debian","bash","shell"],
    "sql":              ["mysql","postgresql","sqlite","database","relational database","rdbms"],
    "react":            ["reactjs","react.js","react js"],
    "nodejs":           ["node.js","node js","express","expressjs"],
    "nextjs":           ["next.js","next js"],
    "graphql":          ["graph ql"],
    "terraform":        ["infrastructure as code","iac","hashicorp"],
    "statistics":       ["statistical","stats","probability","statistical analysis"],
    "communication":    ["communicat","teamwork","collaboration","interpersonal"],
}

def _skill_present(skill_lower: str, text_lower: str) -> bool:
    """Check if a skill is present in text, including aliases and abbreviations."""
    # Direct word-boundary match
    if re.search(r"(?<![a-z])" + re.escape(skill_lower) + r"(?![a-z])", text_lower):
        return True
    # Check all aliases
    for alias in SKILL_ALIASES.get(skill_lower, []):
        if re.search(r"(?<![a-z])" + re.escape(alias) + r"(?![a-z])", text_lower):
            return True
    return False

def calculate_ats(resume_text: str, jd: str = "", role: str = "ml engineer") -> dict:
    rl  = resume_text.lower()
    wc  = len(resume_text.split())
    rk  = role.lower().strip()
    req = ROLE_REQUIREMENTS.get(rk, ROLE_REQUIREMENTS["ml engineer"])
    matched = [s for s in req if _skill_present(s.lower(), rl)]
    missing = [s for s in req if s not in matched]
    skill_match = len(matched)/len(req) if req else 0
    if jd.strip():
        jd_w    = {w for w in re.findall(r"\b[a-z][a-z0-9\+\#\.]{2,}\b", jd.lower()) if len(w)>3}
        semantic = min(1.0, sum(1 for w in jd_w if w in rl)/max(len(jd_w),1))
    else:
        skill_data = extract_skills(resume_text)
        semantic   = min(1.0, skill_data["total"]/15.0)
    cats_covered     = sum(1 for cat_skills in SKILL_CATEGORIES.values() if any(s in rl for s in cat_skills))
    keyword_coverage = cats_covered/len(SKILL_CATEGORIES)
    ats_score        = max(0,min(100,round((0.50*skill_match+0.30*semantic+0.20*keyword_coverage)*100)))
    grade = "Excellent" if ats_score>=85 else "Good" if ats_score>=70 else "Fair" if ats_score>=55 else "Needs Work"
    match_pct = round(skill_match*100)
    suggestions = []
    if missing[:3]: suggestions.append(f"Add these skills: {', '.join(missing[:3])}")
    if not re.search(r"github\.com|github\.io", rl): suggestions.append("Add your GitHub profile URL")
    if not re.search(r"linkedin\.com", rl):          suggestions.append("Add your LinkedIn URL")
    if wc < 300:  suggestions.append("Resume is too short — aim for 400–700 words")
    if wc > 1000: suggestions.append("Resume is too long — trim to under 700 words")
    suggestions += ["Quantify achievements: 'Improved accuracy by 12%'",
                    "Mirror exact keywords from the job description",
                    "Use bullet points, not paragraphs"]
    return {
        "ats_score":ats_score,"grade":grade,"matched_skills":matched,"missing_skills":missing,
        "all_found_skills":[e["name"] for e in extract_skills(resume_text)["all"]],
        "total_required":len(req),"total_matched":len(matched),
        "keyword_density":round(len(matched)/max(wc,1)*100,3),"word_count":wc,
        "suggestions":suggestions[:6],"match_pct":match_pct,
        "format_checks":{
            "has_email":    bool(re.search(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", rl)),
            "has_phone":    bool(re.search(r"\+?[\d\s\-]{10,}", rl)),
            "has_linkedin": bool(re.search(r"linkedin\.com", rl)),
            "has_github":   bool(re.search(r"github\.com", rl)),
            "uses_bullets": bool(re.search(r"[•\-\*]", resume_text)),
            "good_length":  300 <= wc <= 900,
        },
    }

JOBS_DB = [
    {"id":"1","title":"Senior ML Engineer","company":"Google","location":"Bangalore","skills":["Python","PyTorch","Kubernetes","MLflow","AWS","Docker","SQL","FastAPI","Git","Kafka"],"salary_min":45,"salary_max":80,"experience":"3-5 yrs"},
    {"id":"2","title":"AI Engineer","company":"Microsoft","location":"Hyderabad","skills":["Python","PyTorch","LLMs","Transformers","AWS","Docker","Git","SQL","FastAPI"],"salary_min":40,"salary_max":70,"experience":"2-4 yrs"},
    {"id":"3","title":"Data Scientist","company":"Amazon","location":"Remote","skills":["Python","SQL","Machine Learning","Pandas","Scikit-learn","Statistics","Tableau","Git","R"],"salary_min":35,"salary_max":65,"experience":"2-4 yrs"},
    {"id":"4","title":"MLOps Engineer","company":"Flipkart","location":"Bangalore","skills":["Python","Kubernetes","MLflow","Airflow","Docker","AWS","Git","CI/CD","Kafka"],"salary_min":30,"salary_max":55,"experience":"2-5 yrs"},
    {"id":"5","title":"Backend Developer","company":"Razorpay","location":"Bangalore","skills":["Python","FastAPI","PostgreSQL","Redis","Docker","AWS","REST API","Git","SQL"],"salary_min":20,"salary_max":50,"experience":"1-3 yrs"},
    {"id":"6","title":"AI Research Engineer","company":"Sarvam AI","location":"Bangalore","skills":["Python","PyTorch","LLMs","RLHF","Transformers","Fine-tuning","RAG","Git","NLP"],"salary_min":50,"salary_max":100,"experience":"2-4 yrs"},
    {"id":"7","title":"Full Stack Developer","company":"Zepto","location":"Mumbai","skills":["React","TypeScript","Python","FastAPI","PostgreSQL","Docker","Git","REST API","CSS"],"salary_min":18,"salary_max":45,"experience":"1-3 yrs"},
    {"id":"8","title":"DevOps Engineer","company":"CRED","location":"Bangalore","skills":["Kubernetes","Docker","CI/CD","AWS","Terraform","Linux","Python","Bash","Git"],"salary_min":22,"salary_max":55,"experience":"2-4 yrs"},
    {"id":"9","title":"Data Engineer","company":"Swiggy","location":"Bangalore","skills":["Python","Spark","Kafka","Airflow","SQL","AWS","Docker","dbt","Git"],"salary_min":25,"salary_max":55,"experience":"2-4 yrs"},
    {"id":"10","title":"Frontend Developer","company":"Meesho","location":"Bangalore","skills":["React","TypeScript","JavaScript","CSS","HTML","Git","Redux","Testing","GraphQL"],"salary_min":15,"salary_max":40,"experience":"1-3 yrs"},
]

def match_jobs(user_skills: list, target_role: str = "") -> list:
    user_set = {s.lower() for s in user_skills}
    results  = []
    for job in JOBS_DB:
        req     = job["skills"]
        matched = [s for s in req if s.lower() in user_set]
        missing = [s for s in req if s.lower() not in user_set]
        score   = round(len(matched)/len(req)*100)
        results.append({**job, "match_score":score, "matched_skills":matched, "missing":missing[:4]})
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results

# ══════════════════════════════════════════════════════════════════════════════
# ADZUNA REAL-TIME JOB SEARCH
# ══════════════════════════════════════════════════════════════════════════════

# Simple in-memory cache so we don't burn free API calls on every request
# Cache entries expire after 30 minutes
_adzuna_cache: Dict[str, Any] = {}
_cache_ts:     Dict[str, float] = {}
CACHE_TTL = 1800  # 30 minutes — empty results are never cached

def _cache_get(key: str) -> Optional[list]:
    if key in _adzuna_cache and time.time() - _cache_ts.get(key, 0) < CACHE_TTL:
        return _adzuna_cache[key]
    return None

def _cache_set(key: str, value: list):
    _adzuna_cache[key] = value
    _cache_ts[key] = time.time()

# Skill vocabulary for extracting skills from Adzuna job descriptions
ADZUNA_SKILL_VOCAB = [
    "python","pytorch","tensorflow","keras","scikit-learn","numpy","pandas",
    "kubernetes","docker","aws","gcp","azure","fastapi","flask","django",
    "react","typescript","javascript","vue","nextjs","html","css","tailwind",
    "sql","postgresql","mysql","mongodb","redis","elasticsearch",
    "mlflow","airflow","spark","kafka","hadoop","dbt","git","linux","bash",
    "terraform","ansible","llm","rag","rlhf","transformers","bert","langchain",
    "machine learning","deep learning","nlp","data science","computer vision",
    "mlops","devops","microservices","ci/cd","rest api","graphql","rust",
    "golang","java","scala","r","tableau","power bi","system design",
]

def _extract_skills_from_text(text: str) -> list:
    """Extract known skills from raw Adzuna job description text."""
    tl = text.lower()
    tl = re.sub(r"scikit[\s\-]learn", "scikit-learn", tl)
    tl = re.sub(r"ci[/\s]cd",          "ci/cd",        tl)
    tl = re.sub(r"rest[\s]api",        "rest api",     tl)
    tl = re.sub(r"node\.js",           "nodejs",       tl)
    found = []
    for s in ADZUNA_SKILL_VOCAB:
        if re.search(r"(?<![a-z])" + re.escape(s) + r"(?![a-z])", tl):
            display = DISPLAY_MAP.get(s, s.title())
            found.append(display)
    return found[:12]  # cap at 12 skills per job

def _normalise_adzuna_job(raw: dict, idx: int) -> dict:
    """
    Convert an Adzuna API job object into the same schema as JOBS_DB.
    Adzuna response fields: title, company.display_name, location.display_name,
    description, salary_min, salary_max, redirect_url, created
    """
    title       = raw.get("title", "Software Engineer")
    company     = raw.get("company", {}).get("display_name", "Company")
    location    = raw.get("location", {}).get("display_name", "Remote")
    description = raw.get("description", "")
    salary_min  = raw.get("salary_min")
    salary_max  = raw.get("salary_max")
    url         = raw.get("redirect_url", "")
    created     = raw.get("created", "")

    # Convert USD/GBP salary to rough LPA INR equivalent for India jobs
    # Adzuna India salaries are in INR annually
    # Convert annual INR to LPA (divide by 100000)
    if salary_min and salary_min > 100000:
        salary_min_lpa = round(salary_min / 100000, 1)
        salary_max_lpa = round((salary_max or salary_min * 1.4) / 100000, 1)
    elif salary_min:
        salary_min_lpa = round(salary_min, 1)
        salary_max_lpa = round(salary_max or salary_min * 1.4, 1)
    else:
        salary_min_lpa = 0
        salary_max_lpa = 0

    # Extract skills from description
    skills = _extract_skills_from_text(description)
    if not skills:
        skills = ["Python", "Communication", "Problem Solving"]

    return {
        "id":          f"az_{idx}_{raw.get('id','')[:8]}",
        "title":       title,
        "company":     company,
        "location":    location,
        "skills":      skills,
        "salary_min":  salary_min_lpa,
        "salary_max":  salary_max_lpa,
        "experience":  "0-5 yrs",
        "url":         url,
        "source":      "live",        # marks this as a live job
        "posted":      created[:10] if created else "",
        "description_snippet": description[:300].strip() + "..." if len(description) > 300 else description.strip(),
    }

async def fetch_adzuna_jobs(
    query:    str  = "software engineer",
    location: str  = "",
    results:  int  = 20,
) -> Optional[list]:
    """
    Fetch real-time jobs from Adzuna API.
    Returns normalised list or None if API unavailable/not configured.
    """
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return None  # not configured — caller falls back to JOBS_DB

    cache_key = f"{query}|{location}|{results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info(f"Adzuna cache hit for '{query}'")
        return cached

    try:
        import httpx
        params = {
            "app_id":           ADZUNA_APP_ID,
            "app_key":          ADZUNA_APP_KEY,
            "results_per_page": min(results, 50),
            "what":             query,
        }
        if location:
            params["where"] = location

        url = f"{ADZUNA_BASE}/{ADZUNA_COUNTRY}/search/1"
        logger.info(f"Adzuna request → {url} | what={query!r} | where={location or 'all India'}")

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, params=params)

        logger.info(f"Adzuna response → HTTP {r.status_code} | body[:200]: {r.text[:200]}")

        if r.status_code != 200:
            logger.error(f"Adzuna API error {r.status_code}: {r.text[:500]}")
            return None

        data = r.json()
        total_count = data.get("count", 0)
        jobs = data.get("results", [])
        logger.info(f"Adzuna: {total_count} total results, {len(jobs)} in this page")

        normalised = [_normalise_adzuna_job(j, i) for i, j in enumerate(jobs)]

        # Only cache if we got actual results — don't cache empty responses
        if normalised:
            _cache_set(cache_key, normalised)
            logger.info(f"Adzuna cached {len(normalised)} jobs for query='{query}'")
        else:
            logger.warning(f"Adzuna returned 0 results for query='{query}' — not caching")

        return normalised

    except Exception as e:
        logger.error(f"Adzuna fetch EXCEPTION: {type(e).__name__}: {e}")
        return None

def match_live_jobs(jobs: list, user_skills: list) -> list:
    """Score any list of normalised jobs against user skills."""
    user_set = {s.lower() for s in user_skills}
    result = []
    for job in jobs:
        req     = job.get("skills", [])
        if not req:
            result.append({**job, "match_score": 0, "matched_skills": [], "missing": []})
            continue
        matched = [s for s in req if s.lower() in user_set]
        missing = [s for s in req if s.lower() not in user_set]
        score   = round(len(matched) / len(req) * 100)
        result.append({**job, "match_score": score, "matched_skills": matched, "missing": missing[:4]})
    result.sort(key=lambda x: x["match_score"], reverse=True)
    return result

ROLE_SKILLS = {
    "ml engineer":         ["Python","PyTorch","TensorFlow","Kubernetes","AWS","MLflow","Airflow","Docker","SQL","FastAPI","Git","Kafka","Spark"],
    "data scientist":      ["Python","SQL","Statistics","Pandas","Scikit-learn","Matplotlib","Machine Learning","R","Tableau","Git"],
    "frontend developer":  ["React","TypeScript","JavaScript","CSS","HTML","Git","Redux","Testing","GraphQL","Figma"],
    "backend developer":   ["Python","FastAPI","PostgreSQL","Redis","Docker","AWS","REST API","Git","SQL","Linux"],
    "full stack developer":["React","TypeScript","Python","FastAPI","PostgreSQL","Docker","Git","REST API","CSS","Redis"],
    "devops engineer":     ["Kubernetes","Docker","CI/CD","AWS","Terraform","Linux","Python","Bash","Prometheus","Ansible"],
    "data analyst":        ["SQL","Python","Excel","Tableau","Power BI","Statistics","Pandas","Communication","Reporting"],
    "ai researcher":       ["Python","PyTorch","Mathematics","Research","LLMs","Transformers","RLHF","NLP"],
    "cloud engineer":      ["AWS","GCP","Azure","Terraform","Kubernetes","Docker","Networking","Linux","CI/CD","Python"],
}

LEARNING_DB = {
    "Kubernetes":{"difficulty":"Hard","hours":18,"courses":["Linux Foundation CKAD","K8s Fundamentals"]},
    "AWS":{"difficulty":"Medium","hours":14,"courses":["AWS Solutions Architect","AWS ML Specialty"]},
    "MLflow":{"difficulty":"Easy","hours":6,"courses":["MLOps Fundamentals","MLflow Docs"]},
    "Kafka":{"difficulty":"Hard","hours":12,"courses":["Confluent Kafka Course","Event Streaming Design"]},
    "Airflow":{"difficulty":"Medium","hours":8,"courses":["Astronomer Academy","Data Pipelines with Airflow"]},
    "PyTorch":{"difficulty":"Medium","hours":10,"courses":["fast.ai","PyTorch Official Tutorials"]},
    "TensorFlow":{"difficulty":"Medium","hours":10,"courses":["DeepLearning.AI TF","TF Official Docs"]},
    "Docker":{"difficulty":"Easy","hours":6,"courses":["Docker Official Docs","Docker Mastery Udemy"]},
    "Spark":{"difficulty":"Hard","hours":14,"courses":["Databricks Academy","Big Data with PySpark"]},
    "TypeScript":{"difficulty":"Easy","hours":8,"courses":["Total TypeScript","TS Official Handbook"]},
    "React":{"difficulty":"Medium","hours":10,"courses":["React Official Docs","Full Stack Open"]},
    "Terraform":{"difficulty":"Medium","hours":10,"courses":["HashiCorp Learn","Terraform Up & Running"]},
}

SALARY_DB = {
    "ml engineer":         {"fresher":"₹6–15 LPA","mid":"₹15–40 LPA","senior":"₹40–100 LPA"},
    "data scientist":      {"fresher":"₹5–12 LPA","mid":"₹12–35 LPA","senior":"₹35–80 LPA"},
    "frontend developer":  {"fresher":"₹4–10 LPA","mid":"₹10–28 LPA","senior":"₹28–65 LPA"},
    "backend developer":   {"fresher":"₹5–12 LPA","mid":"₹12–32 LPA","senior":"₹32–75 LPA"},
    "devops engineer":     {"fresher":"₹5–14 LPA","mid":"₹14–38 LPA","senior":"₹38–85 LPA"},
    "data analyst":        {"fresher":"₹3–8 LPA", "mid":"₹8–22 LPA","senior":"₹22–50 LPA"},
    "ai researcher":       {"fresher":"₹8–18 LPA","mid":"₹18–50 LPA","senior":"₹50–120 LPA"},
}

def suggest_roles(skills: list) -> list:
    sl = {s.lower() for s in skills}
    scores = {}
    for role, req in ROLE_SKILLS.items():
        match = sum(1 for s in req if s.lower() in sl)
        scores[role] = round(match/len(req)*100)
    return [r.title() for r,_ in sorted(scores.items(), key=lambda x:x[1], reverse=True)][:5]

def generate_learning_path(role: str, missing: list) -> dict:
    n = len(missing)
    return {
        "3_months":  missing[:min(5,n)],
        "6_months":  missing[min(5,n):min(10,n)],
        "12_months": missing[min(10,n):min(15,n)],
    }

def extract_text_from_pdf(content: bytes) -> str:
    try:
        import pdfplumber, io
        text = ""
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t: text += t + "\n"
        if text.strip(): return text
    except Exception:
        pass
    try:
        import PyPDF2, io
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception:
        pass
    return content.decode("utf-8", errors="ignore")

# ══════════════════════════════════════════════════════════════════════════════
# GROQ CHATBOT — replaces HuggingFace
# Groq is the PRIMARY engine — answers EVERY question a student might ask
# llama3-8b-8192 is highly capable. smart_answer is only a true last resort.
# ══════════════════════════════════════════════════════════════════════════════
def groq_answer(message: str, user_skills: list, target_role: str) -> Optional[str]:
    if not HAS_GROQ or not GROQ_KEY:
        return None
    try:
        client = _Groq(api_key=GROQ_KEY)
        skills_str = ", ".join(user_skills[:10]) if user_skills else "not specified"
        system_prompt = (
            "You are SkillForge AI — a highly intelligent, general-purpose AI assistant built for students and professionals. "
            "You have deep knowledge across ALL topics: technology, companies, startups, products, science, mathematics, "
            "history, current events, coding, career advice, interviews, salaries, certifications, universities, "
            "business, finance, general knowledge, and anything else a curious student might ask. "
            "\n\n"
            "RULES YOU MUST FOLLOW:\n"
            "1. Answer EVERY question directly and completely — never refuse, never redirect without answering first.\n"
            "2. For company-specific questions (Google, Microsoft, Razorpay, Zepto, etc.) — give real facts: "
            "founding year, founders, business model, tech stack, hiring process, culture, products, valuation, news.\n"
            "3. For technical questions — give working code, explain clearly, use examples.\n"
            "4. For career/job questions — give specific, actionable advice with real website names and resources.\n"
            "5. For any factual question — answer from your training knowledge confidently.\n"
            "6. Format responses with bullet points and emojis to make them readable.\n"
            "7. Keep responses focused — under 300 words unless a detailed answer is needed.\n"
            "8. NEVER say 'I cannot answer', 'I don't know', or 'outside my expertise' — always give your best answer.\n"
            "\n"
            f"User context (use when relevant): target role = {target_role or 'Student'}, "
            f"current skills = {skills_str}."
        )
        completion = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": message},
            ],
            temperature=0.7,
            max_tokens=800,
        )
        reply = completion.choices[0].message.content.strip()
        logger.info(f"Groq replied ({len(reply)} chars) for: {message[:60]}")
        return reply if len(reply) > 10 else None
    except Exception as e:
        logger.warning(f"Groq API error: {e}")
        return None

def smart_answer(msg: str, skills: list, role: str) -> str:
    """
    Comprehensive fallback covering every topic a student might ask.
    Groq handles the primary answers; this fires only if Groq is unavailable.
    """
    m  = msg.lower()
    r  = role or "Full Stack Developer"
    sk = ", ".join(skills[:8]) if skills else "not set yet"

    # ── Greetings ──────────────────────────────────────────────────────────
    if any(w in m for w in ["hello","hi","hey","hii","helo","sup","good morning","good evening"]):
        return (f"Hey! 👋 I'm your SkillForge AI Career Assistant.\n\n"
                f"I can help you with:\n"
                f"• 🌐 Internship & job websites\n"
                f"• 🎯 Career paths & roadmaps\n"
                f"• 💰 Salary info (₹ LPA)\n"
                f"• 🎤 Interview & DSA prep\n"
                f"• 📄 Resume & ATS tips\n"
                f"• 🏅 Certifications & courses\n"
                f"• 💻 Project ideas & GitHub tips\n"
                f"• 📊 Skill gap analysis\n\n"
                f"What would you like help with today?")

    # ── Internship websites ────────────────────────────────────────────────
    if any(w in m for w in ["intern","internship","where to apply","apply for","stipend","summer intern","winter intern"]):
        return ("🌐 Best internship websites for students (India + global):\n\n"
                "🇮🇳 India-focused:\n"
                "• internshala.com — largest, free, stipend-based\n"
                "• letsintern.com — freshers & students\n"
                "• unstop.com — competitions + internships\n"
                "• naukri.com/internship — big companies\n"
                "• linkedin.com/jobs — filter 'Internship'\n\n"
                "🌍 Global / Remote:\n"
                "• wellfound.com (AngelList) — startups\n"
                "• youthop.com — international programs\n"
                "• remoteok.com — remote internships\n"
                "• simplyhired.com — US + remote\n\n"
                "💡 Tips:\n"
                "• Apply to 20+ at once — low acceptance rate is normal\n"
                "• Tailor your resume to each JD\n"
                "• A good GitHub profile beats a blank resume")

    # ── Job portals ────────────────────────────────────────────────────────
    if any(w in m for w in ["job portal","job website","where to find job","job site","job board","find job","get job","apply job"]):
        return ("💼 Best job portals for freshers & experienced:\n\n"
                "🇮🇳 India:\n"
                "• linkedin.com — #1 for tech jobs, networking\n"
                "• naukri.com — largest India job board\n"
                "• instahyre.com — curated tech roles\n"
                "• cutshort.io — AI-matched tech jobs\n"
                "• hirist.com — IT-specific\n"
                "• foundit.in (Monster) — mass applications\n\n"
                "🌍 Global:\n"
                "• levels.fyi — salaries + job links\n"
                "• greenhouse.io — startup/scaleup\n"
                "• wellfound.com — startup jobs\n"
                "• workatastartup.com — YC companies\n\n"
                "💡 Pro tip: LinkedIn Easy Apply + Naukri premium = fastest results")

    # ── Freelancing ────────────────────────────────────────────────────────
    if any(w in m for w in ["freelanc","fiverr","upwork","freelance","side income","earn online","gig","contract work"]):
        return ("💻 Freelancing for developers — where to start:\n\n"
                "🔰 Beginner-friendly platforms:\n"
                "• fiverr.com — create service gigs, quick income\n"
                "• upwork.com — hourly/project contracts\n"
                "• freelancer.com — bid on projects\n"
                "• toptal.com — elite developers (needs vetting)\n\n"
                "🇮🇳 India-specific:\n"
                "• truelancer.com\n"
                "• worknhire.com\n\n"
                "💡 How to start:\n"
                "1. Pick a niche (React, Python bots, WordPress)\n"
                "2. Build 2–3 portfolio projects on GitHub\n"
                "3. Create Fiverr gig with clear deliverables\n"
                "4. Price low initially to get first reviews\n"
                "5. Raise rates after 5-star reviews\n\n"
                "💰 Earning potential: ₹20k–₹2L/month in 6–12 months")

    # ── Certifications ─────────────────────────────────────────────────────
    if any(w in m for w in ["certif","certificate","certification","course","udemy","coursera","aws cert","google cert","microsoft cert"]):
        return ("🏅 Best certifications for tech students (2025):\n\n"
                "☁️ Cloud (high ROI):\n"
                "• AWS Cloud Practitioner → Solutions Architect\n"
                "• Google Cloud ACE / Professional\n"
                "• Microsoft AZ-900 → AZ-104\n\n"
                "🤖 AI/ML:\n"
                "• DeepLearning.AI (Coursera) — Andrew Ng courses\n"
                "• Hugging Face NLP Course (free)\n"
                "• fast.ai — free, practical\n\n"
                "💻 Dev & DevOps:\n"
                "• Meta Frontend Dev (Coursera)\n"
                "• Linux Foundation CKAD (Kubernetes)\n"
                "• HashiCorp Terraform Associate\n\n"
                "🆓 Free & credible:\n"
                "• Google Digital Garage\n"
                "• Microsoft Learn (free paths)\n"
                "• CS50 (Harvard, edX)\n\n"
                "💡 AWS + any 1 AI cert = biggest salary jump for freshers")

    # ── Project ideas ──────────────────────────────────────────────────────
    if any(w in m for w in ["project idea","project to build","what project","side project","portfolio project","build project","hackathon","capstone"]):
        return (f"💡 Best project ideas for {r} in 2025:\n\n"
                "🔥 High-impact (recruiters love these):\n"
                "• AI Resume Analyzer — PDF upload + GPT/Groq API\n"
                "• Full-Stack Job Board — React + FastAPI + PostgreSQL\n"
                "• Real-time Chat App — WebSockets + Redis\n"
                "• LLM Chatbot with RAG — LangChain + ChromaDB\n"
                "• DSA Visualizer — animations for sorting/graphs\n\n"
                "📱 Mobile-friendly:\n"
                "• Expense Tracker (React Native or Flutter)\n"
                "• Weather Dashboard (OpenWeather API)\n\n"
                "💡 Rules for portfolio projects:\n"
                "• Always deploy it (Vercel, Render, Railway — free)\n"
                "• Write a proper README with screenshots\n"
                "• Add a live demo link\n"
                "• Show it solves a real problem")

    # ── GitHub / portfolio ─────────────────────────────────────────────────
    if any(w in m for w in ["github","portfolio","readme","open source","contribute","git"]):
        return ("🐙 GitHub profile tips that impress recruiters:\n\n"
                "📌 Must-haves:\n"
                "• Professional profile picture & bio\n"
                "• Pinned repos — your 6 best projects\n"
                "• Each repo: clear README + live demo link\n"
                "• Green contribution graph (commit daily, even small)\n\n"
                "🌟 How to get into open source:\n"
                "• good-first-issue.github.io — beginner issues\n"
                "• up-for-grabs.net — curated open issues\n"
                "• Start by fixing docs or writing tests\n"
                "• Target small-medium repos, not React/VSCode\n\n"
                "📈 GitHub profile = #1 hiring filter for tech companies\n"
                "• Google, Zepto, Razorpay all check GitHub before interviews")

    # ── LinkedIn tips ──────────────────────────────────────────────────────
    if any(w in m for w in ["linkedin","network","networking","connection","cold message","dm recruiter","reach out recruiter"]):
        return ("💼 LinkedIn tips for students & freshers:\n\n"
                "✅ Profile must-haves:\n"
                "• Professional photo (suit/formal, plain background)\n"
                "• Headline: 'Full Stack Dev | React + FastAPI | Open to Internships'\n"
                "• About: 3 sentences — who you are, what you build, what you want\n"
                "• Add all projects with GitHub + live demo links\n\n"
                "📨 Cold messaging recruiters that works:\n"
                "'Hi [Name], I'm a [year] CS student at [college]. I saw your opening for [role] and noticed you use [tech] — I recently built [project]. Would love to connect!'\n\n"
                "🔥 Growth hacks:\n"
                "• Post 1 project/learning update per week\n"
                "• Comment meaningfully on 5 posts/day\n"
                "• Connect with 10 people in your target company/domain daily\n"
                "• 500+ connections before placement season")

    # ── Higher studies / Masters ───────────────────────────────────────────
    if any(w in m for w in ["ms","masters","gre","gate","higher stud","phd","abroad","us university","canada university","ms in cs","m.tech"]):
        return ("🎓 Higher Studies guide for CS students:\n\n"
                "🇺🇸 MS in CS (USA) — most popular:\n"
                "• Top targets: CMU, Stanford, UIUC, UMass, UCSD, Purdue\n"
                "• GRE: 320+ (320 is fine for mid-tier, 330+ for top-10)\n"
                "• IELTS/TOEFL: 7.0+ / 100+\n"
                "• Apply Aug–Dec for Fall intake\n"
                "• Cost: $40k–$80k/yr but RA/TA covers most\n\n"
                "🇨🇦 Canada (cheaper + PR pathway):\n"
                "• UofT, UBC, Waterloo, McGill\n"
                "• No GRE needed for most\n\n"
                "🇮🇳 India GATE → M.Tech:\n"
                "• Score 600+ for IITs/NITs\n"
                "• Stipend: ₹12,400/month at IITs\n\n"
                "💡 Work 1–2 years first → much stronger MS application + funding")

    # ── Placement prep ─────────────────────────────────────────────────────
    if any(w in m for w in ["placement","campus placement","on campus","off campus","placement prep","crack placement","tcs","infosys","wipro","accenture","cognizant"]):
        return ("🎯 Campus Placement Preparation Guide:\n\n"
                "📅 Timeline (start 6 months before):\n"
                "Month 1–2: DSA — 150 LeetCode problems (Easy+Medium)\n"
                "Month 3: CS Fundamentals — OS, DBMS, CN, OOP\n"
                "Month 4: System Design basics + projects\n"
                "Month 5: Aptitude + Verbal (IndiaBix, PrepInsta)\n"
                "Month 6: Mock interviews + resume polish\n\n"
                "🏢 Company-wise focus:\n"
                "• TCS/Infosys/Wipro: Aptitude + basic coding\n"
                "• Capgemini/Accenture: Aptitude + pseudo-code\n"
                "• Amazon/Flipkart: DSA heavy (LeetCode Medium-Hard)\n"
                "• Google/Microsoft: DSA + System Design\n"
                "• Startups: Projects + GitHub matter most\n\n"
                "📚 Resources: PrepInsta, GeeksforGeeks, InterviewBit, LeetCode")

    # ── DSA / Competitive programming ─────────────────────────────────────
    if any(w in m for w in ["dsa","data structure","algorithm","leetcode","codeforces","competitive","cp","arrays","tree","graph","dp","dynamic programming"]):
        return ("⚡ DSA Mastery Roadmap (placement + FAANG):\n\n"
                "📚 Phase 1 — Foundations (4 weeks):\n"
                "• Arrays, Strings, Hashing, Two Pointers\n"
                "• Stacks, Queues, Linked Lists\n"
                "• Resource: Striver's A2Z DSA Sheet (free)\n\n"
                "📚 Phase 2 — Core (4 weeks):\n"
                "• Trees (BT, BST), Graphs (BFS/DFS)\n"
                "• Recursion + Backtracking\n"
                "• Resource: NeetCode.io (best explanations)\n\n"
                "📚 Phase 3 — Advanced (4 weeks):\n"
                "• Dynamic Programming (DP)\n"
                "• Heaps, Tries, Segment Trees\n"
                "• Resource: LeetCode Top 150 list\n\n"
                "🎯 Target: 200 LeetCode problems (Easy:Medium:Hard = 1:2:1)\n"
                "Platforms: LeetCode > Codeforces > HackerRank\n"
                "Time: 1–2 problems/day = interview-ready in 3 months")

    # ── System design ──────────────────────────────────────────────────────
    if any(w in m for w in ["system design","lld","hld","low level design","high level design","design uber","design twitter","scalab"]):
        return ("🏗️ System Design study guide:\n\n"
                "📖 Resources (in order):\n"
                "1. 'Grokking System Design' — educative.io (paid, worth it)\n"
                "2. ByteByteGo by Alex Xu — YouTube (free) + book\n"
                "3. github.com/donnemartin/system-design-primer (free, 250k stars)\n"
                "4. NeetCode System Design playlist (YouTube)\n\n"
                "📌 Core topics to cover:\n"
                "• Load balancing, Caching (Redis), CDN\n"
                "• SQL vs NoSQL, Sharding, Replication\n"
                "• Message queues (Kafka), Rate limiting\n"
                "• CAP theorem, Consistent hashing\n\n"
                "🎯 Practice designs: URL shortener, Instagram, WhatsApp, Uber\n\n"
                "Timeline: 4 weeks of daily 1-hour study = interview-ready")

    # ── Python / coding resources ──────────────────────────────────────────
    if any(w in m for w in ["python","javascript","react","learn coding","coding resource","where to learn","tutorial","best course"]):
        return ("📚 Best free resources to learn tech in 2025:\n\n"
                "🐍 Python:\n"
                "• CS50P — Harvard, free on edX\n"
                "• Automate the Boring Stuff (free book)\n"
                "• Real Python (realpython.com)\n\n"
                "⚛️ React / JavaScript:\n"
                "• javascript.info — best JS guide (free)\n"
                "• Full Stack Open — Helsinki Uni (free)\n"
                "• React Official Docs (react.dev)\n\n"
                "🤖 AI/ML:\n"
                "• fast.ai — top-down practical approach\n"
                "• Kaggle Learn — free micro-courses\n"
                "• DeepLearning.AI on Coursera\n\n"
                "☁️ Cloud & DevOps:\n"
                "• KodeKloud — Kubernetes, Docker (best)\n"
                "• AWS Skill Builder (free tier)\n\n"
                "💡 Rule: Build something every week, not just watch tutorials")

    # ── Resume & ATS ───────────────────────────────────────────────────────
    if any(w in m for w in ["resume","cv","ats","format","resume tip","resume help","write resume"]):
        return ("📄 Resume & ATS optimization guide:\n\n"
                "✅ DO:\n"
                "• Mirror exact keywords from the JD\n"
                "• Quantify everything: 'Reduced load time by 40%'\n"
                "• 1 page for freshers, 2 pages max for experienced\n"
                "• Include GitHub + LinkedIn + deployed project links\n"
                "• Use action verbs: Built, Deployed, Optimized, Led\n\n"
                "❌ DON'T:\n"
                "• Tables, images, columns (ATS can't parse them)\n"
                "• Fancy fonts — use Calibri, Arial, Helvetica\n"
                "• Objective statements — use a summary instead\n"
                "• Spelling mistakes (auto-reject)\n\n"
                "🆓 Free resume tools:\n"
                "• rxresu.me — ATS-friendly, free\n"
                "• overleaf.com — LaTeX templates\n"
                "• resume.io\n\n"
                "→ Use the 📄 ATS Checker tab to score your resume!")

    # ── Salary ─────────────────────────────────────────────────────────────
    if any(w in m for w in ["salary","pay","lpa","ctc","package","earn","money","stipend","how much"]):
        return (f"💰 Salary guide for {r} in India (2025):\n\n"
                "👶 Fresher (0–1 yr):\n"
                "• Service companies (TCS/Infosys): ₹3.5–7 LPA\n"
                "• Product startups: ₹8–18 LPA\n"
                "• FAANG India: ₹20–45 LPA\n\n"
                "🧑‍💻 Mid-level (2–4 yrs): ₹15–40 LPA\n"
                "👨‍💼 Senior (5+ yrs): ₹40–100 LPA\n"
                "🏆 Staff/Principal: ₹80–200 LPA\n\n"
                "📍 Location premium:\n"
                "• Bangalore: +25–30% vs national avg\n"
                "• Remote (US startup): 3–5x India salary\n\n"
                "💡 Highest paying skills 2025: LLMs, Kubernetes, AWS, React\n"
                "🔗 Check real salaries: levels.fyi, glassdoor.co.in, ambitionbox.com")

    # ── Interview prep ─────────────────────────────────────────────────────
    if any(w in m for w in ["interview","prepare","crack","mock","behavioural","hr round","technical round","coding round"]):
        return (f"🎤 Interview preparation for {r}:\n\n"
                "📅 4-Week Plan:\n"
                "Week 1–2: DSA — arrays, trees, DP (LeetCode Medium)\n"
                "Week 3: System Design (ByteByteGo + Grokking)\n"
                "Week 4: Domain topics + mock interviews\n\n"
                "🔑 Must-prepare topics:\n"
                "• 50 LeetCode problems in your target stack\n"
                "• 3 STAR-format project stories with numbers\n"
                "• CS Fundamentals: OS, DBMS, Networks, OOP\n\n"
                "🎯 Mock interview platforms:\n"
                "• Pramp.com (free, peer mock)\n"
                "• interviewing.io (anonymous mocks)\n"
                "• Exponent (product/system design)\n\n"
                "💡 Golden rule: Think aloud — interviewers judge your process, not just the answer")

    # ── Skills to learn ────────────────────────────────────────────────────
    if any(w in m for w in ["skill","learn","what should","recommend","study","roadmap","path","how to become","become a"]):
        return (f"🗺️ Skills roadmap for {r} (2025):\n\n"
                "🔥 Tier 1 — Must have:\n"
                "• Python or JavaScript (pick one, go deep)\n"
                "• Git & GitHub (non-negotiable)\n"
                "• SQL basics\n"
                "• 1 cloud platform (AWS free tier is best to start)\n\n"
                "🚀 Tier 2 — High value:\n"
                "• Docker + basic Kubernetes\n"
                "• React (frontend) or FastAPI (backend)\n"
                "• LLMs / AI APIs (OpenAI, Groq — easy to start)\n\n"
                "💎 Tier 3 — Differentiate yourself:\n"
                "• MLOps: MLflow + Airflow\n"
                "• RAG + Vector DBs (Pinecone, ChromaDB)\n"
                "• System Design patterns\n\n"
                f"Your current skills: {sk}\n"
                "→ Go to 📊 Skill Gap Analysis for your personalized radar chart!")

    # ── Trending / 2025-2026 ───────────────────────────────────────────────
    if any(w in m for w in ["trending","trend","2026","2025","hot","popular","in demand","most important","best skill","top skill","future"]):
        return ("🔥 Most in-demand skills 2025–2026:\n\n"
                "1. Python (98/100) — essential for everything\n"
                "2. LLMs & GenAI (97/100) — fastest growing EVER\n"
                "3. Kubernetes (89/100) — production deployment must\n"
                "4. Cloud AI: AWS/GCP Vertex (87/100)\n"
                "5. RAG + Vector DBs (85/100) — building AI products\n"
                "6. MLOps: MLflow + Airflow (84/100)\n"
                "7. TypeScript (79/100) — frontend must-have\n"
                "8. Rust (75/100) — systems & performance\n\n"
                "🚀 THE skill defining 2026: Fine-tuning + deploying LLMs at scale\n\n"
                "📉 Declining: Hadoop, PHP, jQuery, Selenium\n"
                "📈 Rising fast: LangGraph, vLLM, LoRA fine-tuning, Weaviate")

    # ── ML / AI ────────────────────────────────────────────────────────────
    if any(w in m for w in ["ml","machine learning","ai","deep learning","llm","genai","pytorch","tensorflow","neural"]):
        return (f"🤖 ML/AI career path for {r}:\n\n"
                "🛤️ Learning order:\n"
                "1. Python + NumPy + Pandas (2 weeks)\n"
                "2. Statistics & Linear Algebra basics (2 weeks)\n"
                "3. Scikit-learn — classical ML (3 weeks)\n"
                "4. PyTorch + Neural Networks (4 weeks)\n"
                "5. Transformers + HuggingFace (3 weeks)\n"
                "6. LLMs + RAG + LangChain (ongoing)\n\n"
                "📚 Best free resources:\n"
                "• fast.ai (top-down, practical)\n"
                "• Kaggle Learn (free micro-courses)\n"
                "• Andrej Karpathy YouTube (Neural Networks from scratch)\n\n"
                f"💰 Salary: ₹6–15 LPA fresher → ₹40–100 LPA senior\n"
                f"Your skills: {sk}")

    # ── Specific tech (docker, cloud, etc.) ────────────────────────────────
    if any(w in m for w in ["docker","kubernetes","devops","cloud","aws","gcp","terraform","linux"]):
        return ("☁️ Cloud & DevOps learning path:\n\n"
                "📅 6-Month Roadmap:\n"
                "Month 1: Linux basics + Bash scripting\n"
                "Month 2: Docker (containers, Dockerfile, Compose)\n"
                "Month 3: Kubernetes (pods, deployments, services)\n"
                "Month 4: AWS/GCP fundamentals + CI/CD (GitHub Actions)\n"
                "Month 5: Terraform (IaC) + Ansible\n"
                "Month 6: Prometheus + Grafana monitoring\n\n"
                "🏅 Certifications (in order):\n"
                "• AWS Cloud Practitioner → Solutions Architect\n"
                "• CKA (Certified Kubernetes Administrator)\n"
                "• HashiCorp Terraform Associate\n\n"
                "💰 Salary: ₹5–85 LPA\n"
                "📚 Best resource: KodeKloud (hands-on labs, worth every rupee)")

    # ── Career switch ──────────────────────────────────────────────────────
    if any(w in m for w in ["career switch","change career","switch to","non-cs","non cs","mechanical","civil","ece","eee","career change"]):
        return ("🔄 Career switch to tech — complete guide:\n\n"
                "✅ It's 100% possible — many top engineers are non-CS!\n\n"
                "📅 12-Month Plan:\n"
                "Month 1–3: Python + web basics (HTML, CSS, JS)\n"
                "Month 4–6: Pick a stack (React or FastAPI) + DSA basics\n"
                "Month 7–9: Build 3 portfolio projects + deploy them\n"
                "Month 10–12: Apply aggressively, prep interviews\n\n"
                "🎯 Best entry roles for switchers:\n"
                "• Frontend Dev (visual, quick to learn)\n"
                "• Data Analyst (Excel → SQL → Python progression)\n"
                "• QA/Test Automation (underrated, less competition)\n"
                "• DevOps (infra skills transfer from ECE/Mech)\n\n"
                "💡 Best resource: CS50 (Harvard, free) — designed for non-CS people")

    # ── Hackathon / competitions ───────────────────────────────────────────
    if any(w in m for w in ["hackathon","competition","contest","smart india","sih","coding competition","build","build something"]):
        return ("🏆 Hackathons & competitions for students:\n\n"
                "🇮🇳 India:\n"
                "• Smart India Hackathon (SIH) — government, massive exposure\n"
                "• HackWithInfy (Infosys) — ₹1L+ prizes\n"
                "• Flipkart Grid — e-commerce focused\n"
                "• Goldman Sachs HackerRank — finance tech\n\n"
                "🌍 Global:\n"
                "• HackMIT, HackHarvard, TreeHacks (apply online)\n"
                "• Google Summer of Code (GSoC) — 3-month paid contribution\n"
                "• MLH (Major League Hacking) — 200+ hackathons/year\n\n"
                "💡 Strategy:\n"
                "• Team of 3–4 with diverse skills (frontend+backend+ML)\n"
                "• Pick problem statements where you have existing code\n"
                "• Demo > code quality in most hackathons\n"
                "• Even participation looks great on resume")

    # ── General student questions (catch-all) ──────────────────────────────
    if any(w in m for w in ["how","what","when","where","which","why","can you","tell me","explain","help","guide","advice","suggest","tips","best","good"]):
        return (f"🤔 Great question! Here's my best answer for a {r} student:\n\n"
                f"Your question: '{msg[:80]}{'...' if len(msg) > 80 else ''}' touches on career development. Here are the most useful resources:\n\n"
                "📌 General student resources:\n"
                "• roadmap.sh — visual roadmaps for every tech role (free)\n"
                "• geeksforgeeks.org — CS fundamentals + interview prep\n"
                "• github.com/EbookFoundation/free-programming-books\n"
                "• reddit.com/r/cscareerquestions — real advice from industry\n"
                "• dev.to & hashnode.dev — tech blogs\n\n"
                f"Your skills: {sk}\n\n"
                "💡 For a detailed AI answer, make sure the backend is running and connected. "
                "Or try rephrasing your question with keywords like 'internship', 'salary', 'project', 'resume', etc.")

    # ── True default ───────────────────────────────────────────────────────
    return (f"📌 SkillForge AI for {r}:\n\n"
            f"I can help you with:\n"
            f"• 🌐 'websites for internships' — job portals\n"
            f"• 💰 'salary for full stack developer' — pay info\n"
            f"• 🎤 'how to prepare for interviews' — prep plan\n"
            f"• 📄 'resume tips' — ATS optimisation\n"
            f"• 💻 'project ideas' — portfolio suggestions\n"
            f"• 🏅 'best certifications' — cert roadmap\n"
            f"• 📊 'skill gap analysis' — what to learn next\n"
            f"• 🐙 'github tips' — profile & open source\n"
            f"• 🎓 'masters abroad' — MS/GRE guide\n\n"
            f"Your skills: {sk}\nTry asking any of the above!")


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
class SignupReq(BaseModel):
    email:       str
    password:    str
    full_name:   str
    user_type:   Optional[str]       = "job_seeker"
    college:     Optional[str]       = ""
    branch:      Optional[str]       = ""
    year:        Optional[str]       = ""
    target_role: Optional[str]       = ""
    experience:  Optional[str]       = ""
    skills:      Optional[List[str]] = []

class LoginReq(BaseModel):
    email:    str
    password: str

class ProfileUpdate(BaseModel):
    full_name:    Optional[str]       = None
    college:      Optional[str]       = None
    branch:       Optional[str]       = None
    year:         Optional[str]       = None
    target_role:  Optional[str]       = None
    experience:   Optional[str]       = None
    skills:       Optional[List[str]] = None
    linkedin_url: Optional[str]       = None

class ChatReq(BaseModel):
    message:     str
    user_skills: Optional[List[str]] = []
    target_role: Optional[str]       = ""

class ExtractReq(BaseModel):
    text: str

class GapReq(BaseModel):
    user_skills:     List[str]
    target_role:     str
    job_description: Optional[str] = None

class RecoReq(BaseModel):
    user_skills: List[str]
    target_role: str

class SummarizeReq(BaseModel):
    text:      str
    job_title: str = ""

# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/")
def root():
    return {"service":"SkillForge AI","status":"running","version":"4.0.0",
            "groq_key_set": bool(GROQ_KEY), "docs": "/docs"}


@app.get("/api/jobs/test-adzuna")
async def test_adzuna():
    """
    Debug endpoint — tests Adzuna API directly with no auth.
    Visit http://localhost:8000/api/jobs/test-adzuna to verify API works.
    """
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return {"error": "Adzuna not configured", "app_id_set": bool(ADZUNA_APP_ID), "app_key_set": bool(ADZUNA_APP_KEY)}

    try:
        import httpx
        url = f"{ADZUNA_BASE}/{ADZUNA_COUNTRY}/search/1"
        params = {
            "app_id":           ADZUNA_APP_ID,
            "app_key":          ADZUNA_APP_KEY,
            "results_per_page": 5,
            "what":             "python developer",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, params=params)

        if r.status_code != 200:
            return {
                "error":       f"Adzuna returned HTTP {r.status_code}",
                "body":        r.text[:500],
                "url_called":  str(r.url),
            }

        data = r.json()
        jobs = data.get("results", [])
        return {
            "status":        "ok",
            "total_count":   data.get("count", 0),
            "jobs_in_page":  len(jobs),
            "country":       ADZUNA_COUNTRY,
            "sample_titles": [j.get("title","?") for j in jobs[:3]],
            "url_called":    str(r.url),
        }
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}

@app.get("/health")
def health():
    return {"status":"ok","groq_key_set": bool(GROQ_KEY)}

@app.post("/api/auth/signup", status_code=201)
def signup(req: SignupReq):
    if get_by_email(req.email):
        raise HTTPException(409, "Email already registered")
    initials = "".join(w[0].upper() for w in req.full_name.strip().split()[:2])
    user = create_user({"email":req.email,"hashed_pw":hash_pw(req.password),
                        "full_name":req.full_name,"user_type":req.user_type,
                        "college":req.college,"branch":req.branch,"year":req.year,
                        "target_role":req.target_role,"experience":req.experience,
                        "skills":req.skills or [],"avatar":initials or "?"})
    return {"token": make_token(user["id"]), "user": safe_user(user)}

@app.post("/api/auth/login")
def login(req: LoginReq):
    user = get_by_email(req.email)
    if not user or not verify_pw(req.password, user["hashed_pw"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": make_token(user["id"]), "user": safe_user(user)}

@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return safe_user(user)

@app.put("/api/auth/profile")
def update_profile(req: ProfileUpdate, user: dict = Depends(current_user_strict)):
    updated = update_user(user["email"], {k:v for k,v in req.dict().items() if v is not None})
    return safe_user(updated)

@app.post("/api/chatbot")
async def chatbot(req: ChatReq):
    if not req.message.strip():
        raise HTTPException(400, "Message cannot be empty")
    groq_reply = groq_answer(req.message, req.user_skills or [], req.target_role or "ML Engineer")
    if groq_reply:
        return {"reply": groq_reply, "model": "llama3-8b-8192", "source": "groq"}
    reply = smart_answer(req.message, req.user_skills or [], req.target_role or "ML Engineer")
    return {"reply": reply, "model": "smart_local", "source": "local"}

@app.get("/api/chatbot/health")
def chatbot_health():
    groq_ok = bool(GROQ_KEY)
    return {"status":"ready","token_set":groq_ok,
            "token_preview": f"{GROQ_KEY[:12]}..." if groq_ok else "NOT SET",
            "engine": "groq" if groq_ok else "local_fallback"}

@app.post("/api/skills/extract")
def skills_extract(req: ExtractReq, user: dict = Depends(current_user)):
    return extract_skills(req.text)

@app.get("/api/skills/demand")
def skills_demand(user: dict = Depends(current_user)):
    return {"skills":[
        {"skill":"Python","demand":98,"trend":"rising","jobs":45200},
        {"skill":"LLMs / AI","demand":97,"trend":"rising","jobs":38900},
        {"skill":"Kubernetes","demand":89,"trend":"stable","jobs":31400},
        {"skill":"AWS/GCP","demand":87,"trend":"rising","jobs":29800},
        {"skill":"MLOps","demand":84,"trend":"rising","jobs":19600},
        {"skill":"React","demand":83,"trend":"stable","jobs":52100},
        {"skill":"TypeScript","demand":81,"trend":"rising","jobs":44300},
        {"skill":"FastAPI","demand":78,"trend":"rising","jobs":18200},
        {"skill":"Docker","demand":76,"trend":"stable","jobs":38700},
        {"skill":"PostgreSQL","demand":72,"trend":"stable","jobs":28900},
    ]}

@app.get("/api/skills/trending")
def skills_trending(user: dict = Depends(current_user)):
    return {"emerging":["LLM Agents","Multimodal AI","LoRA Fine-tuning","vLLM","LangGraph"],
            "rising":["Kubernetes","MLOps","RAG","Vector DBs","FastAPI","Rust"],
            "stable":["Python","React","SQL","Docker","AWS"],
            "falling":["Hadoop","PHP","jQuery"]}

@app.get("/api/jobs/")
def list_jobs(company:Optional[str]=None, location:Optional[str]=None,
              skill:Optional[str]=None, salary_min:Optional[float]=None,
              salary_max:Optional[float]=None, user:dict=Depends(current_user)):
    """Static Kaggle dataset endpoint — always available, no API keys needed."""
    results = JOBS_DB
    if company:    results = [j for j in results if company.lower()   in j["company"].lower()]
    if location:   results = [j for j in results if location.lower()  in j["location"].lower()]
    if skill:      results = [j for j in results if any(skill.lower() in s.lower() for s in j["skills"])]
    if salary_min: results = [j for j in results if j["salary_max"]   >= salary_min]
    if salary_max: results = [j for j in results if j["salary_min"]   <= salary_max]
    return {"jobs": results, "total": len(results), "source": "kaggle_dataset"}

@app.get("/api/jobs/live")
async def list_jobs_live(
    query:    Optional[str]   = "software engineer",
    location: Optional[str]   = "",
    skill:    Optional[str]   = None,
    results:  Optional[int]   = 25,
    user:     dict            = Depends(current_user),
):
    """
    Real-time job search via Adzuna API.
    query    = job title to search (e.g. "Data Scientist") — sent to Adzuna
    location = city filter, ONLY passed to Adzuna if it looks like a real city
    skill    = used ONLY for post-fetch scoring, never sent to Adzuna
    """
    # Use query as-is for Adzuna — it's the job title
    search_q = (query or "software engineer").strip()

    # Only pass location to Adzuna if it's a meaningful city name
    # Reject: empty, "city", "remote", single chars, numbers
    PLACEHOLDER_LOCATIONS = {"city", "remote", "location", "anywhere", ""}
    clean_location = ""
    if location:
        loc_clean = location.strip().lower()
        if loc_clean not in PLACEHOLDER_LOCATIONS and len(loc_clean) > 2 and not loc_clean.isdigit():
            clean_location = location.strip()

    live = await fetch_adzuna_jobs(
        query=search_q,
        location=clean_location,
        results=min(int(results or 25), 50),
    )

    if live is not None:
        # Score all returned jobs against user's profile skills
        # skill param is NOT used to filter — it's used to boost match scoring
        user_skills = list(user.get("skills", []))
        if skill:
            # Add the skill filter terms to scoring context
            extra = [s.strip() for s in skill.split(",") if s.strip()]
            user_skills = list(set(user_skills + extra))

        scored = match_live_jobs(live, user_skills)
        return {
            "jobs":   scored,
            "total":  len(scored),
            "source": "adzuna_live",
            "query":  search_q,
        }

    # Fallback: Kaggle dataset
    fallback = list(JOBS_DB)
    if clean_location:
        fallback = [j for j in fallback if clean_location.lower() in j["location"].lower()]
    scored_fb = match_live_jobs(fallback, user.get("skills", []))
    return {
        "jobs":    scored_fb,
        "total":   len(scored_fb),
        "source":  "kaggle_dataset",
        "message": "Adzuna not configured or unavailable.",
    }

@app.get("/api/jobs/live/status")
def jobs_live_status():
    """Check if real-time job search is configured."""
    configured = bool(ADZUNA_APP_ID and ADZUNA_APP_KEY)
    return {
        "live_jobs_enabled": configured,
        "provider": "Adzuna" if configured else None,
        "country": ADZUNA_COUNTRY if configured else None,
        "message": "Real-time jobs active" if configured else "Add ADZUNA_APP_ID + ADZUNA_APP_KEY to .env",
    }

@app.post("/api/jobs/standardize")
def standardize_title(body: dict, user: dict = Depends(current_user)):
    title = body.get("title","")
    return {"original": title, "standardized": title.title(), "confidence": 0.92}

@app.post("/api/gap-analysis/analyze")
def gap_analysis(req: GapReq, user: dict = Depends(current_user)):
    rk       = req.target_role.lower().strip()
    required = ROLE_SKILLS.get(rk, ["Python","SQL","Git","Docker","Communication"])
    user_set = {s.lower() for s in req.user_skills}
    matched  = [s for s in required if s.lower() in user_set]
    gaps     = [s for s in required if s.lower() not in user_set]
    match_pct= round(len(matched)/len(required)*100,1) if required else 0
    gap_details = []
    for g in gaps:
        entry = {"skill": g}
        entry.update(LEARNING_DB.get(g, {"difficulty":"Medium","hours":8,"courses":["Udemy","Official Docs"]}))
        gap_details.append(entry)
    def score(cats):
        c = sum(1 for s in matched if s in cats)
        return min(100, round(c/len(cats)*100)) if cats else 0
    radar = [
        {"axis":"AI/ML Core",  "user":score(["PyTorch","TensorFlow","Machine Learning","NLP","LLMs","RLHF"]),"market":90},
        {"axis":"Cloud/Infra", "user":score(["AWS","GCP","Azure","Kubernetes","Docker"]),"market":85},
        {"axis":"MLOps",       "user":score(["MLflow","Airflow","CI/CD","Prometheus"]),"market":80},
        {"axis":"Data Eng.",   "user":score(["Kafka","Spark","SQL","Pandas","R"]),"market":75},
        {"axis":"Backend",     "user":score(["FastAPI","REST API","PostgreSQL","Redis","GraphQL"]),"market":78},
        {"axis":"DevOps",      "user":score(["Docker","CI/CD","Linux","Bash","Terraform"]),"market":72},
    ]
    return {"target_role":req.target_role,"match_pct":match_pct,"matched_skills":matched,
            "gap_skills":gaps,"gap_details":gap_details,"radar_data":radar,
            "total_required":len(required),"total_matched":len(matched),"total_gaps":len(gaps)}

@app.post("/api/recommendations/jobs")
async def recommend_jobs(req: RecoReq, user: dict = Depends(current_user)):
    """Job recommendations — uses Adzuna live data when configured, Kaggle dataset otherwise."""
    # Build a meaningful query from the target role
    role_q = req.target_role.strip() if req.target_role else "software engineer"

    live = await fetch_adzuna_jobs(query=role_q, results=30)

    if live is not None:
        scored = match_live_jobs(live, req.user_skills)
        return {
            "recommendations": scored[:10],
            "source": "adzuna_live",
            "total_searched": len(live),
        }

    # Fallback to Kaggle dataset
    return {
        "recommendations": match_jobs(req.user_skills, req.target_role),
        "source": "kaggle_dataset",
    }

@app.get("/api/analytics/overview")
def analytics_overview(user: dict = Depends(current_user)):
    return {"total_jobs_analyzed":128450,"total_skills_tracked":512,
            "top_skills":["Python","React","AWS","Docker","SQL","Kubernetes","PyTorch","FastAPI"],
            "skill_trends":[
                {"month":"Aug","llm":72,"cloud":65,"mlops":58,"frontend":70},
                {"month":"Sep","llm":78,"cloud":68,"mlops":62,"frontend":71},
                {"month":"Oct","llm":82,"cloud":72,"mlops":67,"frontend":72},
                {"month":"Nov","llm":88,"cloud":75,"mlops":72,"frontend":74},
                {"month":"Dec","llm":91,"cloud":78,"mlops":76,"frontend":75},
                {"month":"Jan","llm":95,"cloud":83,"mlops":82,"frontend":76},
            ],
            "industry_dist":[
                {"name":"Tech/IT","value":42},{"name":"Finance","value":18},
                {"name":"Healthcare","value":12},{"name":"E-Commerce","value":15},{"name":"Other","value":13},
            ],
            "location_data":[
                {"city":"Bangalore","count":34200},{"city":"Hyderabad","count":22100},
                {"city":"Mumbai","count":18400},{"city":"Pune","count":14300},
                {"city":"Delhi NCR","count":21800},{"city":"Remote","count":17600},
            ]}

@app.get("/api/analytics/salary-trends")
def salary_trends(user: dict = Depends(current_user)):
    return {"by_role":[
        {"role":"ML Engineer","min":35,"max":120,"avg":72},
        {"role":"Data Scientist","min":25,"max":90,"avg":58},
        {"role":"Backend Engineer","min":20,"max":80,"avg":50},
        {"role":"Frontend Engineer","min":18,"max":70,"avg":44},
        {"role":"DevOps Engineer","min":22,"max":85,"avg":54},
    ]}

@app.post("/api/resume/analyze")
async def resume_analyze(file:UploadFile=File(...), job_description:Optional[str]=Form(default=""),
                         target_role:Optional[str]=Form(default="ml engineer")):
    content = await file.read()
    if not content: raise HTTPException(400, "File is empty")
    fname = (file.filename or "").lower()
    if fname.endswith(".pdf") or "pdf" in (file.content_type or ""):
        text = extract_text_from_pdf(content)
    else:
        text = content.decode("utf-8", errors="ignore")
    if len(text.strip()) < 50:
        raise HTTPException(422, "Could not extract text. Use a PDF with selectable text.")
    return calculate_ats(text, job_description or "", target_role or "ml engineer")

@app.get("/api/resume/sample")
def resume_sample():
    return {"ats_score":78,"grade":"Good",
            "matched_skills":["Python","Machine Learning","SQL","Docker","Git"],
            "missing_skills":["Kubernetes","AWS","MLflow","Airflow"],
            "all_found_skills":["Python","Machine Learning","SQL","Docker","Git","FastAPI","React"],
            "total_required":9,"total_matched":5,"keyword_density":0.042,"word_count":487,
            "suggestions":["Add Kubernetes","Mention AWS/GCP","Add GitHub URL","Quantify achievements"],
            "format_checks":{"has_email":True,"has_phone":True,"has_linkedin":False,"has_github":False,"uses_bullets":True,"good_length":True},
            "match_pct":56}

@app.post("/api/career-report")
async def career_report(file:UploadFile=File(...), target_role:Optional[str]=Form(default=""),
                        job_description:Optional[str]=Form(default="")):
    content = await file.read()
    if not content: raise HTTPException(400, "File is empty")
    fname = (file.filename or "").lower()
    if fname.endswith(".pdf") or "pdf" in (file.content_type or ""):
        resume_text = extract_text_from_pdf(content)
    else:
        resume_text = content.decode("utf-8", errors="ignore")
    if len(resume_text.strip()) < 30:
        raise HTTPException(422, "Could not extract text. Use a PDF with selectable text.")
    skill_data      = extract_skills(resume_text)
    found_names     = [e["name"] for e in skill_data["all"]]
    role_for_ats    = (target_role or "").lower().strip() or "ml engineer"
    ats             = calculate_ats(resume_text, job_description or "", role_for_ats)
    suggested_roles = suggest_roles(found_names)
    primary_role    = target_role.strip() if target_role else (suggested_roles[0] if suggested_roles else "ML Engineer")
    jobs            = match_jobs(found_names, primary_role)
    top_jobs        = [{"title":j["title"],"company":j["company"],"location":j["location"],
                        "match_score":j["match_score"],"salary":f"₹{j['salary_min']}–{j['salary_max']} LPA",
                        "missing":j.get("missing",[])[:3]} for j in jobs[:5]]
    path   = generate_learning_path(primary_role, ats["missing_skills"])
    salary = SALARY_DB.get(primary_role.lower(), {"fresher":"₹6–15 LPA","mid":"₹15–40 LPA","senior":"₹40–100 LPA"})
    return {"current_skills":ats["matched_skills"],"missing_skills":ats["missing_skills"],
            "all_found_skills":found_names,"ats_score":ats["ats_score"],"ats_grade":ats["grade"],
            "ats_suggestions":ats["suggestions"],"format_checks":ats["format_checks"],
            "recommended_roles":suggested_roles,"salary_info":salary,"top_jobs":top_jobs,
            "learning_path":path,"word_count":ats["word_count"],"source":"backend_pipeline"}

@app.get("/api/career-report/sample")
def career_report_sample():
    return {"current_skills":["Python","Machine Learning","SQL","Docker","Git"],
            "missing_skills":["Kubernetes","AWS","MLflow","Airflow","LLMs"],
            "all_found_skills":["Python","ML","SQL","Docker","FastAPI","React","Git"],
            "ats_score":72,"ats_grade":"Good",
            "ats_suggestions":["Add Kubernetes","Link your GitHub","Quantify achievements"],
            "format_checks":{"has_email":True,"has_phone":True,"has_linkedin":False,"has_github":False,"uses_bullets":True,"good_length":True},
            "recommended_roles":["ML Engineer","Data Scientist","AI Researcher"],
            "salary_info":{"fresher":"₹6–15 LPA","mid":"₹15–40 LPA","senior":"₹40–100 LPA"},
            "top_jobs":[
                {"title":"Senior ML Engineer","company":"Google","location":"Bangalore","match_score":72,"salary":"₹45–80 LPA","missing":["Kubernetes","MLflow"]},
                {"title":"Data Scientist","company":"Microsoft","location":"Hyderabad","match_score":65,"salary":"₹35–65 LPA","missing":["Spark","R"]},
            ],
            "learning_path":{"3_months":["Docker","Git Advanced","SQL"],"6_months":["PyTorch","MLflow","Kubernetes"],"12_months":["LLMs & RAG","System Design","Kafka"]},
            "word_count":487,"source":"sample"}

@app.post("/api/summarization/")
async def summarize(req: SummarizeReq, user: dict = Depends(current_user)):
    text = req.text.strip()
    wc   = len(text.split())

    # Extract skills regardless of path
    skill_data = extract_skills(text)
    top_tech   = [s["name"] for s in skill_data.get("technical", [])[:8]]

    # Estimate experience/salary from text signals
    senior  = bool(re.search(r"senior|lead|principal|staff|8\+|10\+|7\+", text, re.I))
    mid     = bool(re.search(r"3[-–]|4[-–]|5[-–]|mid.level|2[-–]4", text, re.I))
    sal_est = "₹40–100 LPA" if senior else ("₹15–40 LPA" if mid else "₹6–18 LPA")
    exp_est = "5+ years" if senior else ("3–5 years" if mid else "0–3 years")

    # Extract job title from first line if not provided
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    job_title = req.job_title or (lines[0][:60] if lines else "Software Engineer")

    # Try Groq for intelligent summarization
    groq_summary = None
    if HAS_GROQ and GROQ_KEY and wc >= 20:
        try:
            client = _Groq(api_key=GROQ_KEY)
            prompt = (
                f"Summarize this job description in 2-3 sentences. Be specific and concise. "
                f"Focus on the role, key responsibilities, and required tech stack.\n\n"
                f"Job Description:\n{text[:2000]}"
            )
            completion = client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150,
            )
            groq_summary = completion.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Groq summarization failed: {e}")

    # Extract responsibilities from bullet points / lines
    resp_lines = []
    for line in text.split("\n"):
        l = line.strip().lstrip("•-*▸►→").strip()
        if 30 < len(l) < 150 and any(v in l.lower() for v in [
            "build","design","develop","implement","lead","manage","collaborate",
            "maintain","deploy","create","write","work","own","deliver","support","ensure"
        ]):
            resp_lines.append(l[:120])
        if len(resp_lines) >= 5:
            break

    if not resp_lines:
        resp_lines = [
            "Design and build production-grade systems at scale",
            "Collaborate with cross-functional teams on product delivery",
            "Own end-to-end feature development and deployment",
            "Mentor junior engineers and conduct code reviews",
        ]

    # Build smart summary if Groq failed
    if not groq_summary:
        sents = [s.strip() for s in re.split(r"[.!?]", text) if len(s.strip()) > 50]
        groq_summary = ". ".join(sents[:2]) + "." if sents else f"{job_title} role requiring strong technical skills in {', '.join(top_tech[:3]) or 'software engineering'}."

    return {
        "job_title":          job_title,
        "summary":            groq_summary,
        "required_skills":    top_tech,
        "nice_to_have":       ["Open source contributions", "Research publications", "Side projects", "Domain certifications"],
        "key_responsibilities": resp_lines,
        "salary_range":       sal_est,
        "experience_req":     exp_est,
        "word_count":         wc,
        "skill_count":        len(top_tech),
        "seniority":          "Senior" if senior else ("Mid-level" if mid else "Entry-level"),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
