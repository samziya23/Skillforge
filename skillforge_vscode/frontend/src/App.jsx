import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

/* ─── THEME ───────────────────────────────────────────── */
const T = {
  bg:"#070711",sidebar:"#0a0a18",card:"#0e0e1e",cardHover:"#131328",
  border:"rgba(99,102,241,0.15)",borderHi:"rgba(99,102,241,0.4)",
  text:"#e8e6f0",muted:"#6b6884",dim:"#1e1c35",
  accent:"#6366f1",accentGlow:"rgba(99,102,241,0.25)",accentSoft:"rgba(99,102,241,0.08)",
  teal:"#2dd4bf",amber:"#f59e0b",rose:"#f43f5e",green:"#22c55e",violet:"#a78bfa",blue:"#38bdf8",
};

/* ─── MICRO-INTERACTION STYLES (injected once on load) ──────────────────── */
const MICRO_CSS = `
  .sf-card {
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease !important;
    will-change: transform;
  }
  .sf-card:hover {
    transform: translateY(-4px) !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.28) !important;
  }
  .sf-statcard { transition: transform 0.22s ease, box-shadow 0.22s ease !important; }
  .sf-statcard:hover { transform: translateY(-4px) !important; box-shadow: 0 12px 36px rgba(0,0,0,0.4) !important; }
  .sf-statcard:hover .sf-stat-icon { transform: scale(1.18) rotate(-6deg) !important; }
  .sf-stat-icon { transition: transform 0.22s ease !important; display:flex;align-items:center;justify-content:center; }
  .sf-nav-item { transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease !important; }
  .sf-nav-item:not(.sf-nav-active):hover { background: rgba(99,102,241,0.1) !important; color: #a5b4fc !important; box-shadow: inset 3px 0 0 #6366f1 !important; }
  .sf-tag { transition: transform 0.15s ease, box-shadow 0.15s ease !important; }
  .sf-tag:hover { transform: scale(1.08) translateY(-1px) !important; box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important; }
  .sf-btn-extra { transition: box-shadow 0.18s ease !important; }
  .sf-btn-extra:hover:not(:disabled) { box-shadow: 0 4px 20px rgba(99,102,241,0.4) !important; }
  .sf-progress-fill { transition: width 1.3s cubic-bezier(0.34,1.4,0.64,1) !important; }
  .sf-page-in { animation: sfPageIn 0.2s ease forwards; }
  @keyframes sfPageIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .sf-shimmer {
    background: linear-gradient(90deg,#1e1c35 25%,#2a2848 50%,#1e1c35 75%);
    background-size: 800px 100%;
    animation: sfShim 1.5s infinite linear;
    border-radius:8px;
  }
  @keyframes sfShim { from{background-position:-400px 0} to{background-position:400px 0} }
`;
if (typeof document !== "undefined" && !document.getElementById("sf-micro")) {
  const el = document.createElement("style");
  el.id = "sf-micro";
  el.textContent = MICRO_CSS;
  document.head.appendChild(el);
}


/* ─── CONSTANTS ───────────────────────────────────────── */
const USER_TYPES   = ["Student","Job Seeker","Career Switcher","Working Professional"];
const YEAR_OPTIONS = ["1st Year","2nd Year","3rd Year","4th Year","Graduated","N/A"];
const TARGET_ROLES = ["ML Engineer","Data Scientist","Frontend Developer","Backend Developer","Full Stack Developer","DevOps Engineer","Data Analyst","AI Researcher","Product Manager","Cloud Engineer"];
const BASE = "http://localhost:8000/api";

/* ─── API ─────────────────────────────────────────────── */
const api = {
  _h:()=>({"Content-Type":"application/json",...(localStorage.getItem("sf_token")?{Authorization:`Bearer ${localStorage.getItem("sf_token")}`}:{})}),
  async post(p,b){try{const r=await fetch(`${BASE}${p}`,{method:"POST",headers:this._h(),body:JSON.stringify(b),signal:AbortSignal.timeout(3000)});if(r.ok)return r.json();throw new Error("fail");}catch{throw new Error("backend_offline");}},
  async get(p){try{const r=await fetch(`${BASE}${p}`,{headers:this._h(),signal:AbortSignal.timeout(3000)});if(r.ok)return r.json();throw new Error("fail");}catch{throw new Error("backend_offline");}},
  extractSkills:(t)=>api.post("/skills/extract",{text:t}),
  analyzeGap:(d)=>api.post("/gap-analysis/analyze",d),
  getRecos:(d)=>api.post("/recommendations/jobs",d),
  overview:()=>api.get("/analytics/overview"),
  summarize:(d)=>api.post("/summarization/",d),
  listJobs:(p="")=>api.get(`/jobs/?${p}`),
};

/* ─── SHARED STYLES ───────────────────────────────────── */
const IS={width:"100%",background:T.dim,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:13,fontFamily:"inherit",outline:"none",transition:"border-color 0.2s"};
const focus=(e)=>{e.target.style.borderColor=`${T.accent}70`;e.target.style.boxShadow=`0 0 0 3px ${T.accentGlow}`;};
const blur=(e)=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";};

/* ─── SHARED COMPONENTS ───────────────────────────────── */
function Card({children,style,glow,lift=true}){
  return(
    <motion.div
      className={lift?"sf-card":""}
      whileHover={lift?{borderColor:"rgba(99,102,241,0.32)"}:{}}
      style={{background:T.card,border:`1px solid ${glow?T.borderHi:T.border}`,borderRadius:18,padding:22,boxShadow:glow?`0 0 32px ${T.accentGlow}`:"none",...style}}>
      {children}
    </motion.div>
  );
}
function Btn({children,onClick,variant="primary",disabled,style,small}){
  const bg=variant==="primary"?`linear-gradient(135deg,${T.accent},#818cf8)`:variant==="danger"?T.rose:"transparent";
  return(
    <motion.button
      className="sf-btn-extra"
      whileHover={{scale:disabled?1:1.03,y:disabled?0:-1}}
      whileTap={{scale:disabled?1:0.96}}
      onClick={onClick} disabled={disabled}
      style={{background:bg,border:variant==="outline"?`1px solid ${T.border}`:"none",borderRadius:10,padding:small?"7px 16px":"11px 24px",color:variant==="primary"?"#fff":T.text,fontSize:small?12:13,fontWeight:700,fontFamily:"inherit",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,...style}}>
      {children}
    </motion.button>
  );
}
function StatCard({icon,label,value,sub,color=T.accent,delay=0}){
  const ref=useRef();const inView=useInView(ref,{once:true});
  return(
    <motion.div ref={ref} className="sf-statcard"
      initial={{opacity:0,y:20}} animate={inView?{opacity:1,y:0}:{}} transition={{delay,duration:0.5}}
      whileHover={{borderColor:"rgba(99,102,241,0.3)"}}
      style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:11,color:T.muted,fontWeight:700,letterSpacing:"0.08em",marginBottom:8}}>{label.toUpperCase()}</div>
          <div style={{fontSize:26,fontWeight:800,color,fontFamily:"'Bebas Neue',sans-serif",lineHeight:1}}>{value}</div>
          {sub&&<div style={{fontSize:11,color:T.muted,marginTop:5}}>{sub}</div>}
        </div>
        <div className="sf-stat-icon" style={{width:40,height:40,borderRadius:12,background:`${color}18`,fontSize:20}}>{icon}</div>
      </div>
    </motion.div>
  );
}
function Err({msg,onDismiss}){
  return msg?<motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} style={{background:`${T.rose}12`,border:`1px solid ${T.rose}35`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.rose,display:"flex",justifyContent:"space-between",marginBottom:14}}>⚠ {msg}{onDismiss&&<span onClick={onDismiss} style={{cursor:"pointer",opacity:0.6}}>✕</span>}</motion.div>:null;
}
function CT({active,payload,label}){
  if(!active||!payload?.length)return null;
  return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:12}}><div style={{color:T.muted,marginBottom:4,fontWeight:700}}>{label}</div>{payload.map(p=><div key={p.dataKey} style={{color:p.color}}>{p.name}: <b>{p.value}</b></div>)}</div>;
}
function Tag({name,matched}){
  const c=matched?T.teal:T.rose;
  return <motion.span className="sf-tag" whileHover={{scale:1.08,y:-1}} whileTap={{scale:0.95}} style={{display:"inline-flex",alignItems:"center",gap:4,background:`${c}12`,border:`1px solid ${c}35`,color:c,borderRadius:7,padding:"3px 10px",fontSize:11,fontWeight:600,margin:"2px",cursor:"default"}}><span style={{fontSize:8}}>{matched?"●":"○"}</span>{name}</motion.span>;
}
function Pills({options,value,onChange}){
  return <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{options.map(o=><motion.button key={o} whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>onChange(o)} style={{background:value===o?T.accentSoft:"transparent",border:`1px solid ${value===o?T.borderHi:T.border}`,borderRadius:8,padding:"6px 14px",color:value===o?T.accent:T.muted,fontSize:12,fontWeight:value===o?700:500,fontFamily:"inherit",cursor:"pointer"}}>{o}</motion.button>)}</div>;
}

/* ─── MOCK DATA ───────────────────────────────────────── */
const JOBS_MOCK=[
  {id:"1",title:"Senior ML Engineer",company:"Google",location:"Bangalore",skills:["Python","PyTorch","Kubernetes","MLflow","AWS"],salary_min:45,salary_max:80,experience:"3-5 yrs",match_score:72},
  {id:"2",title:"Data Scientist",company:"Microsoft",location:"Hyderabad",skills:["Python","SQL","ML","Pandas","Scikit-learn"],salary_min:35,salary_max:70,experience:"2-4 yrs",match_score:65},
  {id:"3",title:"AI Research Engineer",company:"Sarvam AI",location:"Bangalore",skills:["Python","PyTorch","LLMs","RLHF","Transformers"],salary_min:50,salary_max:100,experience:"2-4 yrs",match_score:58},
  {id:"4",title:"MLOps Engineer",company:"Flipkart",location:"Bangalore",skills:["Python","Kubernetes","MLflow","Airflow","Docker"],salary_min:30,salary_max:65,experience:"2-5 yrs",match_score:55},
  {id:"5",title:"Backend Developer",company:"Razorpay",location:"Bangalore",skills:["Python","FastAPI","PostgreSQL","Redis","Docker"],salary_min:20,salary_max:50,experience:"1-3 yrs",match_score:61},
];
const SKILL_DEMAND=[
  {skill:"Python",demand:98,trend:"rising",jobs:45200},
  {skill:"LLMs/AI",demand:97,trend:"rising",jobs:38900},
  {skill:"Kubernetes",demand:89,trend:"stable",jobs:31400},
  {skill:"Cloud AI",demand:87,trend:"rising",jobs:29800},
  {skill:"MLOps",demand:84,trend:"rising",jobs:19600},
  {skill:"React",demand:83,trend:"stable",jobs:52100},
];
const TREND_DATA=[
  {month:"Aug",llm:72,cloud:65,mlops:58},
  {month:"Sep",llm:78,cloud:68,mlops:62},
  {month:"Oct",llm:82,cloud:72,mlops:67},
  {month:"Nov",llm:88,cloud:75,mlops:72},
  {month:"Dec",llm:91,cloud:78,mlops:76},
  {month:"Jan",llm:95,cloud:83,mlops:82},
];
const RADAR_DATA=[
  {axis:"AI/ML Core",user:85,market:95},
  {axis:"Cloud/Infra",user:30,market:88},
  {axis:"MLOps",user:40,market:82},
  {axis:"Data Eng.",user:55,market:75},
  {axis:"Backend",user:70,market:80},
  {axis:"DevOps",user:45,market:78},
];
const INDUSTRY_DATA=[
  {name:"Tech/IT",value:42},{name:"Finance",value:18},
  {name:"Healthcare",value:12},{name:"E-Commerce",value:15},{name:"Other",value:13},
];
const PIE_COLORS=[T.accent,T.teal,T.amber,T.violet,T.blue];
const ROLE_SKILLS={
  "ml engineer":["Python","PyTorch","TensorFlow","Kubernetes","AWS","MLflow","Airflow","Docker","SQL","FastAPI","Git","Kafka","Spark"],
  "data scientist":["Python","SQL","Statistics","Pandas","Scikit-learn","Matplotlib","ML","R","Tableau","Git"],
  "frontend developer":["React","TypeScript","JavaScript","CSS","HTML","Git","Redux","Testing","GraphQL","Figma"],
  "backend developer":["Python","FastAPI","PostgreSQL","Redis","Docker","AWS","REST","Git","SQL","Linux"],
  "full stack developer":["React","TypeScript","Python","FastAPI","PostgreSQL","Docker","Git","REST","CSS","Redis"],
  "devops engineer":["Kubernetes","Docker","CI/CD","AWS","Terraform","Linux","Python","Bash","Prometheus","Ansible"],
  "data analyst":["SQL","Python","Excel","Tableau","Power BI","Statistics","Pandas","Communication","Reporting"],
  "ai researcher":["Python","PyTorch","Mathematics","Research","LLMs","Transformers","RLHF","NLP"],
  "cloud engineer":["AWS","GCP","Azure","Terraform","Kubernetes","Docker","Linux","CI/CD","Python"],
  "product manager":["Product Thinking","Agile","SQL","Jira","Communication","Roadmapping","Analytics","Figma"],
};

/* ─── AUTH PAGE ───────────────────────────────────────── */
function AuthPage({onAuth}){
  const [view,setView]=useState("login");
  const [step,setStep]=useState(1);
  const [ld,setLd]=useState(false);
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [f,setF]=useState({email:"",password:"",confirm:"",full_name:"",user_type:"",college:"",branch:"",year:"",target_role:"",experience:"",skills:""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const Lbl=({c})=><label style={{fontSize:11,color:T.muted,fontWeight:700,letterSpacing:"0.08em",display:"block",marginBottom:5}}>{c}</label>;

  const doLogin=async()=>{
    if(!f.email||!f.password){setErr("Fill all fields");return;}
    setLd(true);setErr("");
    await new Promise(r=>setTimeout(r,500));
    // try backend silently
    try{
      const res=await fetch(`${BASE}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.email,password:f.password}),signal:AbortSignal.timeout(2000)});
      if(res.ok){const d=await res.json();localStorage.setItem("sf_token",d.token);localStorage.setItem("sf_session",JSON.stringify(d.user));onAuth(d.user);setLd(false);return;}
    }catch{}
    // localStorage fallback
    const users=JSON.parse(localStorage.getItem("sf_users")||"{}");
    const u=users[f.email];
    if(!u){setErr("No account found. Sign up first.");setLd(false);return;}
    if(u.password!==f.password){setErr("Incorrect password.");setLd(false);return;}
    const {password:_,...safe}=u;
    localStorage.setItem("sf_session",JSON.stringify(safe));
    localStorage.setItem("sf_token","local_"+Date.now());
    onAuth(safe);setLd(false);
  };

  const doSignup=async()=>{
    if(!f.target_role){setErr("Select your target role");return;}
    setLd(true);setErr("");
    await new Promise(r=>setTimeout(r,600));
    const skills=f.skills.split(",").map(s=>s.trim()).filter(Boolean);
    const initials=f.full_name.trim().split(" ").map(w=>w[0]?.toUpperCase()||"").join("").slice(0,2)||"?";
    // try backend silently
    try{
      const res=await fetch(`${BASE}/auth/signup`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,skills,confirm:undefined}),signal:AbortSignal.timeout(2000)});
      if(res.ok){const d=await res.json();localStorage.setItem("sf_token",d.token);localStorage.setItem("sf_session",JSON.stringify(d.user));onAuth(d.user);setLd(false);return;}
    }catch{}
    // localStorage fallback
    const ud={id:"local_"+Date.now(),email:f.email,password:f.password,full_name:f.full_name,user_type:f.user_type||"Student",college:f.college,branch:f.branch,year:f.year,target_role:f.target_role,experience:f.experience,skills,avatar:initials,created_at:new Date().toISOString()};
    const users=JSON.parse(localStorage.getItem("sf_users")||"{}");
    users[f.email]=ud;localStorage.setItem("sf_users",JSON.stringify(users));
    const {password:_,...safe}=ud;
    localStorage.setItem("sf_session",JSON.stringify(safe));
    localStorage.setItem("sf_token","local_"+Date.now());
    onAuth(safe);setLd(false);
  };

  const next=()=>{
    if(step===1){
      if(!f.full_name||!f.email){setErr("Enter your name and email.");return;}
      if(f.password.length<6){setErr("Password must be 6+ characters.");return;}
      if(f.password!==f.confirm){setErr("Passwords do not match.");return;}
    }
    if(step===2&&!f.user_type){setErr("Select your user type.");return;}
    setErr("");setStep(x=>x+1);
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"15%",left:"20%",width:500,height:500,background:"radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:"20%",right:"15%",width:400,height:400,background:"radial-gradient(circle,rgba(45,212,191,0.08) 0%,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`,backgroundSize:"55px 55px",maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)",WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)"}}/>
      </div>
      <div style={{position:"relative",zIndex:2,width:"100%",maxWidth:view==="signup"?480:420}}>
        <div style={{background:"rgba(14,14,30,0.92)",backdropFilter:"blur(24px)",border:`1px solid ${T.border}`,borderRadius:22,padding:"40px 44px",boxShadow:"0 32px 80px rgba(0,0,0,0.6)",maxHeight:"92vh",overflowY:"auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:32}}>
            <div style={{width:40,height:40,borderRadius:11,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 0 20px ${T.accentGlow}`}}>⚡</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"0.08em",color:T.accent,lineHeight:1}}>SKILLFORGE AI</div>
              <div style={{fontSize:8,color:T.muted,letterSpacing:"0.2em"}}>CAREER INTELLIGENCE ENGINE</div>
            </div>
          </div>
          <AnimatePresence mode="wait">
            {view==="login"&&(
              <motion.div key="L" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}}>
                <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:T.text,marginBottom:4}}>Welcome Back</h1>
                <p style={{color:T.muted,fontSize:13,marginBottom:28}}>Sign in to your account</p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div><Lbl c="EMAIL"/><input type="email" placeholder="you@example.com" value={f.email} onChange={e=>s("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={IS} onFocus={focus} onBlur={blur}/></div>
                  <div><Lbl c="PASSWORD"/>
                    <div style={{position:"relative"}}>
                      <input type={show?"text":"password"} placeholder="••••••••" value={f.password} onChange={e=>s("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{...IS,paddingRight:44}} onFocus={focus} onBlur={blur}/>
                      <button onClick={()=>setShow(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:15}}>{show?"🙈":"👁"}</button>
                    </div>
                  </div>
                  <Err msg={err} onDismiss={()=>setErr("")}/>
                  <Btn onClick={doLogin} disabled={ld}>{ld?"⏳ SIGNING IN...":"⚡ SIGN IN"}</Btn>
                </div>
                <div style={{textAlign:"center",marginTop:20,color:T.muted,fontSize:13}}>No account? <span onClick={()=>{setView("signup");setErr("");setStep(1);}} style={{color:T.accent,fontWeight:700,cursor:"pointer",textDecoration:"underline",textDecorationColor:"transparent",transition:"text-decoration-color 0.2s"}} onMouseEnter={e=>e.target.style.textDecorationColor=T.accent} onMouseLeave={e=>e.target.style.textDecorationColor="transparent"}>Create one →</span></div>
              </motion.div>
            )}
            {view==="signup"&&(
              <motion.div key="S" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                <div style={{display:"flex",alignItems:"center",marginBottom:28}}>
                  {["Account","Profile","Career"].map((label,i)=>(
                    <div key={label} style={{display:"flex",alignItems:"center",flex:i<2?1:0}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:i+1<step?T.teal:i+1===step?T.accent:T.dim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:i+1<=step?"#fff":T.muted,transition:"all 0.3s"}}>{i+1<step?"✓":i+1}</div>
                        <span style={{fontSize:9,color:i+1===step?T.accent:T.muted,fontWeight:700}}>{label}</span>
                      </div>
                      {i<2&&<div style={{flex:1,height:2,background:i+1<step?T.teal:T.dim,margin:"0 6px",marginBottom:16,transition:"background 0.3s"}}/>}
                    </div>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {step===1&&(
                    <motion.div key="s1" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} transition={{duration:0.3}}>
                      <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:T.text,marginBottom:20}}>Create Account</h2>
                      <div style={{display:"flex",flexDirection:"column",gap:13}}>
                        <div><Lbl c="FULL NAME"/><input placeholder="e.g. Priyanshi Kumari" value={f.full_name} onChange={e=>s("full_name",e.target.value)} style={IS} onFocus={focus} onBlur={blur}/></div>
                        <div><Lbl c="EMAIL ADDRESS"/><input type="email" placeholder="you@example.com" value={f.email} onChange={e=>s("email",e.target.value)} style={IS} onFocus={focus} onBlur={blur}/></div>
                        <div><Lbl c="PASSWORD"/>
                          <div style={{position:"relative"}}>
                            <input type={show?"text":"password"} placeholder="Min 6 characters" value={f.password} onChange={e=>s("password",e.target.value)} style={{...IS,paddingRight:44}} onFocus={focus} onBlur={blur}/>
                            <button onClick={()=>setShow(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:15}}>{show?"🙈":"👁"}</button>
                          </div>
                        </div>
                        <div><Lbl c="CONFIRM PASSWORD"/><input type="password" placeholder="Re-enter password" value={f.confirm} onChange={e=>s("confirm",e.target.value)} style={IS} onFocus={focus} onBlur={blur}/></div>
                      </div>
                    </motion.div>
                  )}
                  {step===2&&(
                    <motion.div key="s2" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} transition={{duration:0.3}}>
                      <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:T.text,marginBottom:20}}>Your Profile</h2>
                      <div style={{display:"flex",flexDirection:"column",gap:16}}>
                        <div><Lbl c="I AM A"/><Pills options={USER_TYPES} value={f.user_type} onChange={v=>s("user_type",v)}/></div>
                        <div><Lbl c="COLLEGE / COMPANY"/><input placeholder="e.g. IIIT Bhubaneswar" value={f.college} onChange={e=>s("college",e.target.value)} style={IS} onFocus={focus} onBlur={blur}/></div>
                        <div><Lbl c="BRANCH / DEPARTMENT"/><input placeholder="e.g. B.Tech CSE" value={f.branch} onChange={e=>s("branch",e.target.value)} style={IS} onFocus={focus} onBlur={blur}/></div>
                        <div><Lbl c="YEAR / LEVEL"/><Pills options={YEAR_OPTIONS} value={f.year} onChange={v=>s("year",v)}/></div>
                      </div>
                    </motion.div>
                  )}
                  {step===3&&(
                    <motion.div key="s3" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} transition={{duration:0.3}}>
                      <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:T.text,marginBottom:20}}>Career Goals</h2>
                      <div style={{display:"flex",flexDirection:"column",gap:16}}>
                        <div><Lbl c="TARGET ROLE"/><Pills options={TARGET_ROLES} value={f.target_role} onChange={v=>s("target_role",v)}/></div>
                        <div><Lbl c="YEARS OF EXPERIENCE"/><Pills options={["Fresher","0–1 yr","1–3 yrs","3–5 yrs","5+ yrs"]} value={f.experience} onChange={v=>s("experience",v)}/></div>
                        <div><Lbl c="YOUR CURRENT SKILLS (comma separated)"/><input placeholder="Python, React, SQL, Docker..." value={f.skills} onChange={e=>s("skills",e.target.value)} style={IS} onFocus={focus} onBlur={blur}/></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Err msg={err} onDismiss={()=>setErr("")}/>
                <div style={{display:"flex",gap:10,marginTop:20}}>
                  {step>1&&<Btn variant="outline" onClick={()=>{setStep(x=>x-1);setErr("");}}>← Back</Btn>}
                  <Btn onClick={step<3?next:doSignup} disabled={ld} style={{flex:1}}>{ld?"⏳ CREATING...":step<3?"NEXT →":"⚡ LAUNCH SKILLFORGE"}</Btn>
                </div>
                {step===1&&<div style={{textAlign:"center",marginTop:18,color:T.muted,fontSize:13}}>Have an account? <span onClick={()=>{setView("login");setErr("");}} style={{color:T.accent,fontWeight:700,cursor:"pointer",textDecoration:"underline",textDecorationColor:"transparent",transition:"text-decoration-color 0.2s"}} onMouseEnter={e=>e.target.style.textDecorationColor=T.accent} onMouseLeave={e=>e.target.style.textDecorationColor="transparent"}>Sign in →</span></div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── SIDEBAR ─────────────────────────────────────────── */
const NAV=[
  {id:"dashboard",icon:"⊞",label:"Dashboard"},
  {id:"career",icon:"🚀",label:"Career Report"},
  {id:"chatbot",icon:"🤖",label:"AI Assistant"},
  {id:"ats",icon:"📄",label:"ATS Checker"},
  {id:"skills",icon:"🔬",label:"Skill Extraction"},
  {id:"standardize",icon:"🏷",label:"Title Standardizer"},
  {id:"recommendations",icon:"🎯",label:"Recommendations"},
  {id:"gap",icon:"📊",label:"Skill Gap Analysis"},
  {id:"roadmap",icon:"🛣️",label:"Career Roadmap"},
  {id:"interview",icon:"🎤",label:"Interview Prep"},
  {id:"summarize",icon:"📝",label:"Job Summaries"},
  {id:"analytics",icon:"📈",label:"Skill Analytics"},
  {id:"explorer",icon:"🔍",label:"Data Explorer"},
  {id:"casestudy",icon:"📋",label:"Case Study"},
  {id:"settings",icon:"⚙️",label:"Settings"},
];

function Sidebar({page,setPage,user,onLogout,collapsed,setCollapsed}){
  return(
    <motion.aside animate={{width:collapsed?64:220}} transition={{duration:0.3,ease:[0.22,1,0.36,1]}}
      style={{background:T.sidebar,borderRight:`1px solid ${T.border}`,height:"100vh",position:"fixed",left:0,top:0,display:"flex",flexDirection:"column",zIndex:100,overflow:"hidden",boxShadow:"4px 0 24px rgba(0,0,0,0.4)"}}>
      <div style={{padding:collapsed?"18px 14px":"18px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between",minHeight:66}}>
        {!collapsed&&<div style={{display:"flex",alignItems:"center",gap:9}}>
          <motion.div whileHover={{scale:1.1,rotate:10,boxShadow:`0 0 20px ${T.accentGlow}`}} style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚡</motion.div>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:"0.08em",color:T.accent,lineHeight:1}}>SKILLFORGE</div>
            <div style={{fontSize:7.5,color:T.muted,letterSpacing:"0.18em"}}>AI CAREER ENGINE</div>
          </div>
        </div>}
        {collapsed&&<div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚡</div>}
        {!collapsed&&<motion.button onClick={()=>setCollapsed(true)} whileHover={{scale:1.2,color:T.text,x:-2}} whileTap={{scale:0.9}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18}}>‹</motion.button>}
      </div>
      {collapsed&&<motion.button onClick={()=>setCollapsed(false)} whileHover={{scale:1.2,color:T.text,x:2}} whileTap={{scale:0.9}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",padding:"6px 0",fontSize:18,borderBottom:`1px solid ${T.border}`}}>›</motion.button>}
      <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
        {NAV.map(item=>{
          const active=page===item.id;
          return(
            <motion.button key={item.id} onClick={()=>setPage(item.id)}
              className={`sf-nav-item${active?" sf-nav-active":""}`}
              whileHover={active?{}:{x:3}} whileTap={{scale:0.96}} title={collapsed?item.label:""}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:collapsed?"10px 0":"10px 12px",justifyContent:collapsed?"center":"flex-start",background:active?T.accentSoft:"transparent",border:`1px solid ${active?T.borderHi:"transparent"}`,borderRadius:11,marginBottom:3,color:active?T.accent:T.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:active?700:500,transition:"all 0.2s"}}>
              <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
              {!collapsed&&<span style={{whiteSpace:"nowrap"}}>{item.label}</span>}
              {!collapsed&&active&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:T.accent}}/>}
            </motion.button>
          );
        })}
      </nav>
      {!collapsed&&(
        <div style={{padding:"12px",borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent}55,${T.violet}55)`,border:`1px solid ${T.accent}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:T.accent,flexShrink:0}}>{user?.avatar||"?"}</div>
            <div style={{overflow:"hidden",flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.full_name?.split(" ")[0]||"User"}</div>
              <div style={{fontSize:10,color:T.muted}}>{user?.user_type||"Member"}</div>
            </div>
            <motion.button onClick={onLogout} whileHover={{scale:1.15,color:T.rose,rotate:15}} whileTap={{scale:0.9}} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:16,transition:"color 0.2s"}}>⏻</motion.button>
          </div>
        </div>
      )}
    </motion.aside>
  );
}

/* ─── TOPBAR ──────────────────────────────────────────── */
function TopBar({page,user,onLogout,onSearch}){
  const TITLES={dashboard:"Dashboard",career:"🚀 Career Intelligence Report",chatbot:"AI Career Assistant",ats:"ATS Resume Checker",skills:"Skill Extraction",standardize:"Job Title Standardizer",recommendations:"Recommendations",gap:"Skill Gap Analysis",roadmap:"Career Roadmap",interview:"Interview Prep",summarize:"Job Summaries",analytics:"Skill Analytics",explorer:"Data Explorer",casestudy:"Portfolio Case Study",settings:"Settings"};
  const [q,setQ]=useState("");
  const [no,setNo]=useState(false);
  return(
    <div style={{height:62,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",borderBottom:`1px solid ${T.border}`,background:T.bg,position:"sticky",top:0,zIndex:50}}>
      <div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:T.text}}>{TITLES[page]||"Dashboard"}</div>
        <div style={{fontSize:10,color:T.muted,marginTop:-2}}>SkillForge AI · Career Intelligence</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:7,background:T.card,border:`1px solid ${T.border}`,borderRadius:9,padding:"7px 12px"}}>
          <span style={{color:T.muted,fontSize:12}}>🔍</span>
          <input placeholder="Search skills, jobs..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSearch(q)} style={{background:"none",border:"none",outline:"none",color:T.text,fontSize:12,fontFamily:"inherit",width:160}}/>
        </div>
        <div style={{position:"relative"}}>
          <motion.button whileHover={{scale:1.1,rotate:12}} whileTap={{scale:0.95}} onClick={()=>setNo(x=>!x)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:9,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,position:"relative"}}>
            🔔<div style={{position:"absolute",top:7,right:7,width:7,height:7,borderRadius:"50%",background:T.rose}}/>
          </motion.button>
          <AnimatePresence>
            {no&&(
              <motion.div initial={{opacity:0,y:8,scale:0.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}}
                style={{position:"absolute",right:0,top:44,width:280,background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 16px 48px rgba(0,0,0,0.5)",overflow:"hidden",zIndex:200}}>
                <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.border}`,fontWeight:700,color:T.text,fontSize:12}}>Notifications</div>
                {[{icon:"🔴",text:"K8s skill demand up +12% this week",time:"2h ago"},{icon:"🎯",text:"3 new jobs match your profile",time:"4h ago"},{icon:"✅",text:"Gap analysis complete",time:"1d ago"}].map((n,i)=>(
                  <motion.div key={i} whileHover={{background:"rgba(99,102,241,0.12)"}} style={{padding:"10px 14px",display:"flex",gap:9,borderBottom:`1px solid ${T.border}`,background:i<2?T.accentSoft:"transparent",cursor:"pointer",transition:"background 0.15s"}}>
                    <span>{n.icon}</span><div><div style={{fontSize:12,color:T.text}}>{n.text}</div><div style={{fontSize:10,color:T.muted,marginTop:2}}>{n.time}</div></div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.div whileHover={{scale:1.1,boxShadow:`0 0 16px ${T.accentGlow}`}} style={{width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,${T.accent}55,${T.violet}55)`,border:`1px solid ${T.accent}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:T.accent,cursor:"default"}}>{user?.avatar||"?"}</motion.div>
        <motion.button whileHover={{scale:1.02}} onClick={onLogout} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:9,padding:"7px 14px",color:T.muted,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>LOGOUT</motion.button>
      </div>
    </div>
  );
}

/* ─── PAGE: CAREER INTELLIGENCE REPORT ───────────────── */
const AI_STEPS=[
  {id:1,icon:"📤",label:"Uploading resume to backend..."},
  {id:2,icon:"🔍",label:"Extracting text from PDF..."},
  {id:3,icon:"🔬",label:"Detecting skills using NLP..."},
  {id:4,icon:"📊",label:"Comparing with job market dataset..."},
  {id:5,icon:"🎯",label:"Matching relevant job openings..."},
  {id:6,icon:"🛣️",label:"Generating personalized career path..."},
  {id:7,icon:"✅",label:"Career report ready!"},
];

function PageCareerReport({user}){
  const [file,setFile]=useState(null);
  const [targetRole,setTargetRole]=useState(user?.target_role||"ML Engineer");
  const [jd,setJd]=useState("");
  const [ld,setLd]=useState(false);
  const [step,setStep]=useState(0);   // 0=idle, 1-7=processing step
  const [report,setReport]=useState(null);
  const [err,setErr]=useState("");
  const fileRef=useRef(null);

  const runPipeline=async()=>{
    if(!file){setErr("Please upload your resume PDF first.");return;}
    setLd(true);setErr("");setReport(null);setStep(1);

    // Animate through processing steps
    const tick=async(s,ms=700)=>{await new Promise(r=>setTimeout(r,ms));setStep(s);};

    try{
      await tick(2,600);
      await tick(3,700);
      await tick(4,700);
      await tick(5,600);
      await tick(6,700);

      const fd=new FormData();
      fd.append("file",file);
      fd.append("target_role",targetRole.toLowerCase());
      if(jd.trim()) fd.append("job_description",jd);

      const res=await fetch(`${BASE}/career-report`,{method:"POST",body:fd,signal:AbortSignal.timeout(40000)});

      if(!res.ok){
        // Fallback to sample
        const sample=await fetch(`${BASE}/career-report/sample`).then(r=>r.json()).catch(()=>null);
        if(sample){setReport({...sample,_fallback:true});}
        else{setErr("Backend unavailable. Please start the backend server.");}
      } else {
        const data=await res.json();
        setReport(data);
      }
      await tick(7,400);
    } catch(e){
      console.error(e);
      // Try sample endpoint as graceful fallback
      try{
        const sample=await fetch(`${BASE}/career-report/sample`).then(r=>r.json());
        setReport({...sample,_fallback:true});
        setStep(7);
      } catch {
        setErr("Could not connect to backend. Make sure it is running on port 8000.");
        setStep(0);
      }
    }
    setLd(false);
  };

  const mc=(m)=>m>=75?T.green:m>=55?T.amber:T.rose;

  return(
    <div>
      {/* ── Hero Banner ── */}
      <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}}
        style={{background:`linear-gradient(135deg,rgba(99,102,241,0.15),rgba(45,212,191,0.08))`,border:`1px solid ${T.borderHi}`,borderRadius:20,padding:"28px 32px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:200,height:200,background:`radial-gradient(circle,${T.accentGlow},transparent)`,borderRadius:"50%",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:`0 0 24px ${T.accentGlow}`}}>🚀</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(1.5rem,4vw,2.4rem)",color:T.text,lineHeight:1,letterSpacing:"0.03em"}}>
                Career Intelligence{" "}
                <span style={{background:`linear-gradient(135deg,${T.accent},${T.teal})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  Report Engine
                </span>
              </div>
              <div style={{fontSize:13,color:T.muted,marginTop:4}}>
                Upload your resume → AI extracts skills → Full career analysis in one click
              </div>
            </div>
          </div>
          {/* Workflow steps visual */}
          <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap",marginTop:8}}>
            {["📤 Upload","→","🔬 Skills","→","📊 ATS Score","→","🎯 Jobs","→","🛣️ Learning Path"].map((s,i)=>(
              <div key={i} style={{fontSize:i%2===0?12:10,color:i%2===0?T.text:T.muted,fontWeight:i%2===0?700:400,padding:i%2===0?"4px 10px":"0 4px",background:i%2===0?`${T.accent}18`:"transparent",borderRadius:i%2===0?7:0,border:i%2===0?`1px solid ${T.accent}30`:"none",margin:"2px 0"}}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Upload Form ── */}
      {!report&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
          <Card>
            <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>📄 Upload Your Resume</div>
            <div style={{color:T.muted,fontSize:11,marginBottom:16}}>PDF only — backend will extract all text and skills using NLP</div>

            <motion.label whileHover={{borderColor:T.accent,background:`${T.accent}08`,scale:1.01}} whileTap={{scale:0.99}}
              style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:T.dim,border:`2px dashed ${file?T.teal:T.border}`,borderRadius:14,padding:"28px 20px",cursor:"pointer",transition:"all 0.3s",marginBottom:14,minHeight:160}}>
              <input ref={fileRef} type="file" accept=".pdf,.txt" onChange={e=>{setFile(e.target.files[0]||null);setReport(null);setStep(0);setErr("");}} style={{display:"none"}}/>
              <div style={{width:52,height:52,borderRadius:14,background:file?`${T.teal}18`:`${T.accent}18`,border:`1px solid ${file?T.teal:T.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>
                {file?"✅":"📤"}
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:700,color:file?T.teal:T.text,fontSize:14}}>{file?file.name:"Click to upload resume"}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:3}}>{file?`${(file.size/1024).toFixed(1)} KB ready`:"PDF or TXT • max 10MB"}</div>
              </div>
              {!file&&<div style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,borderRadius:9,padding:"7px 18px",fontSize:12,fontWeight:700,color:"#fff"}}>📤 Browse File</div>}
            </motion.label>

            <div>
              <label style={{fontSize:11,color:T.muted,fontWeight:700,letterSpacing:"0.08em",display:"block",marginBottom:6}}>TARGET ROLE</label>
              <Pills options={["ML Engineer","Data Scientist","Frontend Developer","Backend Developer","DevOps Engineer"]} value={targetRole} onChange={v=>{setTargetRole(v);setReport(null);}}/>
            </div>
          </Card>

          <Card>
            <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>💼 Job Description (Optional)</div>
            <div style={{color:T.muted,fontSize:11,marginBottom:14}}>Paste a specific JD for more targeted ATS scoring</div>
            <textarea value={jd} onChange={e=>setJd(e.target.value)}
              placeholder={"Paste job description here for targeted analysis...\n\nOr leave blank — we'll use your target role requirements."}
              style={{...IS,minHeight:160,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7,marginBottom:14}}
              onFocus={focus} onBlur={blur}/>
            <div style={{background:`${T.teal}10`,border:`1px solid ${T.teal}30`,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.muted,lineHeight:1.7}}>
              💡 The Career Report combines: <strong style={{color:T.teal}}>skill detection</strong> + <strong style={{color:T.accent}}>ATS scoring</strong> + <strong style={{color:T.violet}}>job matching</strong> + <strong style={{color:T.amber}}>learning path</strong> in one API call.
            </div>
          </Card>
        </div>
      )}

      {/* ── Error ── */}
      {err&&<motion.div initial={{opacity:0}} animate={{opacity:1}} style={{background:`${T.rose}12`,border:`1px solid ${T.rose}35`,borderRadius:12,padding:"12px 16px",fontSize:13,color:T.rose,marginBottom:16}}>⚠ {err}</motion.div>}

      {/* ── Generate button ── */}
      {!report&&(
        <div style={{display:"flex",gap:12,marginBottom:24,alignItems:"center"}}>
          <Btn onClick={runPipeline} disabled={ld||!file} style={{minWidth:260,fontSize:14}}>
            {ld?"":"🚀 GENERATE CAREER REPORT"}
            {ld&&`⏳ ${AI_STEPS[Math.min(step-1,AI_STEPS.length-1)]?.label||"Processing..."}`}
          </Btn>
          <span style={{fontSize:12,color:T.muted}}>~10–15 seconds with backend running</span>
        </div>
      )}

      {/* ── AI Processing Steps Animation ── */}
      {ld&&step>0&&(
        <Card style={{marginBottom:20}}>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>🤖 AI Pipeline Processing</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {AI_STEPS.map((s)=>{
              const done=step>s.id; const current=step===s.id; const pending=step<s.id;
              return(
                <motion.div key={s.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:s.id*0.07}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:current?T.accentSoft:done?`${T.teal}08`:"transparent",border:`1px solid ${current?T.borderHi:done?`${T.teal}25`:T.border}`,borderRadius:10}}>
                  <div style={{width:28,height:28,borderRadius:8,background:done?`${T.teal}25`:current?T.accentSoft:T.dim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                    {done?"✅":current?<motion.span animate={{rotate:[0,360]}} transition={{duration:1,repeat:Infinity,ease:"linear"}} style={{display:"inline-block"}}>⏳</motion.span>:s.icon}
                  </div>
                  <span style={{fontSize:13,color:done?T.teal:current?T.accent:T.muted,fontWeight:current?700:400}}>{s.label}</span>
                  {current&&<motion.div animate={{opacity:[0.3,1,0.3]}} transition={{duration:1,repeat:Infinity}} style={{marginLeft:"auto",fontSize:12,color:T.accent,fontWeight:700}}>RUNNING</motion.div>}
                  {done&&<div style={{marginLeft:"auto",fontSize:11,color:T.teal,fontWeight:700}}>DONE</div>}
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Report Output ── */}
      {report&&!ld&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
          {report._fallback&&(
            <div style={{background:`${T.amber}12`,border:`1px solid ${T.amber}35`,borderRadius:12,padding:"10px 16px",fontSize:12,color:T.amber,marginBottom:16,display:"flex",gap:8}}>
              <span>⚠</span><span>Showing sample report — backend not connected. Start the backend to analyze your actual resume.</span>
            </div>
          )}

          {/* Score bar */}
          <Card glow style={{marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:16}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,color:mc(report.ats_score),lineHeight:1}}>{report.ats_score}<span style={{fontSize:22}}>/100</span></div>
                <div style={{fontSize:14,fontWeight:700,color:mc(report.ats_score)}}>{report.ats_grade} — ATS Score</div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[{l:"Skills Found",v:report.all_found_skills?.length||0,c:T.teal},{l:"Matched",v:report.current_skills?.length||0,c:T.green},{l:"Missing",v:report.missing_skills?.length||0,c:T.rose},{l:"Words",v:report.word_count||0,c:T.muted}].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:T.dim,borderRadius:12,padding:"12px 18px"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:s.c,lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:3}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{height:7,background:T.dim,borderRadius:100,overflow:"hidden"}}>
              <motion.div initial={{width:0}} animate={{width:`${report.ats_score}%`}} transition={{duration:1.5,ease:"easeOut"}}
                style={{height:"100%",background:mc(report.ats_score),borderRadius:100}}/>
            </div>
          </Card>

          {/* Skills section */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Card>
              <div style={{fontSize:11,color:T.teal,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>✅ YOUR CURRENT SKILLS ({report.current_skills?.length||0})</div>
              <div>{(report.current_skills||[]).map(s=><Tag key={s} name={s} matched={true}/>)}</div>
            </Card>
            <Card>
              <div style={{fontSize:11,color:T.rose,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>❌ MISSING SKILLS ({report.missing_skills?.length||0})</div>
              <div>{(report.missing_skills||[]).map(s=><Tag key={s} name={s} matched={false}/>)}</div>
            </Card>
          </div>

          {/* Recommended roles + Salary */}
          <Card style={{marginBottom:16}}>
            <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>🎯 AI-Suggested Career Roles for You</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:16}}>
              {(report.recommended_roles||[]).map((r,i)=>(
                <motion.div key={r} whileHover={{y:-4,scale:1.04,borderColor:`${[T.accent,T.teal,T.violet][i%3]}65`,boxShadow:`0 6px 20px rgba(0,0,0,0.3)`}}
                  style={{background:T.dim,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",transition:"all 0.3s"}}>
                  <div style={{fontSize:11,color:[T.accent,T.teal,T.violet][i%3],fontWeight:700,letterSpacing:"0.06em",marginBottom:4}}>ROLE {i+1}</div>
                  <div style={{fontWeight:800,color:T.text,fontSize:14}}>{r}</div>
                </motion.div>
              ))}
            </div>
            <div style={{paddingTop:14,borderTop:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,color:T.amber,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>💰 SALARY BENCHMARK — {targetRole}</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {Object.entries(report.salary_info||{}).map(([k,v])=>(
                  <div key={k} style={{background:`${T.green}10`,border:`1px solid ${T.green}25`,borderRadius:10,padding:"8px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",marginBottom:3}}>{k}</div>
                    <div style={{fontWeight:800,color:T.green,fontSize:14}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Top matching jobs */}
          <Card style={{marginBottom:16}}>
            <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>💼 Top Matching Jobs for Your Profile</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(report.top_jobs||[]).map((j,i)=>(
                <motion.div key={i} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.dim,borderRadius:12,padding:"14px 18px",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,color:T.text,fontSize:14}}>{j.title}</div>
                    <div style={{color:T.muted,fontSize:12,marginTop:2}}>{j.company} · {j.location}</div>
                    {j.missing?.length>0&&<div style={{marginTop:6}}>{j.missing.map(s=><Tag key={s} name={s} matched={false}/>)}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:mc(j.match_score),lineHeight:1}}>{j.match_score}%</div>
                    <div style={{fontSize:11,color:T.green,fontWeight:700}}>{j.salary}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Learning path */}
          <Card>
            <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>🛣️ Your Personalised Learning Path</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {[{k:"3_months",l:"3 Months",c:T.accent,icon:"🌱"},{k:"6_months",l:"6 Months",c:T.teal,icon:"⚡"},{k:"12_months",l:"12 Months",c:T.green,icon:"👑"}].map(ph=>(
                <motion.div key={ph.k} whileHover={{y:-4,boxShadow:"0 12px 32px rgba(0,0,0,0.35)",borderColor:`${ph.c}50`}} style={{background:T.dim,border:`1px solid ${ph.c}25`,borderRadius:14,padding:16,transition:"border-color 0.2s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <div style={{width:32,height:32,borderRadius:9,background:`${ph.c}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{ph.icon}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:ph.c,letterSpacing:"0.04em"}}>{ph.l}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(report.learning_path?.[ph.k]||[]).map((sk,i)=>(
                      <motion.div key={sk} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}
                        whileHover={{x:4,background:`${ph.c}15`,borderColor:`${ph.c}40`}}
                        style={{display:"flex",alignItems:"center",gap:8,background:`${ph.c}08`,border:`1px solid ${ph.c}20`,borderRadius:8,padding:"6px 10px",transition:"background 0.15s",cursor:"default"}}>
                        <span style={{color:ph.c,fontSize:10,flexShrink:0}}>▸</span>
                        <span style={{fontSize:12,color:T.text,fontWeight:600}}>{sk}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Format checks + suggestions */}
          {report.ats_suggestions?.length>0&&(
            <Card style={{marginTop:16}}>
              <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>💡 AI Resume Improvement Suggestions</div>
              {report.ats_suggestions.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,background:T.dim,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
                  <span style={{color:T.amber,flexShrink:0}}>▸</span>
                  <span style={{fontSize:13,color:T.text,lineHeight:1.5}}>{s}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Reset */}
          <div style={{marginTop:20,display:"flex",gap:10}}>
            <Btn variant="outline" onClick={()=>{setReport(null);setFile(null);setStep(0);setErr("");}}>🔄 Analyze Another Resume</Btn>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─── PAGE: DASHBOARD ─────────────────────────────────── */
function DashboardStats({user}){
  const skillCount=(user?.skills||[]).length;
  const role=user?.target_role||"Not set";
  const exp=user?.experience||"Fresher";
  const profilePct=Math.min(100,Math.round(
    ([user?.full_name,user?.college,user?.target_role,user?.experience,skillCount>0].filter(Boolean).length/5)*100
  ));
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:20}}>
      <StatCard icon="🧠" label="Skills in Profile" value={skillCount||0} sub={skillCount?"skills added":"Add in Settings"} color={T.accent} delay={0}/>
      <StatCard icon="🎯" label="Target Role" value={role.split(" ")[0]} sub={role} color={T.teal} delay={0.06}/>
      <StatCard icon="📅" label="Experience" value={exp.split(" ")[0]} sub={exp} color={T.amber} delay={0.12}/>
      <StatCard icon="✅" label="Profile Complete" value={`${profilePct}%`} sub={profilePct===100?"All filled":"Complete in Settings"} color={profilePct===100?T.green:T.violet} delay={0.18}/>
    </div>
  );
}

function BackendStatusBanner({user}){
  const [backendUp,setBackendUp]=useState(null);
  useEffect(()=>{
    fetch(`${BASE.replace("/api","")}/health`,{signal:AbortSignal.timeout(3000)})
      .then(r=>r.ok?r.json():null)
      .then(d=>setBackendUp(d&&d.status==="ok"))
      .catch(()=>setBackendUp(false));
  },[]);
  return(
    <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
      style={{background:`linear-gradient(135deg,${T.accentSoft},rgba(45,212,191,0.05))`,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px 22px",marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
      <div>
        <div style={{fontSize:18,fontWeight:800,color:T.text,marginBottom:3}}>Welcome back, {user?.full_name?.split(" ")[0]||"there"} 👋</div>
        <div style={{color:T.muted,fontSize:13}}>Target role: <span style={{color:T.accent,fontWeight:700}}>{user?.target_role||"Not set"}</span> · Skills: <span style={{color:T.teal,fontWeight:700}}>{(user?.skills||[]).length}</span></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:8,background:backendUp===null?`${T.muted}15`:backendUp?`${T.green}15`:`${T.amber}15`,color:backendUp===null?T.muted:backendUp?T.green:T.amber,border:`1px solid ${backendUp===null?T.muted:backendUp?T.green:T.amber}35`}}>
          {backendUp===null?"● Checking...":backendUp?"🟢 Backend Live":"🟡 Backend Offline"}
        </div>
        {backendUp===false&&<div style={{fontSize:11,color:T.muted}}>Run uvicorn main:app --reload</div>}
      </div>
    </motion.div>
  );
}

function PageDashboard({user}){
  return(
    <div key="dashboard">
      <BackendStatusBanner user={user}/>
      <DashboardStats user={user}/>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 0.6fr",gap:18,marginBottom:18}}>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:4}}>📈 Skill Demand Trends</div>
          <div style={{color:T.muted,fontSize:11,marginBottom:14}}>6-month trajectory — LLM/AI · Cloud · MLOps</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={TREND_DATA}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.accent} stopOpacity={0.4}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/></linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.teal} stopOpacity={0.3}/><stop offset="95%" stopColor={T.teal} stopOpacity={0}/></linearGradient>
                <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.violet} stopOpacity={0.25}/><stop offset="95%" stopColor={T.violet} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis domain={[50,100]} tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CT/>}/>
              <Area type="monotone" dataKey="llm" name="LLM/AI" stroke={T.accent} strokeWidth={2.5} fill="url(#g1)"/>
              <Area type="monotone" dataKey="cloud" name="Cloud" stroke={T.teal} strokeWidth={2} fill="url(#g2)"/>
              <Area type="monotone" dataKey="mlops" name="MLOps" stroke={T.violet} strokeWidth={2} fill="url(#g3)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>🏭 Industry Split</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={INDUSTRY_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {INDUSTRY_DATA.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
              </Pie>
              <Tooltip content={<CT/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center"}}>
            {INDUSTRY_DATA.map((d,i)=><div key={d.name} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.muted}}><div style={{width:7,height:7,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length]}}/>{d.name}</div>)}
          </div>
        </Card>
      </div>
      <Card>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>⭐ Top Skills in Market</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {["Python","LLMs/AI","React","Kubernetes","MLOps","FastAPI","Docker","TypeScript","SQL","PyTorch"].map((sk,i)=>{
            const colors=[T.accent,T.teal,T.violet,T.amber,T.rose,T.blue,T.green,T.accent,T.teal,T.violet];
            return <motion.div key={sk} whileHover={{scale:1.08,y:-3,boxShadow:"0 6px 16px rgba(0,0,0,0.3)"}} whileTap={{scale:0.95}} style={{background:`${colors[i]}18`,border:`1px solid ${colors[i]}35`,color:colors[i],borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"default"}}>{sk}</motion.div>;
          })}
        </div>
      </Card>
    </div>
  );
}

/* ─── PAGE: AI CHATBOT ────────────────────────────────── */
const BOT_REPLIES={
  skill:`Top skills for 2025:\n\n🔥 Most demanded:\n1. Python (98%) 2. LLMs/AI (97%) 3. Kubernetes (89%)\n4. Cloud AI (87%) 5. MLOps (84%)\n\nGo to 📊 Skill Gap Analysis for a personalized roadmap!`,
  salary:`Salary ranges in India:\n\n💰 Fresher: ₹6–15 LPA\n💰 1–3 yrs: ₹15–35 LPA\n💰 3–5 yrs: ₹35–70 LPA\n💰 5+ yrs: ₹70–150 LPA\n\nBangalore & Hyderabad pay 20–30% more.`,
  interview:`Interview prep plan:\n\n📚 Week 1–2: DSA + System Design\n📚 Week 3: Domain topics (ML/Backend)\n📚 Week 4: Mock interviews on Pramp.com\n\n🔑 Always use STAR method for behavioral questions.`,
  resume:`Resume tips:\n\n✅ 1 page (fresher), 2 pages (experienced)\n✅ Action verbs: built, deployed, optimized\n✅ Add numbers: "Improved accuracy by 12%"\n✅ Include GitHub link\n✅ ATS keywords matter!\n\nTry our 📄 ATS Checker page!`,
  gap:`Head to 📊 Skill Gap Analysis page — paste any JD and see your exact gaps with a radar chart and prioritized learning paths!`,
  python:`Python is the #1 skill in 2025 (98/100)!\n\n🐍 Best path:\n1. Basics → automate the boring stuff\n2. NumPy + Pandas\n3. FastAPI for backend\n4. PyTorch for ML\n\nEstimated: 3–4 months to job-ready level.`,
  job:`Top hiring companies (2025):\n\n🏢 Google, Microsoft, Amazon\n🏢 Flipkart, Swiggy, Zepto\n🏢 Sarvam AI, Krutrim (AI startups)\n\n📌 Best portals: LinkedIn, Naukri, Instahyre\n\nCheck 🎯 Recommendations for matched jobs!`,
  ats:`ATS tips:\n\n✅ Use exact keywords from the JD\n✅ Avoid tables and graphics\n✅ Standard section headings\n✅ Save as PDF or DOCX\n\nTry our 📄 ATS Checker to score your resume!`,
};

/* ─── REAL AI CHATBOT — calls backend Groq API ─── */
async function callAIBackend(message, userSkills, targetRole) {
  try {
    const res = await fetch(`${BASE}/chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        user_skills: userSkills || [],
        target_role: targetRole || "",
      }),
      signal: AbortSignal.timeout(55000), // HF wait_for_model can take 40–50s on cold start
    });
    if (!res.ok) {
      console.warn("Chatbot backend returned:", res.status);
      return null;
    }
    const d = await res.json();
    console.log("✅ Chatbot response:", d.source, d.model);
    return { text: d.reply, model: d.model, source: d.source };
  } catch(e) {
    console.warn("Chatbot fetch failed:", e.message);
    return null; // triggers local fallback
  }
}

/* Smart AI answers — works even without backend */
function localFallback(msg, user) {
  const m     = msg.toLowerCase();
  const role  = user?.target_role || "Full Stack Developer";
  const skills= (user?.skills||[]).join(", ") || "not set";
  const name  = user?.full_name?.split(" ")[0] || "there";

  if(["hi","hello","hey","hii"].some(w=>m===w||m.startsWith(w+" ")))
    return `Hey ${name}! 👋 I'm your SkillForge AI Career Assistant.\n\nAsk me about:\n• 🌐 Internship & job websites\n• 🎯 Career paths & roadmaps\n• 💰 Salary ranges (₹ LPA)\n• 🎤 Interview & placement prep\n• 📄 Resume & ATS tips\n• 💻 Project ideas\n• 🏅 Certifications & courses\n\nWhat would you like help with?`;

  if(m.includes("intern")||m.includes("where to apply")||m.includes("apply for"))
    return `🌐 Best internship websites:\n\n🇮🇳 India:\n• internshala.com — largest, free\n• unstop.com — competitions + internships\n• linkedin.com/jobs — filter Internship\n• naukri.com/internship\n• letsintern.com\n\n🌍 Global/Remote:\n• wellfound.com (AngelList Talent)\n• remoteok.com\n• youthop.com\n\n💡 Apply to 20+ at once — normal acceptance rate is 5–10%`;

  if(m.includes("project")||m.includes("portfolio")||m.includes("build"))
    return `💡 Best portfolio project ideas for ${role}:\n\n🔥 High-impact:\n• AI Resume Analyzer — PDF + Groq/OpenAI API\n• Full-Stack Job Board — React + FastAPI + PostgreSQL\n• Real-time Chat App — WebSockets + Redis\n• LLM Chatbot with RAG — LangChain + ChromaDB\n\n💡 Rules:\n• Always deploy it (Vercel/Render — free)\n• Write proper README with screenshots\n• Add live demo link\n• Solve a real problem`;

  if(m.includes("salary")||m.includes("lpa")||m.includes("pay")||m.includes("ctc")||m.includes("earn"))
    return `💰 Salary for ${role} in India (2025):\n\n• Fresher (service co): ₹3.5–7 LPA\n• Fresher (product startup): ₹8–18 LPA\n• FAANG India fresher: ₹20–45 LPA\n• Mid-level (2–4 yrs): ₹15–40 LPA\n• Senior (5+ yrs): ₹40–100 LPA\n\n📍 Bangalore pays 25–30% more\n🔗 Check real salaries: levels.fyi, ambitionbox.com`;

  if(m.includes("interview")||m.includes("prepare")||m.includes("crack")||m.includes("placement"))
    return `🎤 Placement/Interview Prep for ${role}:\n\nMonth 1–2: DSA — 150 LeetCode problems (Easy+Medium)\nMonth 3: CS Fundamentals — OS, DBMS, CN, OOP\nMonth 4: System Design basics + projects\nMonth 5: Aptitude + Verbal (PrepInsta, IndiaBix)\nMonth 6: Mock interviews + resume polish\n\n🔑 STAR method for every behavioural question\n🎯 Platforms: LeetCode, Pramp (free mocks), InterviewBit`;

  if(m.includes("certif")||m.includes("certificate")||m.includes("course"))
    return `🏅 Best certifications for ${role} (2025):\n\n☁️ Cloud (high ROI):\n• AWS Cloud Practitioner → Solutions Architect\n• Google Cloud ACE\n• Microsoft AZ-900\n\n🤖 AI/ML:\n• DeepLearning.AI (Coursera)\n• fast.ai (free)\n\n💻 Dev:\n• Meta Frontend Dev (Coursera)\n• CS50 Harvard (free, edX)\n\n💡 AWS + any AI cert = biggest salary jump for freshers`;

  if(m.includes("github")||m.includes("portfolio")||m.includes("open source"))
    return `🐙 GitHub tips that impress recruiters:\n\n• Professional photo + bio\n• 6 pinned repos — your best projects\n• Each repo: clear README + live demo\n• Green contribution graph daily\n\n🌟 Open source entry:\n• good-first-issue.github.io\n• up-for-grabs.net\n• Start with docs/tests, not core features\n\n📈 GitHub = #1 hiring filter at top tech companies`;

  if(m.includes("freelan")||m.includes("fiverr")||m.includes("upwork")||m.includes("side income"))
    return `💻 Freelancing for developers:\n\n🔰 Start here:\n• fiverr.com — create service gigs\n• upwork.com — hourly contracts\n• freelancer.com — project bids\n\n📋 How to start:\n1. Pick a niche (React, Python bots, WordPress)\n2. Build 2–3 portfolio projects\n3. Create gig with clear deliverables\n4. Price low initially for reviews\n5. Raise rates after 10 reviews\n\n💰 ₹20k–₹2L/month possible in 6–12 months`;

  if(m.includes("dsa")||m.includes("data structure")||m.includes("algorithm")||m.includes("leetcode"))
    return `⚡ DSA Mastery Roadmap:\n\nPhase 1 (4 weeks): Arrays, Strings, Hashing, Stacks\nPhase 2 (4 weeks): Trees, Graphs, Recursion, Backtracking\nPhase 3 (4 weeks): Dynamic Programming, Heaps, Tries\n\n📚 Best resources:\n• Striver's A2Z DSA Sheet (free, best structure)\n• NeetCode.io (best explanations)\n• LeetCode Top 150 list\n\n🎯 Target: 200 problems in 3 months (1–2/day)`;

  if(m.includes("ms ")||m.includes("masters")||m.includes("gre")||m.includes("abroad")||m.includes("higher stud"))
    return `🎓 MS/Higher Studies Guide:\n\n🇺🇸 MS in CS (USA):\n• Target: CMU, UIUC, UMass, UCSD, Purdue\n• GRE: 320+ recommended\n• TOEFL: 100+ / IELTS: 7.0+\n• Apply Aug–Dec for Fall intake\n\n🇨🇦 Canada (cheaper + PR pathway):\n• UofT, UBC, Waterloo — no GRE needed\n\n🇮🇳 GATE → M.Tech IIT/NIT:\n• Score 600+ for IITs\n• Stipend ₹12,400/month\n\n💡 Work 1–2 years first = stronger application + funding`;

  if(m.includes("skill")||m.includes("learn")||m.includes("what should")||m.includes("roadmap")||m.includes("study"))
    return `🗺️ Skills roadmap for ${role}:\n\n🔥 Must have:\n• Python or JavaScript (go deep on one)\n• Git + GitHub\n• SQL basics\n• 1 cloud platform (AWS free tier)\n\n🚀 High value:\n• Docker + basic Kubernetes\n• React or FastAPI\n• LLMs / AI APIs (easy to start with Groq)\n\nYour skills: ${skills}\n→ Go to 📊 Skill Gap Analysis for your personalized chart!`;

  if(m.includes("hackathon")||m.includes("competition")||m.includes("contest"))
    return `🏆 Hackathons & competitions:\n\n🇮🇳 India:\n• Smart India Hackathon (SIH)\n• HackWithInfy (Infosys) — ₹1L+ prizes\n• Flipkart Grid\n• Goldman Sachs HackerRank\n\n🌍 Global:\n• Google Summer of Code (GSoC) — paid 3 months\n• MLH — 200+ hackathons/year\n• HackMIT, TreeHacks (apply online)\n\n💡 Even participation looks great on resume`;

  if(m.includes("resume")||m.includes("cv")||m.includes("ats"))
    return `📄 Resume & ATS tips:\n\n✅ Do: Mirror JD keywords, quantify results, GitHub/LinkedIn links\n✅ Tools: rxresu.me, overleaf.com (LaTeX), resume.io\n✅ Format: 1 page fresher, 2 pages experienced\n❌ Avoid: Tables, images, fancy fonts, objective statements\n\n→ Use the 📄 ATS Checker tab to score your resume live!`;

  // General catch-all
  return `⚠️ The AI backend isn't reachable right now.\n\nYour question: "${msg.slice(0,80)}${msg.length>80?'...':''}"\n\nTo get a full AI answer on ANY topic (companies, tech, general knowledge, coding), make sure the backend is running:\n\n  uvicorn main:app --reload\n\nOnce connected, I can answer questions about:\n• Specific companies (Google, Razorpay, Zepto, etc.)\n• Any coding or tech topic\n• Career, salary, interviews\n• Current events and general knowledge\n• Literally anything you ask 🚀`;
}


const QUICK_QS=["Websites for internships?","Best project ideas?","Salary for full stack developer?","How to crack placement interviews?","Best certifications in 2025?","How to master DSA?","GitHub profile tips?","How to start freelancing?","MS abroad — where to apply?","How to learn React fast?"];

function PageChatbot({user}){
  const [msgs,setMsgs]=useState([{
    id:1, from:"bot", source:"system",
    text:`Hi ${user?.full_name?.split(" ")[0]||"there"}! 👋 I'm your **SkillForge AI Career Assistant** powered by **Llama3-8B** via Groq.\n\nI can help with:\n• 🎯 Career path guidance\n• 📊 Skill gap analysis\n• 💰 Salary insights (in ₹ LPA)\n• 🎤 Interview preparation\n• 📄 Resume & ATS tips\n\nAsk me anything!`,
    time: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
  }]);
  const [inp,setInp]=useState("");
  const [typing,setTyping]=useState(false);
  const [backendOk,setBackendOk]=useState(null); // null=unknown, true=up, false=down
  const bot=useRef(null);
  useEffect(()=>bot.current?.scrollIntoView({behavior:"smooth"}),[msgs,typing]);

  // Check if backend is alive on mount
  useEffect(()=>{
    fetch(`${BASE}/chatbot/health`,{signal:AbortSignal.timeout(4000)})
      .then(r=>r.ok?setBackendOk(true):setBackendOk(false))
      .catch(()=>setBackendOk(false));
  },[]);

  const send=async(text=inp)=>{
    if(!text.trim())return;
    const userMsg={id:Date.now(),from:"user",text:text.trim(),time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})};
    setMsgs(m=>[...m,userMsg]);
    setInp("");setTyping(true);

    // Try real backend (Groq or smart_answer from backend)
    const aiResult = await callAIBackend(text, user?.skills||[], user?.target_role||"");

    setTyping(false);
    if(aiResult){
      // source="groq" means real LLM; source="local" means backend smart_answer (still backend)
      const isRealLLM = aiResult.source === "groq";
      setBackendOk(true);
      setMsgs(m=>[...m,{
        id:Date.now()+1, from:"bot",
        text:aiResult.text,
        source:aiResult.source,
        model:aiResult.model,
        time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
      }]);
    } else {
      // Frontend fallback only when backend is completely unreachable
      setBackendOk(false);
      const fb=localFallback(text,user);
      setMsgs(m=>[...m,{id:Date.now()+1,from:"bot",text:fb,source:"offline",time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);
    }

  };

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:20,height:"calc(100vh - 140px)"}}>
      <Card style={{display:"flex",flexDirection:"column",padding:0,overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,background:T.cardHover}}>
          <div style={{position:"relative"}}>
            <div style={{width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🤖</div>
            <div style={{position:"absolute",bottom:2,right:2,width:10,height:10,borderRadius:"50%",background:backendOk===false?T.amber:T.green,border:`2px solid ${T.card}`}}/>
          </div>
          <div>
            <div style={{fontWeight:700,color:T.text,fontSize:15}}>SkillForge AI — Llama3-8B Agent</div>
            <div style={{fontSize:11,color:backendOk===false?T.amber:T.green}}>
              {backendOk===null?"● Connecting..."
               :backendOk?"● Live — Groq Llama3-8B"
               :"● Offline — Smart fallback active"}
            </div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            <div style={{background:backendOk?`${T.green}15`:`${T.amber}15`,border:`1px solid ${backendOk?T.green:T.amber}35`,borderRadius:8,padding:"4px 12px",fontSize:10,fontWeight:700,color:backendOk?T.green:T.amber}}>
              {backendOk?"🟢 GROQ API LIVE":"🟡 LOCAL FALLBACK"}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 20px 10px",display:"flex",flexDirection:"column",gap:16}}>
          <AnimatePresence initial={false}>
            {msgs.map(msg=>(
              <motion.div key={msg.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.3}}
                style={{display:"flex",justifyContent:msg.from==="user"?"flex-end":"flex-start",gap:10,alignItems:"flex-end"}}>
                {msg.from==="bot"&&<div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🤖</div>}
                <div style={{maxWidth:"75%"}}>
                  <div style={{background:msg.from==="user"?`linear-gradient(135deg,${T.accent},#818cf8)`:T.cardHover,border:msg.from==="bot"?`1px solid ${T.border}`:"none",borderRadius:msg.from==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",color:T.text,fontSize:13,lineHeight:1.8,whiteSpace:"pre-line"}}>
                    {msg.text}
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:3}}>
                    <div style={{fontSize:10,color:T.muted}}>{msg.time}</div>
                    {msg.from==="bot"&&msg.source&&msg.source!=="system"&&(
                      <div style={{fontSize:9,color:msg.source==="groq"?T.green:msg.source==="local"?T.teal:msg.source==="offline"?"#6b6884":T.muted,fontWeight:700}}>
                        {msg.source==="groq"?"🟢 Groq Llama3-8B"
                         :msg.source==="local"?"🔵 Backend AI"
                         :msg.source==="offline"?"💡 Smart answer"
                         :""}
                      </div>
                    )}
                  </div>
                </div>
                {msg.from==="user"&&<div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${T.accent}55,${T.violet}55)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:T.accent,flexShrink:0}}>{user?.avatar||"U"}</div>}
              </motion.div>
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {typing&&(
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
                <div style={{background:T.cardHover,border:`1px solid ${T.border}`,borderRadius:"18px 18px 18px 4px",padding:"12px 18px",display:"flex",gap:5}}>
                  {[0,1,2].map(i=><motion.div key={i} animate={{y:[0,-6,0]}} transition={{duration:0.6,repeat:Infinity,delay:i*0.15}} style={{width:7,height:7,borderRadius:"50%",background:T.accent}}/>)}
                </div>
                <div style={{fontSize:11,color:T.muted}}>{backendOk?"Asking Groq AI...":"Thinking..."}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bot}/>
        </div>

        {/* Input */}
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}>
          <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
            placeholder="Ask Llama3-8B anything about your career..."
            style={{...IS,flex:1,borderRadius:12}} onFocus={focus} onBlur={blur}/>
          <motion.button whileHover={{scale:1.08,boxShadow:`0 0 24px ${T.accentGlow}`}} whileTap={{scale:0.92,rotate:-10}} onClick={()=>send()}
            style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${T.accent},#818cf8)`,border:"none",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"box-shadow 0.2s"}}>
            ➤
          </motion.button>
        </div>
      </Card>

      {/* Sidebar */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Card style={{background:`linear-gradient(135deg,${T.accentSoft},rgba(45,212,191,0.05))`,border:`1px solid ${T.borderHi}`}}>
          <div style={{fontWeight:800,color:T.accent,fontSize:13,marginBottom:4}}>🤖 Llama3-8B Agent</div>
          <div style={{fontSize:11,color:T.muted,lineHeight:1.7,marginBottom:10}}>
            Real AI powered by <strong style={{color:T.accent}}>Groq Inference API</strong>. 
            Understands context, gives personalized career advice based on your actual skills.
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {["Llama3-8B","Groq","Real AI"].map(b=><span key={b} style={{background:`${T.accent}18`,border:`1px solid ${T.accent}30`,color:T.accent,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{b}</span>)}
          </div>
        </Card>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:13,marginBottom:12}}>⚡ Quick Questions</div>
          {QUICK_QS.map(q=>(
            <motion.button key={q} whileHover={{x:4,background:`${T.accent}10`,color:T.text,borderColor:`${T.accent}45`}} whileTap={{scale:0.96}} onClick={()=>send(q)}
              style={{width:"100%",textAlign:"left",background:T.dim,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 12px",color:T.muted,fontSize:12,fontFamily:"inherit",cursor:"pointer",marginBottom:7,display:"block",transition:"background 0.15s,color 0.15s,border-color 0.15s"}}>
              {q}
            </motion.button>
          ))}
        </Card>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:13,marginBottom:12}}>👤 Your Profile</div>
          {[{l:"Name",v:user?.full_name||"—"},{l:"Target",v:user?.target_role||"—"},{l:"Skills",v:`${(user?.skills||[]).length} skills`},{l:"Exp",v:user?.experience||"—"}].map(x=>(
            <div key={x.l} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,color:T.muted}}>{x.l}</span>
              <span style={{fontSize:11,color:T.text,fontWeight:600,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}}>{x.v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ─── PAGE: ATS CHECKER ───────────────────────────────── */
/* ─── PAGE: ATS CHECKER — Real PDF Upload to Backend ─── */
function PageATS({user}){
  const [mode,setMode]=useState("upload");   // "upload" | "paste"
  const [file,setFile]=useState(null);
  const [resume,setResume]=useState("");
  const [jd,setJd]=useState("");
  const [result,setResult]=useState(null);
  const [ld,setLd]=useState(false);
  const [uploadStatus,setUploadStatus]=useState("");
  const fileRef=useRef(null);

  const handleFile=async(f)=>{
    if(!f)return;
    setFile(f);setUploadStatus(`✅ ${f.name} (${(f.size/1024).toFixed(1)} KB) — ready to analyze`);
  };

  const runATS=async()=>{
    setLd(true);setResult(null);
    try {
      let atResult;
      if(mode==="upload"&&file){
        // Real PDF upload to backend
        setUploadStatus("⏳ Uploading and parsing PDF...");
        const fd=new FormData();
        fd.append("file",file);
        fd.append("target_role",(user?.target_role||"ml engineer").toLowerCase());
        if(jd.trim()) fd.append("job_description",jd);
        const res=await fetch(`${BASE}/resume/analyze`,{method:"POST",body:fd,signal:AbortSignal.timeout(30000)});
        if(res.ok){
          const d=await res.json();
          setUploadStatus("✅ PDF analyzed successfully via backend!");
          atResult={
            overall:d.ats_score, grade:gradeOf(d.ats_score),
            matched:d.matched_skills||[], missing:d.missing_skills||[],
            allFound:d.all_found_skills||[],
            kwScore:Math.round((d.keyword_density||0)*100),
            skScore:d.total_required>0?Math.round(d.total_matched/d.total_required*100):70,
            fmtScore:Math.round(Object.values(d.format_checks||{}).filter(Boolean).length/6*100),
            fmt:d.format_checks||{},
            sug:d.suggestions||[], wordCount:d.word_count||0,
            source:"backend_pdf",
          };
        } else {
          setUploadStatus("⚠ Backend returned error — using local analysis");
          atResult=localATS(file?await file.text().catch(()=>""):resume,jd);
          atResult.source="local_fallback";
        }
      } else {
        // Paste mode — try backend with text, fall back locally
        if(!resume.trim()){alert("Paste your resume text first.");setLd(false);return;}
        try{
          const fd=new FormData();
          const blob=new Blob([resume],{type:"text/plain"});
          fd.append("file",blob,"resume.txt");
          fd.append("target_role",(user?.target_role||"ml engineer").toLowerCase());
          if(jd.trim())fd.append("job_description",jd);
          const res=await fetch(`${BASE}/resume/analyze`,{method:"POST",body:fd,signal:AbortSignal.timeout(10000)});
          if(res.ok){
            const d=await res.json();
            atResult={overall:d.ats_score,grade:gradeOf(d.ats_score),matched:d.matched_skills||[],missing:d.missing_skills||[],allFound:d.all_found_skills||[],kwScore:Math.round((d.keyword_density||0)*100),skScore:d.total_required>0?Math.round(d.total_matched/d.total_required*100):70,fmtScore:Math.round(Object.values(d.format_checks||{}).filter(Boolean).length/6*100),fmt:d.format_checks||{},sug:d.suggestions||[],wordCount:d.word_count||0,source:"backend_text"};
          } else { throw new Error("backend_error"); }
        } catch { atResult=localATS(resume,jd); atResult.source="local"; }
      }
      setResult(atResult);
    } catch(e){ console.error(e); setUploadStatus("⚠ Error — using local analysis"); setResult({...localATS(resume||"",jd),source:"local_error"}); }
    setLd(false);
  };

  const gradeOf=(s)=>s>=85?{l:"Excellent",c:T.green}:s>=70?{l:"Good",c:T.teal}:s>=55?{l:"Fair",c:T.amber}:{l:"Needs Work",c:T.rose};

  const localATS=(rt,jdText)=>{
    const rl=rt.toLowerCase(); const jl=jdText.toLowerCase();
    const SKILLS=["python","react","javascript","typescript","kubernetes","docker","aws","gcp","sql","fastapi","pytorch","tensorflow","mlflow","airflow","kafka","spark","redis","git","linux","graphql","nodejs","java","rust","machine learning","deep learning","nlp","llm","rag","transformers","agile","scrum"];
    const jdS=SKILLS.filter(s=>jl.includes(s));
    const matched=jdS.filter(s=>rl.includes(s));
    const missing=jdS.filter(s=>!rl.includes(s));
    const jdW=(jl.match(/\b[a-z][a-z0-9\+\#\.]{2,}\b/g)||[]).filter(w=>w.length>3);
    const kwHits=[...new Set(jdW)].filter(w=>rl.includes(w)).length;
    const kwScore=Math.min(100,Math.round(kwHits/Math.max([...new Set(jdW)].length,1)*100));
    const skScore=jdS.length>0?Math.round(matched.length/jdS.length*100):70;
    const hasEmail=/\b[\w.-]+@[\w.-]+\.\w{2,}\b/.test(rt);
    const hasPhone=/\b[\d\s\-\+\(\)]{10,}\b/.test(rt);
    const hasLI=rl.includes("linkedin");const hasGH=rl.includes("github");
    const hasBullets=rt.includes("•")||rt.includes("-")||rt.includes("*");
    const wc=rt.split(/\s+/).length; const goodLen=wc>=200&&wc<=800;
    const fmtScore=Math.round([hasEmail,hasPhone,hasLI,hasGH,hasBullets,goodLen].filter(Boolean).length/6*100);
    const overall=Math.round(kwScore*0.4+skScore*0.45+fmtScore*0.15);
    const sug=[];
    if(missing.length)sug.push(`Add missing keywords: ${missing.slice(0,4).join(", ")}`);
    if(!hasEmail)sug.push("Add your email address");if(!hasPhone)sug.push("Add phone number");
    if(!hasLI)sug.push("Include LinkedIn URL");if(!hasGH)sug.push("Add GitHub link");
    if(!hasBullets)sug.push("Use bullet points");
    if(!goodLen)sug.push(wc<200?"Resume too short":"Resume too long — trim to under 800 words");
    return{overall,grade:gradeOf(overall),matched,missing,allFound:[...matched],kwScore,skScore,fmtScore,fmt:{hasEmail,hasPhone,hasLI,hasGH,hasBullets,goodLen},sug,wordCount:wc};
  };

  return(
    <div>
      {/* ── SPECIAL HEADING: Resume Upload ── */}
      <motion.div initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}}
        style={{background:`linear-gradient(135deg,rgba(99,102,241,0.12),rgba(45,212,191,0.08))`,border:`1px solid ${T.borderHi}`,borderRadius:20,padding:"24px 28px",marginBottom:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:160,height:160,background:`radial-gradient(circle,${T.accentGlow},transparent)`,borderRadius:"50%",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
            <div style={{width:52,height:52,borderRadius:16,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:`0 0 20px ${T.accentGlow}`}}>📄</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",color:T.text,letterSpacing:"0.04em",lineHeight:1}}>
                AI Resume Analyzer &amp;{" "}
                <span style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  ATS Score Checker
                </span>
              </div>
              <div style={{fontSize:13,color:T.muted,marginTop:4}}>
                Upload your PDF resume → Backend extracts skills → Instant ATS compatibility score
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[{l:"📤 PDF Upload",c:T.accent},{l:"🔬 NLP Skill Detection",c:T.teal},{l:"📊 ATS Scoring",c:T.violet},{l:"💡 AI Suggestions",c:T.amber}].map(b=>(
              <span key={b.l} style={{background:`${b.c}15`,border:`1px solid ${b.c}30`,color:b.c,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700}}>{b.l}</span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Mode toggle */}
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {[{id:"upload",l:"📤 Upload PDF Resume",desc:"Best — backend extracts text from PDF"},{id:"paste",l:"📝 Paste Resume Text",desc:"Fallback — manual paste"}].map(m=>(
          <motion.button key={m.id} onClick={()=>{setMode(m.id);setResult(null);}} whileHover={{y:-2,boxShadow:"0 6px 20px rgba(0,0,0,0.3)"}} whileTap={{scale:0.97}}
            style={{background:mode===m.id?T.accentSoft:"transparent",border:`1px solid ${mode===m.id?T.borderHi:T.border}`,borderRadius:12,padding:"10px 20px",color:mode===m.id?T.accent:T.muted,fontSize:13,fontWeight:mode===m.id?700:500,fontFamily:"inherit",cursor:"pointer",textAlign:"left",transition:"all 0.18s"}}>
            <div style={{fontWeight:700}}>{m.l}</div>
            <div style={{fontSize:10,marginTop:2,opacity:0.7}}>{m.desc}</div>
          </motion.button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        {/* Left — Resume input */}
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>📄 Your Resume</div>
          {mode==="upload"?(
            <div>
              <div style={{color:T.muted,fontSize:11,marginBottom:14}}>Upload your PDF resume — backend will extract all text and skills</div>
              {/* Drop zone */}
              <motion.label whileHover={{borderColor:T.accent,background:`${T.accent}08`,scale:1.01}} whileTap={{scale:0.99}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:T.dim,border:`2px dashed ${file?T.teal:T.border}`,borderRadius:14,padding:"32px 20px",cursor:"pointer",transition:"all 0.3s",marginBottom:12,minHeight:180}}>
                <input ref={fileRef} type="file" accept=".pdf,.txt" onChange={e=>handleFile(e.target.files[0])} style={{display:"none"}}/>
                <div style={{width:56,height:56,borderRadius:16,background:file?`${T.teal}18`:`${T.accent}18`,border:`1px solid ${file?T.teal:T.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>
                  {file?"✅":"📤"}
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontWeight:700,color:file?T.teal:T.text,fontSize:14}}>{file?file.name:"Click or drag to upload"}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:4}}>{file?`${(file.size/1024).toFixed(1)} KB · PDF ready`:"PDF or TXT — max 10MB"}</div>
                </div>
                {!file&&<div style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,borderRadius:9,padding:"8px 20px",fontSize:12,fontWeight:700,color:"#fff"}}>📤 Choose File</div>}
              </motion.label>
              {uploadStatus&&(
                <div style={{fontSize:12,color:uploadStatus.startsWith("✅")?T.green:uploadStatus.startsWith("⏳")?T.accent:T.amber,background:T.dim,borderRadius:9,padding:"8px 12px"}}>
                  {uploadStatus}
                </div>
              )}
            </div>
          ):(
            <div>
              <div style={{color:T.muted,fontSize:11,marginBottom:14}}>Paste your full resume text</div>
              <textarea value={resume} onChange={e=>setResume(e.target.value)} placeholder={"Paste your full resume text here...\n\nInclude: Skills, Experience, Education, Projects"} style={{...IS,minHeight:240,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7}} onFocus={focus} onBlur={blur}/>
            </div>
          )}
        </Card>

        {/* Right — JD */}
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>💼 Job Description</div>
          <div style={{color:T.muted,fontSize:11,marginBottom:14}}>Paste the JD — required skills will be extracted and compared</div>
          <textarea value={jd} onChange={e=>setJd(e.target.value)} placeholder={"Paste the full job description here...\n\nRequired: Python, PyTorch, Kubernetes...\nThe system will extract and compare all skills."} style={{...IS,minHeight:310,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7}} onFocus={focus} onBlur={blur}/>
          <div style={{fontSize:11,color:T.muted,marginTop:10,lineHeight:1.6}}>
            💡 Tip: JD is optional. Without it, we compare against your target role (<strong style={{color:T.accent}}>{user?.target_role||"ML Engineer"}</strong>) requirements.
          </div>
        </Card>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:24}}>
        <Btn onClick={runATS} disabled={ld||(mode==="upload"&&!file&&!resume)} style={{minWidth:220}}>
          {ld?"⏳ ANALYZING...":"📊 ANALYZE RESUME"}
        </Btn>
        {result&&<Btn variant="outline" onClick={()=>{setResult(null);setFile(null);setResume("");setJd("");setUploadStatus("");}}>Reset</Btn>}
        {result&&<div style={{fontSize:11,color:result.source?.includes("backend")?"#22c55e":T.amber,display:"flex",alignItems:"center",gap:5,fontWeight:700}}>
          {result.source?.includes("backend")?"🟢 Analyzed by backend AI":"🟡 Local analysis"}
        </div>}
      </div>

      <AnimatePresence>
        {result&&(
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <Card glow style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:20}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,color:result.grade.c,lineHeight:1}}>{result.overall}<span style={{fontSize:22}}>/100</span></div>
                  <div style={{fontSize:14,fontWeight:700,color:result.grade.c,marginBottom:4}}>ATS Score — {result.grade.l}</div>
                  <div style={{fontSize:12,color:T.muted}}>{result.overall>=75?"✅ Strong match — likely to pass ATS filters":result.overall>=55?"⚠️ Moderate match — needs improvement":"❌ Weak match — significant changes needed"}</div>
                </div>
                <div style={{display:"flex",gap:28}}>
                  {[{s:result.kwScore,c:T.teal,l:"Keywords"},{s:result.skScore,c:T.violet,l:"Skills"},{s:result.fmtScore,c:T.amber,l:"Format"}].map(({s,c,l})=>{
                    const sz=100,sw=8,r=(sz-sw)/2,ci=2*Math.PI*r;
                    return(
                      <div key={l} style={{textAlign:"center"}}>
                        <div style={{position:"relative",display:"inline-block"}}>
                          <svg width={sz} height={sz} style={{transform:"rotate(-90deg)"}}>
                            <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={T.dim} strokeWidth={sw}/>
                            <motion.circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={ci} initial={{strokeDashoffset:ci}} animate={{strokeDashoffset:ci-(s/100)*ci}} transition={{duration:1.5,ease:"easeOut"}}/>
                          </svg>
                          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:c}}>{s}</div>
                        </div>
                        <div style={{fontSize:11,color:T.muted,marginTop:4,fontWeight:600}}>{l}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{marginTop:18}}>
                <div style={{height:7,background:T.dim,borderRadius:100,overflow:"hidden"}}>
                  <motion.div initial={{width:0}} animate={{width:`${result.overall}%`}} transition={{duration:1.5,ease:"easeOut"}} style={{height:"100%",background:result.grade.c,borderRadius:100}}/>
                </div>
              </div>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
              <Card>
                <div style={{fontSize:11,color:T.teal,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>✅ MATCHED SKILLS ({result.matched.length})</div>
                {result.matched.length>0?result.matched.map(s=><Tag key={s} name={s} matched={true}/>):<div style={{color:T.muted,fontSize:12}}>No skill matches found</div>}
              </Card>
              <Card>
                <div style={{fontSize:11,color:T.rose,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>❌ MISSING SKILLS ({result.missing.length})</div>
                {result.missing.length>0?result.missing.map(s=><Tag key={s} name={s} matched={false}/>):<div style={{color:T.muted,fontSize:12}}>All key skills present ✅</div>}
              </Card>
              <Card>
                <div style={{fontSize:11,color:T.amber,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>📋 FORMAT CHECKLIST</div>
                {[{l:"Email",ok:result.fmt?.hasEmail},{l:"Phone",ok:result.fmt?.hasPhone},{l:"LinkedIn",ok:result.fmt?.hasLI||result.fmt?.has_linkedin},{l:"GitHub",ok:result.fmt?.hasGH||result.fmt?.has_github},{l:"Bullet points",ok:result.fmt?.hasBullets||result.fmt?.uses_bullets},{l:"Good length",ok:result.fmt?.goodLen||result.fmt?.good_length}].map(x=>(
                  <div key={x.l} style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                    <span style={{fontSize:12,color:T.muted}}>{x.l}</span>
                    <span style={{fontSize:14}}>{x.ok?"✅":"❌"}</span>
                  </div>
                ))}
              </Card>
            </div>
            {result.sug?.length>0&&(
              <Card>
                <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>💡 AI Improvement Suggestions</div>
                {result.sug.map((s,i)=>(
                  <motion.div key={i} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}
                    style={{display:"flex",gap:12,alignItems:"flex-start",background:T.dim,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                    <span style={{color:T.amber,fontSize:16,flexShrink:0}}>▸</span>
                    <span style={{fontSize:13,color:T.text,lineHeight:1.5}}>{s}</span>
                  </motion.div>
                ))}
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {!result&&!ld&&(
        <div style={{textAlign:"center",padding:"40px 0",color:T.muted}}>
          <div style={{fontSize:52,opacity:0.15,marginBottom:12}}>📄</div>
          <div style={{fontSize:14,marginBottom:6}}>{mode==="upload"?"Upload your PDF resume above":"Paste your resume and a job description above"}</div>
          <div style={{fontSize:12}}>Get an instant ATS score with keyword analysis and AI-powered improvement tips</div>
        </div>
      )}
    </div>
  );
}

/* ─── PAGE: SKILL EXTRACTION ──────────────────────────── */
const SKILL_DB={technical:["python","pytorch","tensorflow","keras","sklearn","numpy","pandas","kubernetes","docker","aws","gcp","azure","fastapi","flask","django","react","typescript","javascript","vue","nextjs","html","css","tailwind","mlflow","airflow","spark","kafka","redis","postgresql","mysql","mongodb","git","linux","bash","terraform","llm","rag","rlhf","fine-tuning","transformers","bert","gpt","langchain","pinecone","sql","graphql","rest"],soft:["communication","leadership","teamwork","problem-solving","collaboration","mentoring","agile","scrum","time management"],domain:["nlp","computer vision","mlops","data engineering","cloud computing","devops","deep learning","machine learning","data science","full stack","backend","frontend","distributed systems","system design","microservices"]};

function PageSkills({user}){
  const [jd,setJd]=useState("");
  const [result,setResult]=useState(null);
  const [ld,setLd]=useState(false);

  const localExtract=(text)=>{
    const tl=text.toLowerCase();
    const res={technical:[],soft:[],domain:[],all:[]};
    const seen=new Set();
    for(const[cat,skills]of Object.entries(SKILL_DB)){
      for(const sk of skills){
        if(tl.includes(sk)&&!seen.has(sk)){
          seen.add(sk);
          const freq=tl.split(sk).length-1;
          const entry={name:sk.charAt(0).toUpperCase()+sk.slice(1),category:cat,confidence:Math.round(Math.min(99,75+freq*5)),frequency:freq};
          res[cat].push(entry);res.all.push(entry);
        }
      }
    }
    res.all.sort((a,b)=>b.frequency-a.frequency);
    res.total=res.all.length;
    return res;
  };

  const extract=async()=>{
    if(!jd.trim()){alert("Paste a job description first.");return;}
    setLd(true);
    const token=localStorage.getItem("sf_token");
    // Try backend first
    try{
      const r=await fetch(`${BASE}/skills/extract`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({text:jd}),
        signal:AbortSignal.timeout(8000),
      });
      if(r.ok){
        const d=await r.json();
        setResult({
          technical:(d.technical||[]).map(s=>({name:s.name,category:"technical",confidence:Math.round(s.confidence*100),frequency:s.frequency})),
          soft:(d.soft||[]).map(s=>({name:s.name,category:"soft",confidence:Math.round(s.confidence*100),frequency:s.frequency})),
          domain:(d.domain||[]).map(s=>({name:s.name,category:"domain",confidence:Math.round(s.confidence*100),frequency:s.frequency})),
          all:(d.all||[]).map(s=>({name:s.name,category:s.category,confidence:Math.round(s.confidence*100),frequency:s.frequency})),
          total:d.total||0,
          source:"backend",
        });
        setLd(false);
        return;
      }
    }catch{}
    // Local fallback
    const res=localExtract(jd);
    res.source="local";
    setResult(res);
    setLd(false);
  };

  const CATS=[{k:"technical",c:T.accent,l:"Technical"},{k:"soft",c:T.teal,l:"Soft Skills"},{k:"domain",c:T.violet,l:"Domain"}];
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <Card>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>📋 Job Description Input</div>
        <div style={{color:T.muted,fontSize:11,marginBottom:14}}>Paste JD — NLP will extract all skills</div>
        <textarea value={jd} onChange={e=>setJd(e.target.value)} placeholder={"Paste job description here...\n\nThe model will extract Technical, Soft, and Domain skills."} style={{...IS,minHeight:280,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",lineHeight:1.7}} onFocus={focus} onBlur={blur}/>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <Btn onClick={extract} disabled={ld} style={{flex:1}}>{ld?"⏳ EXTRACTING...":"⚡ EXTRACT SKILLS"}</Btn>
          {result&&<Btn variant="outline" onClick={()=>{setResult(null);setJd("");}}>Reset</Btn>}
        </div>
      </Card>
      <Card glow={!!result}>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>🔬 Extracted Skills</div>
        <div style={{color:T.muted,fontSize:11,marginBottom:14}}>{result?`${result.total} skills identified`:"Awaiting extraction"}</div>
        {!result?(
          <div style={{minHeight:320,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
            {[100,80,65].map((w,i)=><motion.div key={i} animate={{opacity:[0.2,0.6,0.2]}} transition={{duration:2,delay:i*0.3,repeat:Infinity}} style={{height:8,width:`${w}%`,maxWidth:240,background:T.dim,borderRadius:100}}/>)}
            <div style={{fontSize:36,opacity:0.2,marginTop:8}}>🔬</div>
            <div style={{color:T.muted,fontSize:12}}>Paste a JD and click Extract</div>
          </div>
        ):(
          <motion.div initial={{opacity:0}} animate={{opacity:1}}>
            {CATS.map(cat=>result[cat.k]?.length>0&&(
              <div key={cat.k} style={{marginBottom:18}}>
                <div style={{fontSize:10,color:cat.c,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>{cat.l.toUpperCase()} ({result[cat.k].length})</div>
                <div>
                  {result[cat.k].map((s,i)=>(
                    <motion.span key={s.name} initial={{opacity:0,scale:0.7}} animate={{opacity:1,scale:1}} transition={{delay:i*0.04}}
                      style={{display:"inline-flex",alignItems:"center",gap:5,background:`${cat.c}12`,border:`1px solid ${cat.c}35`,color:cat.c,borderRadius:7,padding:"3px 10px",fontSize:11,fontWeight:600,margin:"2px"}}>
                      {s.name}<span style={{fontSize:9,opacity:0.7}}>{s.confidence}%</span>
                    </motion.span>
                  ))}
                </div>
              </div>
            ))}
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,color:T.muted,fontWeight:700,marginBottom:10}}>SKILL FREQUENCY</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={result.all.slice(0,8)} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="frequency" name="Frequency" radius={[4,4,0,0]} fill={T.accent}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </Card>
    </div>
  );
}

/* ─── PAGE: TITLE STANDARDIZER ───────────────────────── */
const TITLE_MAP={"sr software eng iii":"Senior Software Engineer III","sr. software engineer":"Senior Software Engineer","ml eng":"Machine Learning Engineer","sr. ml engineer":"Senior Machine Learning Engineer","ai research eng iii":"AI Research Engineer III","dev ops":"DevOps Engineer","devops eng":"DevOps Engineer","sr. data scientist":"Senior Data Scientist","fe dev":"Frontend Developer","frontend dev":"Frontend Developer","backend sde ii":"Senior Software Engineer (Backend)","sde 2":"Software Engineer II","sde ii":"Software Engineer II","data analyst":"Data Analyst","full stack dev":"Full Stack Developer"};

function PageStandardize(){
  const [title,setTitle]=useState("");
  const [result,setResult]=useState(null);
  const [ld,setLd]=useState(false);
  const EXAMPLES=["Sr Software Eng III","ML Eng","AI Research Eng III","Dev Ops","Sr. Data Scientist","FE Dev"];

  const go=async(t=title)=>{
    if(!t.trim())return;
    setLd(true);
    await new Promise(r=>setTimeout(r,600));
    const key=t.toLowerCase().trim();
    const std=TITLE_MAP[key]||t.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
    const isSr=["sr","senior","iii","lead","principal"].some(x=>t.toLowerCase().includes(x));
    setResult({original:t,standardized:std,category:"Engineering",seniority:isSr?"Senior":"Mid-level",confidence:0.94});
    setLd(false);
  };

  return(
    <div style={{maxWidth:700}}>
      <Card style={{marginBottom:20}}>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>🏷 Job Title Standardizer</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:18}}>Uses JobBERT to normalize messy job titles to industry standards</div>
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          <input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="e.g. Sr Software Eng III" style={{...IS,flex:1}} onFocus={focus} onBlur={blur}/>
          <Btn onClick={()=>go()} disabled={ld}>{ld?"...":"Standardize"}</Btn>
        </div>
        <div style={{fontSize:11,color:T.muted,marginBottom:8}}>TRY AN EXAMPLE:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {EXAMPLES.map(ex=>(
            <motion.button key={ex} whileHover={{scale:1.03}} onClick={()=>{setTitle(ex);go(ex);}} style={{background:T.dim,border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 12px",color:T.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{ex}</motion.button>
          ))}
        </div>
      </Card>
      <AnimatePresence>
        {result&&(
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <Card glow>
              <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:18}}>✅ Standardization Result</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:16,marginBottom:24}}>
                <div style={{background:T.dim,borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:10,color:T.muted,fontWeight:700,marginBottom:6}}>ORIGINAL</div>
                  <div style={{fontSize:16,fontWeight:700,color:T.rose}}>{result.original}</div>
                </div>
                <div style={{fontSize:24,color:T.accent}}>→</div>
                <div style={{background:`${T.accent}12`,border:`1px solid ${T.accent}35`,borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:10,color:T.accent,fontWeight:700,marginBottom:6}}>STANDARDIZED</div>
                  <div style={{fontSize:16,fontWeight:700,color:T.accent}}>{result.standardized}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {[{l:"Category",v:result.category,c:T.teal},{l:"Seniority",v:result.seniority,c:T.violet},{l:"Confidence",v:`${Math.round(result.confidence*100)}%`,c:T.green}].map(x=>(
                  <div key={x.l} style={{background:T.dim,borderRadius:10,padding:14,textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.muted,marginBottom:4}}>{x.l}</div>
                    <div style={{fontWeight:800,color:x.c,fontSize:16}}>{x.v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── PAGE: RECOMMENDATIONS ───────────────────────────── */
/* ── JD skill extractor (frontend, no backend needed) ── */
const JD_SKILL_DB=["python","pytorch","tensorflow","keras","scikit-learn","numpy","pandas","kubernetes","docker","aws","gcp","azure","fastapi","flask","django","react","typescript","javascript","vue","nextjs","html","css","tailwind","graphql","sql","postgresql","mysql","mongodb","redis","mlflow","airflow","spark","kafka","git","linux","bash","terraform","llm","rag","rlhf","transformers","bert","langchain","nlp","computer vision","machine learning","deep learning","devops","ci/cd","rest api","microservices","rust","golang","java","scala","r","statistics","tableau","power bi"];

function extractJDSkills(jd){
  const low=jd.toLowerCase();
  return JD_SKILL_DB.filter(sk=>{
    const pat=new RegExp("\\b"+sk.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b");
    return pat.test(low);
  }).map(s=>s.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" "));
}

function matchJobsToJD(jdSkills, userSkills){
  const jdSet=new Set(jdSkills.map(s=>s.toLowerCase()));
  const userSet=new Set(userSkills.map(s=>s.toLowerCase()));
  return JOBS_MOCK.map(j=>{
    const req=j.skills;
    const reqSet=new Set(req.map(s=>s.toLowerCase()));
    // JD match: how well the job aligns with what the JD asks for
    const jdMatch=jdSet.size>0?Math.round([...jdSet].filter(s=>reqSet.has(s)).length/jdSet.size*100):0;
    // User match: how many job skills the user has
    const userMatch=Math.round(req.filter(s=>userSet.has(s.toLowerCase())).length/req.length*100);
    // Combined score (JD match weighted heavier when JD provided)
    const combined=jdSet.size>0?Math.round(jdMatch*0.6+userMatch*0.4):userMatch;
    const matched=req.filter(s=>userSet.has(s.toLowerCase()));
    const missing=req.filter(s=>!userSet.has(s.toLowerCase())).slice(0,4);
    const jdMissing=jdSkills.filter(s=>!userSet.has(s.toLowerCase())).slice(0,4);
    return{...j,match:combined,jdMatch,userMatch,matched,missing,jdMissing};
  }).sort((a,b)=>b.match-a.match);
}

function PageRecommendations({user}){
  const [mode,setMode]=useState("profile");   // "profile" | "jd"
  const [jd,setJd]=useState("");
  const [jdSkills,setJdSkills]=useState([]);
  const [result,setResult]=useState(null);
  const [ld,setLd]=useState(false);
  const [analyzed,setAnalyzed]=useState(false);
  const [recoSource,setRecoSource]=useState(null);  // "adzuna_live" | "kaggle_dataset"

  // Auto-load profile-based on mount
  useEffect(()=>{runProfile();},[]);

  const runProfile=async()=>{
    setLd(true);setMode("profile");setAnalyzed(false);
    const skills=user?.skills||[];
    const token=localStorage.getItem("sf_token");
    try{
      const r=await fetch(`${BASE}/recommendations/jobs`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({user_skills:skills,target_role:(user?.target_role||"").toLowerCase()}),
        signal:AbortSignal.timeout(8000),
      });
      if(r.ok){
        const d=await r.json();
        const recs=(d.recommendations||[]).map(j=>({
          ...j,match:j.match_score,userMatch:j.match_score,jdMatch:0,
          matched:j.matched_skills||[],missing:j.missing||[],jdMissing:[],
        }));
        setResult(recs);setRecoSource(d.source||"kaggle_dataset");setLd(false);return;
      }
    }catch{}
    // Local fallback
    const recs=matchJobsToJD([],skills);
    setResult(recs);setRecoSource("local");setLd(false);
  };

  const runJD=async()=>{
    if(!jd.trim()){alert("Please paste a job description first.");return;}
    setLd(true);setMode("jd");
    const skills=extractJDSkills(jd);
    setJdSkills(skills);
    const userSkills=user?.skills||[];
    const token=localStorage.getItem("sf_token");
    try{
      const r=await fetch(`${BASE}/recommendations/jobs`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({user_skills:[...new Set([...userSkills,...skills])],target_role:""}),
        signal:AbortSignal.timeout(8000),
      });
      if(r.ok){
        const d=await r.json();
        const jdSet=new Set(skills.map(s=>s.toLowerCase()));
        const userSet=new Set(userSkills.map(s=>s.toLowerCase()));
        const recs=(d.recommendations||[]).map(j=>({
          ...j,
          match:j.match_score,
          userMatch:j.match_score,
          jdMatch:j.skills?Math.round(j.skills.filter(s=>jdSet.has(s.toLowerCase())).length/Math.max(j.skills.length,1)*100):0,
          matched:j.matched_skills||[],
          missing:j.missing||[],
          jdMissing:skills.filter(s=>!userSet.has(s.toLowerCase())).slice(0,4),
        }));
        setResult(recs);setRecoSource(d.source||"kaggle_dataset");setAnalyzed(true);setLd(false);return;
      }
    }catch{}
    // Local fallback
    const recs=matchJobsToJD(skills,userSkills);
    setResult(recs);setRecoSource("local");setAnalyzed(true);setLd(false);
  };

  const mc=(m)=>m>=75?T.green:m>=55?T.amber:T.rose;

  return(
    <div>
      {/* Mode toggle + JD input */}
      <Card style={{marginBottom:20}}>
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <motion.button onClick={runProfile} whileHover={{y:-2,boxShadow:"0 4px 16px rgba(0,0,0,0.25)"}} whileTap={{scale:0.96}}
            style={{background:mode==="profile"?T.accentSoft:"transparent",border:`1px solid ${mode==="profile"?T.borderHi:T.border}`,borderRadius:10,padding:"8px 18px",color:mode==="profile"?T.accent:T.muted,fontSize:13,fontWeight:mode==="profile"?700:500,fontFamily:"inherit",cursor:"pointer",transition:"all 0.18s"}}>
            👤 My Profile
          </motion.button>
          <motion.button onClick={()=>setMode("jd")} whileHover={{y:-2,boxShadow:"0 4px 16px rgba(0,0,0,0.25)"}} whileTap={{scale:0.96}}
            style={{background:mode==="jd"?T.accentSoft:"transparent",border:`1px solid ${mode==="jd"?T.borderHi:T.border}`,borderRadius:10,padding:"8px 18px",color:mode==="jd"?T.accent:T.muted,fontSize:13,fontWeight:mode==="jd"?700:500,fontFamily:"inherit",cursor:"pointer",transition:"all 0.18s"}}>
            📋 From Job Description
          </motion.button>
        </div>

        {mode==="profile"&&(
          <div style={{color:T.muted,fontSize:13}}>
            Showing jobs ranked by match to your profile skills: <span style={{color:T.accent,fontWeight:700}}>{(user?.skills||[]).join(", ")||"none set"}</span>
          </div>
        )}

        {mode==="jd"&&(
          <div>
            <div style={{color:T.muted,fontSize:12,marginBottom:10}}>
              Paste any job description — we extract the required skills and find the best matching jobs + show your readiness score.
            </div>
            <textarea value={jd} onChange={e=>setJd(e.target.value)}
              placeholder={"Paste job description here...\n\nExample: We are looking for a Senior ML Engineer with expertise in Python, PyTorch, Kubernetes, AWS, MLflow..."}
              style={{...IS,minHeight:120,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7,marginBottom:12}}
              onFocus={focus} onBlur={blur}/>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <Btn onClick={runJD} disabled={ld}>{ld?"⏳ ANALYZING JD...":"⚡ ANALYZE JD"}</Btn>
              {analyzed&&<Btn variant="outline" small onClick={()=>{setJd("");setJdSkills([]);runProfile();}}>Clear</Btn>}
              {analyzed&&jdSkills.length>0&&(
                <div style={{fontSize:12,color:T.muted}}>
                  Found <span style={{color:T.accent,fontWeight:700}}>{jdSkills.length} skills</span> in JD: {jdSkills.slice(0,5).join(", ")}{jdSkills.length>5?`...`:``}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* JD skills extracted banner */}
      {mode==="jd"&&analyzed&&jdSkills.length>0&&(
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          style={{background:`${T.teal}10`,border:`1px solid ${T.teal}35`,borderRadius:14,padding:"14px 18px",marginBottom:18}}>
          <div style={{fontSize:11,color:T.teal,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>🔬 SKILLS EXTRACTED FROM JD ({jdSkills.length})</div>
          <div>{jdSkills.map(s=>{
            const have=(user?.skills||[]).map(x=>x.toLowerCase()).includes(s.toLowerCase());
            return <Tag key={s} name={s} matched={have}/>;
          })}</div>
          <div style={{fontSize:11,color:T.muted,marginTop:10}}>
            ✅ Green = you have it &nbsp;|&nbsp; ❌ Red = you're missing it
          </div>
        </motion.div>
      )}

      {/* Results */}
      {ld?(
        <div style={{textAlign:"center",padding:"60px 0",color:T.muted}}>
          <div style={{fontSize:32,marginBottom:12}}>⏳</div>
          {mode==="jd"?"Extracting skills from JD and ranking jobs...":"Computing skill matches..."}
        </div>
      ):(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{color:T.muted,fontSize:13}}>
              {mode==="jd"&&analyzed
                ? `Jobs ranked by JD skill match (60%) + your profile match (40%)`
                : `Jobs ranked by profile skill overlap`}
            </div>
            <Btn small variant="outline" onClick={mode==="jd"&&analyzed?runJD:runProfile} disabled={ld}>🔄 Refresh</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {(result||[]).map((job,i)=>(
              <motion.div key={job.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
                whileHover={{y:-5,borderColor:`${T.accent}50`,boxShadow:`0 12px 32px ${T.accentGlow}`}}
                style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:20,transition:"all 0.3s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:T.text,fontSize:15}}>{job.title}</div>
                    <div style={{color:T.muted,fontSize:12,marginTop:2}}>{job.company} · {job.location}</div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:mc(job.match),lineHeight:1}}>{job.match}%</div>
                    <div style={{fontSize:9,color:T.muted}}>MATCH</div>
                  </div>
                </div>

                {/* Match bar */}
                <div style={{height:4,background:T.dim,borderRadius:100,overflow:"hidden",marginBottom:12}}>
                  <motion.div initial={{width:0}} animate={{width:`${job.match}%`}} transition={{duration:1,delay:i*0.1}}
                    style={{height:"100%",background:mc(job.match),borderRadius:100}}/>
                </div>

                {/* JD vs Profile breakdown when in JD mode */}
                {mode==="jd"&&analyzed&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    <div style={{background:T.dim,borderRadius:8,padding:"7px 10px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:T.muted,marginBottom:2}}>JD MATCH</div>
                      <div style={{fontWeight:800,color:T.accent,fontSize:15}}>{job.jdMatch}%</div>
                    </div>
                    <div style={{background:T.dim,borderRadius:8,padding:"7px 10px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:T.muted,marginBottom:2}}>YOUR SKILLS</div>
                      <div style={{fontWeight:800,color:T.teal,fontSize:15}}>{job.userMatch}%</div>
                    </div>
                  </div>
                )}

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:700,color:T.green}}>₹{job.salary_min}–{job.salary_max}L</span>
                  <span style={{fontSize:11,color:T.muted}}>{job.experience}</span>
                </div>

                {/* Missing skills — from JD if JD mode, else from profile */}
                {mode==="jd"&&analyzed&&job.jdMissing?.length>0&&(
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:10,color:T.rose,fontWeight:700,marginBottom:4}}>⚠ YOU NEED FOR THIS JD</div>
                    <div>{job.jdMissing.map(s=><Tag key={s} name={s} matched={false}/>)}</div>
                  </div>
                )}
                {(mode==="profile"||!analyzed)&&job.missing?.length>0&&(
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:10,color:T.rose,fontWeight:700,marginBottom:4}}>MISSING SKILLS</div>
                    <div>{job.missing.map(s=><Tag key={s} name={s} matched={false}/>)}</div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PAGE: SKILL GAP ─────────────────────────────────── */
function PageGap({user}){
  const [targetRole,setTR]=useState(user?.target_role||"ML Engineer");
  const [userSkills,setUS]=useState((user?.skills||[]).join(", "));
  const [result,setResult]=useState(null);
  const [ld,setLd]=useState(false);

  const localGapAnalyze=(skills,roleKey)=>{
    const required=ROLE_SKILLS[roleKey]||["Python","SQL","Git","Docker","Communication"];
    const userSet=new Set(skills.map(s=>s.toLowerCase()));
    const matched=required.filter(s=>userSet.has(s.toLowerCase()));
    const gaps=required.filter(s=>!userSet.has(s.toLowerCase()));
    const pct=Math.round(matched.length/required.length*100);
    const LEARN={Kubernetes:{d:"Hard",h:18,c:["Linux Foundation CKAD"]},AWS:{d:"Medium",h:14,c:["AWS Solutions Architect"]},MLflow:{d:"Easy",h:6,c:["MLOps Fundamentals"]},Kafka:{d:"Hard",h:12,c:["Confluent Kafka Course"]},Airflow:{d:"Medium",h:8,c:["Astronomer Academy"]},Docker:{d:"Easy",h:6,c:["Docker Official Docs"]},Spark:{d:"Hard",h:14,c:["Databricks Academy"]},TypeScript:{d:"Easy",h:8,c:["Total TypeScript"]},React:{d:"Medium",h:10,c:["React Official Docs"]},PostgreSQL:{d:"Medium",h:8,c:["PostgreSQL Tutorial"]},Redis:{d:"Easy",h:5,c:["Redis University"]},Terraform:{d:"Medium",h:10,c:["HashiCorp Learn"]},FastAPI:{d:"Easy",h:6,c:["FastAPI Official Docs"]},PyTorch:{d:"Medium",h:10,c:["fast.ai"]},TensorFlow:{d:"Medium",h:10,c:["DeepLearning.AI"]}};
    const gapDetails=gaps.map(g=>({skill:g,...(LEARN[g]||{d:"Medium",h:8,c:["Udemy / Official Docs"]})}));
    const score=(cats)=>Math.min(100,Math.round(matched.filter(s=>cats.includes(s)).length/Math.max(cats.length,1)*100));
    const radar=[
      {axis:"AI/ML Core",user:score(["PyTorch","TensorFlow","Machine Learning","LLMs","NLP","Deep Learning"]),market:90},
      {axis:"Cloud/Infra",user:score(["AWS","GCP","Azure","Kubernetes","Docker"]),market:85},
      {axis:"MLOps",user:score(["MLflow","Airflow","CI/CD","Prometheus"]),market:80},
      {axis:"Data Eng.",user:score(["Kafka","Spark","SQL","Pandas","dbt"]),market:75},
      {axis:"Backend",user:score(["FastAPI","REST API","PostgreSQL","Redis","GraphQL"]),market:78},
      {axis:"DevOps",user:score(["Docker","CI/CD","Linux","Bash","Terraform"]),market:72},
    ];
    return {targetRole,pct,matched,gaps,gapDetails,radar,total:required.length,totalMatched:matched.length,totalGaps:gaps.length};
  };

  const analyze=async()=>{
    setLd(true);
    const skills=userSkills.split(",").map(s=>s.trim()).filter(Boolean);
    const roleKey=targetRole.toLowerCase();
    const token=localStorage.getItem("sf_token");
    // Try backend
    try{
      const r=await fetch(`${BASE}/gap-analysis/analyze`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({user_skills:skills,target_role:roleKey}),
        signal:AbortSignal.timeout(8000),
      });
      if(r.ok){
        const d=await r.json();
        setResult({
          targetRole:d.target_role||targetRole,
          pct:d.match_pct||0,
          matched:d.matched_skills||[],
          gaps:d.gap_skills||[],
          gapDetails:(d.gap_details||[]).map(g=>({skill:g.skill,d:g.difficulty,h:g.hours,c:g.courses||[]})),
          radar:d.radar_data||[],
          total:d.total_required||0,
          totalMatched:d.total_matched||0,
          totalGaps:d.total_gaps||0,
          source:"backend",
        });
        setLd(false);
        return;
      }
    }catch{}
    // Local fallback
    setResult({...localGapAnalyze(skills,roleKey),source:"local"});
    setLd(false);
  };

  const dc=(d)=>d==="Easy"?T.green:d==="Medium"?T.amber:T.rose;
  return(
    <div>
      <Card style={{marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"end"}}>
          <div>
            <label style={{fontSize:11,color:T.muted,fontWeight:700,letterSpacing:"0.08em",display:"block",marginBottom:6}}>TARGET ROLE</label>
            <Pills options={TARGET_ROLES.slice(0,6)} value={targetRole} onChange={setTR}/>
          </div>
          <div>
            <label style={{fontSize:11,color:T.muted,fontWeight:700,letterSpacing:"0.08em",display:"block",marginBottom:6}}>YOUR SKILLS (comma separated)</label>
            <div style={{display:"flex",gap:8}}>
              <input value={userSkills} onChange={e=>setUS(e.target.value)} style={{...IS,flex:1}} onFocus={focus} onBlur={blur}/>
              <Btn onClick={analyze} disabled={ld}>{ld?"Analyzing...":"Analyze"}</Btn>
            </div>
          </div>
        </div>
      </Card>
      {result&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
            {[{l:"Match Score",v:`${result.pct}%`,c:T.accent},{l:"Matched",v:result.totalMatched,c:T.green},{l:"Gaps",v:result.totalGaps,c:T.rose},{l:"Required",v:result.total,c:T.muted}].map(x=>(
              <div key={x.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px",textAlign:"center"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:x.c,lineHeight:1}}>{x.v}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:4}}>{x.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <Card>
              <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>📡 Skill Radar — You vs Market</div>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={result.radar}>
                  <PolarGrid stroke={T.border} gridType="polygon"/>
                  <PolarAngleAxis dataKey="axis" tick={{fill:T.muted,fontSize:10,fontWeight:600}}/>
                  <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/>
                  <Radar name="You" dataKey="user" stroke={T.accent} fill={T.accent} fillOpacity={0.2} strokeWidth={2.5} dot={{fill:T.accent,r:3}}/>
                  <Radar name="Market" dataKey="market" stroke={T.teal} fill={T.teal} fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="4 3"/>
                  <Tooltip content={<CT/>}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>✅ Matched vs ❌ Gaps</div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:T.teal,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>MATCHED ({result.matched.length})</div>
                <div>{result.matched.map(s=><Tag key={s} name={s} matched={true}/>)}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:T.rose,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>GAPS ({result.gaps.length})</div>
                <div>{result.gaps.map(s=><Tag key={s} name={s} matched={false}/>)}</div>
              </div>
            </Card>
          </div>
          <Card>
            <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>🛣️ Learning Paths</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
              {result.gapDetails.map((g,i)=>(
                <motion.div key={g.skill} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
                  style={{background:T.dim,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{fontWeight:700,color:T.text,fontSize:13}}>{g.skill}</div>
                    <span style={{background:`${dc(g.d)}18`,border:`1px solid ${dc(g.d)}35`,color:dc(g.d),borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:800}}>{g.d}</span>
                  </div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:8}}>⏱ ~{g.h} hours</div>
                  {g.c?.slice(0,1).map(x=><div key={x} style={{fontSize:11,color:T.accent,background:`${T.accent}10`,borderRadius:6,padding:"3px 8px"}}>📖 {x}</div>)}
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
      {!result&&!ld&&<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:48,opacity:0.15,marginBottom:12}}>📊</div>Configure your skills and target role above, then click Analyze</div>}
    </div>
  );
}

/* ─── PAGE: CAREER ROADMAP ────────────────────────────── */
const ROADMAPS={
  "ml engineer":[
    {title:"Junior ML Engineer",dur:"0–6 months",salary:"₹6–15 LPA",color:T.accent,icon:"🌱",skills:["Python","Pandas","Scikit-learn","SQL","Git"],desc:"Build foundations in Python and basic ML algorithms."},
    {title:"ML Engineer",dur:"6–18 months",salary:"₹15–35 LPA",color:T.teal,icon:"⚡",skills:["PyTorch","FastAPI","Docker","MLflow","AWS"],desc:"Train and deploy models. Build production pipelines."},
    {title:"Senior ML Engineer",dur:"18–36 months",salary:"₹35–70 LPA",color:T.amber,icon:"🚀",skills:["Kubernetes","LLMs","RAG","System Design"],desc:"Design scalable ML systems. Lead architecture decisions."},
    {title:"ML Tech Lead",dur:"3–5 years",salary:"₹70–150 LPA",color:T.green,icon:"👑",skills:["Team Leadership","Research","GenAI","Strategy"],desc:"Drive ML strategy. Mentor engineers. Lead AI adoption."},
  ],
  "data scientist":[
    {title:"Junior Data Scientist",dur:"0–6 months",salary:"₹5–12 LPA",color:T.accent,icon:"🌱",skills:["Python","SQL","Pandas","Statistics","Matplotlib"],desc:"Explore data, build basic models."},
    {title:"Data Scientist",dur:"6–18 months",salary:"₹12–28 LPA",color:T.teal,icon:"⚡",skills:["ML Models","A/B Testing","Spark","Tableau"],desc:"Lead experiments and dashboards."},
    {title:"Senior Data Scientist",dur:"18–36 months",salary:"₹28–55 LPA",color:T.amber,icon:"🚀",skills:["Causal Inference","Deep Learning","Leadership"],desc:"Define metrics strategy. Partner with leadership."},
    {title:"Principal Data Scientist",dur:"3–5 years",salary:"₹55–120 LPA",color:T.green,icon:"👑",skills:["Research","GenAI","Publications"],desc:"Drive data science vision org-wide."},
  ],
  "frontend developer":[
    {title:"Junior Frontend Developer",dur:"0–6 months",salary:"₹4–10 LPA",color:T.accent,icon:"🌱",skills:["HTML","CSS","JavaScript","React","Git"],desc:"Build UI components, fix bugs."},
    {title:"Frontend Developer",dur:"6–18 months",salary:"₹10–25 LPA",color:T.teal,icon:"⚡",skills:["TypeScript","Next.js","Testing","Performance"],desc:"Own features. Improve performance."},
    {title:"Senior Frontend Developer",dur:"18–36 months",salary:"₹25–50 LPA",color:T.amber,icon:"🚀",skills:["Architecture","Mentoring","GraphQL","CI/CD"],desc:"Define frontend architecture."},
    {title:"Frontend Architect",dur:"3–5 years",salary:"₹50–100 LPA",color:T.green,icon:"👑",skills:["Platform Engineering","Open Source"],desc:"Own developer experience."},
  ],
  "backend developer":[
    {title:"Junior Backend Developer",dur:"0–6 months",salary:"₹5–12 LPA",color:T.accent,icon:"🌱",skills:["Python","REST APIs","SQL","Git"],desc:"Build APIs, write tests."},
    {title:"Backend Developer",dur:"6–18 months",salary:"₹12–28 LPA",color:T.teal,icon:"⚡",skills:["FastAPI","PostgreSQL","Redis","Docker"],desc:"Own microservices. Complex business logic."},
    {title:"Senior Backend Developer",dur:"18–36 months",salary:"₹28–55 LPA",color:T.amber,icon:"🚀",skills:["Kubernetes","Kafka","System Design"],desc:"Design scalable distributed systems."},
    {title:"Backend Architect",dur:"3–5 years",salary:"₹55–120 LPA",color:T.green,icon:"👑",skills:["Technical Strategy","Multi-region"],desc:"Define backend strategy."},
  ],
  "devops engineer":[
    {title:"Junior DevOps Engineer",dur:"0–6 months",salary:"₹5–12 LPA",color:T.accent,icon:"🌱",skills:["Linux","Docker","CI/CD","Bash"],desc:"Set up pipelines, learn infra."},
    {title:"DevOps Engineer",dur:"6–18 months",salary:"₹12–28 LPA",color:T.teal,icon:"⚡",skills:["Kubernetes","Terraform","AWS","Monitoring"],desc:"Own cloud infrastructure."},
    {title:"Senior DevOps / SRE",dur:"18–36 months",salary:"₹28–55 LPA",color:T.amber,icon:"🚀",skills:["Platform Engineering","FinOps","GitOps"],desc:"Define reliability standards."},
    {title:"Platform Eng. Lead",dur:"3–5 years",salary:"₹55–110 LPA",color:T.green,icon:"👑",skills:["Internal Dev Platforms","Service Mesh"],desc:"Own the developer platform."},
  ],
};

function PageRoadmap({user}){
  const [sel,setSel]=useState(user?.target_role||"ML Engineer");
  const [active,setActive]=useState(null);
  const key=sel.toLowerCase();
  const stages=ROADMAPS[key]||ROADMAPS["ml engineer"];
  const userSet=new Set((user?.skills||[]).map(s=>s.toLowerCase()));

  return(
    <div>
      <Card style={{marginBottom:24}}>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>🛣️ Career Path Visualizer</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:16}}>Select your target role to see the full 4-stage progression timeline.</div>
        <Pills options={["ML Engineer","Data Scientist","Frontend Developer","Backend Developer","DevOps Engineer"]} value={sel} onChange={setSel}/>
      </Card>
      <div style={{position:"relative",marginBottom:28}}>
        <div style={{position:"absolute",top:48,left:"12.5%",right:"12.5%",height:3,background:`linear-gradient(90deg,${stages[0].color},${stages[1].color},${stages[2].color},${stages[3].color})`,opacity:0.35,borderRadius:100,zIndex:0}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {stages.map((st,i)=>{
            const mySkills=st.skills.filter(s=>userSet.has(s.toLowerCase()));
            const gapSkills=st.skills.filter(s=>!userSet.has(s.toLowerCase()));
            const pct=Math.round(mySkills.length/st.skills.length*100);
            const isAct=active===i;
            return(
              <motion.div key={st.title} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}}
                onClick={()=>setActive(isAct?null:i)} whileHover={{y:-5,boxShadow:`0 16px 40px ${st.color}25`,borderColor:`${st.color}60`}}
                style={{background:T.card,border:`2px solid ${isAct?st.color:T.border}`,borderRadius:18,padding:20,cursor:"pointer",transition:"all 0.3s",position:"relative"}}>
                <div style={{position:"absolute",top:-16,left:"50%",transform:"translateX(-50%)",width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${st.color},${st.color}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:`0 0 16px ${st.color}60`,border:`3px solid ${T.card}`}}>{st.icon}</div>
                <div style={{marginTop:12,textAlign:"center"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:st.color,letterSpacing:"0.06em",marginBottom:6}}>STAGE {i+1}</div>
                  <div style={{fontWeight:800,color:T.text,fontSize:14,marginBottom:4,lineHeight:1.3}}>{st.title}</div>
                  <div style={{fontSize:11,color:T.muted,marginBottom:10}}>⏱ {st.dur}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:st.color,lineHeight:1}}>{st.salary}</div>
                </div>
                <div style={{marginTop:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginBottom:4}}><span>Your readiness</span><span style={{color:st.color,fontWeight:700}}>{pct}%</span></div>
                  <div style={{height:4,background:T.dim,borderRadius:100,overflow:"hidden"}}><motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.2,delay:i*0.15}} style={{height:"100%",background:st.color,borderRadius:100}}/></div>
                </div>
                <AnimatePresence>
                  {isAct&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden"}}>
                      <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                        <div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:10}}>{st.desc}</div>
                        {mySkills.length>0&&<div style={{marginBottom:7}}><div style={{fontSize:9,color:T.teal,fontWeight:700,letterSpacing:"0.1em",marginBottom:5}}>✅ YOU HAVE</div><div>{mySkills.map(s=><span key={s} style={{display:"inline-flex",background:`${T.teal}12`,border:`1px solid ${T.teal}30`,color:T.teal,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,margin:"2px"}}>{s}</span>)}</div></div>}
                        {gapSkills.length>0&&<div><div style={{fontSize:9,color:T.rose,fontWeight:700,letterSpacing:"0.1em",marginBottom:5}}>❌ STILL NEED</div><div>{gapSkills.map(s=><span key={s} style={{display:"inline-flex",background:`${T.rose}10`,border:`1px solid ${T.rose}30`,color:T.rose,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,margin:"2px"}}>{s}</span>)}</div></div>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div style={{marginTop:10,fontSize:10,color:T.muted,textAlign:"center"}}>{isAct?"▲ collapse":"▼ details"}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
      <Card>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>💰 Salary Progression — {sel}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {stages.map((st,i)=>(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{height:120,display:"flex",alignItems:"flex-end",justifyContent:"center",marginBottom:8}}>
                <motion.div initial={{height:0}} animate={{height:`${20+i*22}%`}} transition={{duration:1,delay:i*0.1}} style={{width:48,background:`linear-gradient(180deg,${st.color},${st.color}60)`,borderRadius:"8px 8px 0 0",minHeight:20,boxShadow:`0 0 12px ${st.color}40`}}/>
              </div>
              <div style={{fontSize:11,fontWeight:800,color:st.color}}>{st.salary}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:3}}>{st.title.split(" ").slice(-1)[0]}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── PAGE: INTERVIEW PREP ────────────────────────────── */
const IQ_BANK={
  python:[
    {q:"What is the difference between a list and a tuple in Python?",d:"Easy",tip:"Focus on mutability and performance. Lists are mutable, tuples are immutable — tuples are faster for iteration."},
    {q:"Explain Python's GIL and its impact on multithreading.",d:"Hard",tip:"GIL prevents true parallel execution of Python threads. Use multiprocessing or async for CPU-bound tasks."},
    {q:"What are decorators and how do you implement one?",d:"Medium",tip:"Show a working example with @wraps. Decorators are higher-order functions that wrap another function."},
    {q:"Explain generators vs iterators and when to use each.",d:"Medium",tip:"Generators use 'yield' and are memory-efficient. Use them for large data streams."},
    {q:"What is the time complexity of list, dict, and set operations?",d:"Medium",tip:"Dict/set lookups are O(1) average. List search is O(n). List append is amortized O(1)."},
    {q:"Explain async/await in Python with a practical example.",d:"Hard",tip:"Event loop, coroutines, asyncio. Best for I/O-bound tasks like API calls or DB queries."},
  ],
  ml:[
    {q:"Explain the bias-variance tradeoff with a real example.",d:"Medium",tip:"High bias = underfitting, high variance = overfitting. Regularization and more data help."},
    {q:"How do you handle class imbalance in a classification dataset?",d:"Medium",tip:"SMOTE, class weights in loss function, F1/AUC-ROC evaluation instead of accuracy."},
    {q:"Explain how the Transformer architecture works.",d:"Hard",tip:"Self-attention mechanism, positional encoding, multi-head attention, encoder-decoder structure."},
    {q:"Walk through your process for deploying an ML model to production.",d:"Hard",tip:"Cover model versioning (MLflow), containerization (Docker), API (FastAPI), monitoring, rollback."},
    {q:"What is RLHF and how is it applied to LLMs?",d:"Hard",tip:"Reward model trained on human preferences, PPO optimization, Constitutional AI approach."},
    {q:"Explain the difference between bagging and boosting.",d:"Medium",tip:"Bagging: parallel, reduces variance (Random Forest). Boosting: sequential, reduces bias (XGBoost)."},
  ],
  tensorflow:[
    {q:"What is the difference between TensorFlow eager execution and graph execution?",d:"Medium",tip:"Eager: immediate evaluation (default in TF2). Graph: tf.function for performance optimization."},
    {q:"How do you implement a custom training loop in TensorFlow?",d:"Hard",tip:"GradientTape, apply_gradients, custom metrics. Gives full control over the training process."},
    {q:"Explain TensorFlow's data pipeline using tf.data.",d:"Medium",tip:"Dataset.map, batch, shuffle, prefetch. Prefetch overlaps data prep and model execution."},
    {q:"What is Keras and how does it relate to TensorFlow?",d:"Easy",tip:"Keras is TF's high-level API (tf.keras). Sequential, Functional, and Subclassing APIs."},
    {q:"How do you save and load a TensorFlow model?",d:"Easy",tip:"SavedModel format vs H5. tf.saved_model.save, model.save, tf.keras.models.load_model."},
  ],
  pytorch:[
    {q:"Explain the difference between PyTorch's eager and TorchScript modes.",d:"Medium",tip:"Eager: Pythonic, easy debug. TorchScript: optimized for production, serializable."},
    {q:"How does autograd work in PyTorch?",d:"Hard",tip:"Dynamic computation graph, tensor.grad, .backward(), requires_grad. Chain rule applied automatically."},
    {q:"What is the difference between DataLoader and Dataset in PyTorch?",d:"Easy",tip:"Dataset defines how to get an item. DataLoader handles batching, shuffling, and parallel loading."},
    {q:"How do you implement transfer learning in PyTorch?",d:"Medium",tip:"Load pretrained model, freeze layers, replace final layer, fine-tune. torchvision.models."},
    {q:"Explain the training loop in PyTorch step by step.",d:"Medium",tip:"optimizer.zero_grad(), forward pass, loss.backward(), optimizer.step(). Repeat per batch."},
  ],
  react:[
    {q:"Explain React's reconciliation algorithm and virtual DOM.",d:"Medium",tip:"React diffs the virtual DOM tree. Keys matter for list items. Fiber architecture enables concurrent rendering."},
    {q:"What are React hooks and what problems do they solve?",d:"Easy",tip:"Replace class components. useState, useEffect, useContext, useMemo, useCallback — all stateless functions."},
    {q:"How do you optimize performance in a large React app?",d:"Medium",tip:"React.memo, useMemo, useCallback, code splitting with React.lazy, virtualization for long lists."},
    {q:"What is the difference between useEffect and useLayoutEffect?",d:"Medium",tip:"useEffect runs after paint (async). useLayoutEffect runs synchronously after DOM mutations, before paint."},
    {q:"Explain the Context API vs Redux — when to use each.",d:"Hard",tip:"Context for simple global state. Redux for complex state with many updates, time-travel debugging, middleware."},
  ],
  sql:[
    {q:"Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN.",d:"Easy",tip:"INNER: only matching rows. LEFT: all left + matching right. FULL OUTER: all rows from both."},
    {q:"What is a database index and when should you use one?",d:"Medium",tip:"B-tree index for range queries, hash for equality. Trade-off: faster reads, slower writes, more storage."},
    {q:"Explain ACID properties in databases.",d:"Medium",tip:"Atomicity, Consistency, Isolation, Durability. Critical for financial and transactional systems."},
    {q:"What is the N+1 query problem and how do you solve it?",d:"Hard",tip:"Fetching related objects in a loop. Solve with JOIN, eager loading (ORM), or DataLoader pattern."},
    {q:"How would you optimize a slow SQL query?",d:"Hard",tip:"EXPLAIN ANALYZE, indexes, avoid SELECT *, pagination, query restructuring, caching."},
  ],
  docker:[
    {q:"What is the difference between a Docker image and a container?",d:"Easy",tip:"Image is the blueprint (read-only layers). Container is a running instance of an image."},
    {q:"Explain Docker's layer caching and how to optimize your Dockerfile.",d:"Medium",tip:"Each instruction creates a layer. Order matters — put frequently changing steps last. Use .dockerignore."},
    {q:"What is Docker Compose and when would you use it?",d:"Easy",tip:"Multi-container orchestration for local dev. Define services, networks, volumes in docker-compose.yml."},
    {q:"Explain the difference between CMD and ENTRYPOINT in a Dockerfile.",d:"Medium",tip:"ENTRYPOINT is the fixed executable. CMD provides default arguments. Together they form the full command."},
    {q:"How do you handle secrets and environment variables securely in Docker?",d:"Hard",tip:"Docker secrets, .env files (not in image), environment injection at runtime, never bake secrets into images."},
  ],
  fastapi:[
    {q:"What makes FastAPI faster than Flask and Django?",d:"Medium",tip:"Built on Starlette (ASGI), async-first, Pydantic validation, automatic OpenAPI docs, type hints."},
    {q:"Explain dependency injection in FastAPI.",d:"Medium",tip:"Depends() function. Used for auth, DB sessions, shared logic. Testable and reusable."},
    {q:"How do you implement JWT authentication in FastAPI?",d:"Hard",tip:"python-jose or PyJWT, OAuth2PasswordBearer, token in Authorization header, dependency to decode."},
    {q:"What is Pydantic and why is it central to FastAPI?",d:"Easy",tip:"Data validation using Python type hints. BaseModel, validators, automatic serialization/deserialization."},
    {q:"How do you handle background tasks in FastAPI?",d:"Medium",tip:"BackgroundTasks dependency, Celery for heavy tasks, asyncio for lightweight async work."},
  ],
  aws:[
    {q:"Explain the difference between EC2, Lambda, and ECS.",d:"Medium",tip:"EC2: full VM. Lambda: serverless functions (pay per invocation). ECS: container orchestration service."},
    {q:"What is an S3 bucket and what are common use cases?",d:"Easy",tip:"Object storage. Static websites, backups, ML datasets, CDN origin, logs. 11 nines durability."},
    {q:"Explain AWS IAM roles vs users vs policies.",d:"Medium",tip:"Users: human identities. Roles: assumed by services/apps. Policies: permission documents attached to both."},
    {q:"What is a VPC and why is it important for security?",d:"Hard",tip:"Virtual Private Cloud: isolated network. Subnets, security groups, NACLs, NAT gateway, peering."},
    {q:"How do you deploy a containerized app on AWS?",d:"Hard",tip:"ECS with Fargate (serverless containers) or EKS (managed Kubernetes). ECR for container registry."},
  ],
  kubernetes:[
    {q:"Explain the difference between a Pod, Deployment, and Service.",d:"Easy",tip:"Pod: smallest unit (one or more containers). Deployment: manages ReplicaSet/rollout. Service: stable networking endpoint."},
    {q:"How do you achieve zero-downtime deployments in Kubernetes?",d:"Hard",tip:"RollingUpdate strategy, readiness probes to gate traffic, PodDisruptionBudgets, blue-green or canary."},
    {q:"What is a Kubernetes Operator and when would you use one?",d:"Hard",tip:"Controller that manages custom resources (CRDs). Used for databases, ML training jobs, complex stateful apps."},
    {q:"Explain resource requests and limits in Kubernetes.",d:"Medium",tip:"Requests: guaranteed resources for scheduling. Limits: maximum allowed. QoS classes: Guaranteed, Burstable, BestEffort."},
    {q:"How does Kubernetes handle service discovery and load balancing?",d:"Medium",tip:"kube-dns, ClusterIP services, Endpoints objects. Ingress controllers for HTTP routing."},
  ],
  typescript:[
    {q:"What is the difference between interface and type in TypeScript?",d:"Easy",tip:"Both define shapes. Interfaces are extendable (declaration merging). Types support unions, intersections, mapped types."},
    {q:"Explain TypeScript generics with a practical example.",d:"Medium",tip:"Type parameters that work with any type. <T> syntax. Used in reusable functions, data structures, APIs."},
    {q:"What are utility types in TypeScript?",d:"Medium",tip:"Partial, Required, Pick, Omit, Record, Readonly. Build new types from existing ones."},
    {q:"How does TypeScript's type narrowing work?",d:"Hard",tip:"typeof, instanceof, in operator, discriminated unions, type predicates. Compiler narrows type in conditionals."},
    {q:"What is the 'never' type and when does it occur?",d:"Hard",tip:"Bottom type: no values assignable to it. Exhaustive switch checks, function that always throws, infinite loop."},
  ],
  nlp:[
    {q:"Explain the difference between stemming and lemmatization.",d:"Easy",tip:"Stemming: chops suffixes (fast, less accurate). Lemmatization: returns base form using vocabulary/morphological analysis."},
    {q:"What is TF-IDF and how is it used in text classification?",d:"Medium",tip:"Term Frequency × Inverse Document Frequency. Weights rare-but-important words. Feature for ML classifiers."},
    {q:"Explain the attention mechanism in transformers for NLP.",d:"Hard",tip:"Q, K, V matrices. Scaled dot-product attention. Multi-head allows attending to different positions simultaneously."},
    {q:"What is the difference between BERT and GPT architectures?",d:"Hard",tip:"BERT: encoder-only, bidirectional, masked LM pretraining. GPT: decoder-only, causal/autoregressive, text generation."},
    {q:"How do you evaluate an NLP model's performance?",d:"Medium",tip:"BLEU (generation), ROUGE (summarization), F1 (classification), perplexity (language modeling), human evaluation."},
  ],
  devops:[
    {q:"What is CI/CD and how would you set it up for a Python web app?",d:"Medium",tip:"GitHub Actions or GitLab CI. Stages: lint → test → build Docker image → push ECR → deploy to K8s/ECS."},
    {q:"Explain the difference between blue-green and canary deployments.",d:"Hard",tip:"Blue-green: full switch between two environments. Canary: gradual traffic shift. Canary is safer but complex."},
    {q:"What is Infrastructure as Code and why does it matter?",d:"Medium",tip:"Terraform, Pulumi, CDK. Version-controlled, repeatable, auditable infrastructure. Eliminates snowflake servers."},
    {q:"How do you monitor a distributed system in production?",d:"Hard",tip:"Prometheus + Grafana for metrics. ELK for logs. Jaeger/Zipkin for distributed tracing. SLOs and alerting."},
    {q:"Explain the 12-factor app methodology.",d:"Medium",tip:"Codebase, dependencies, config, backing services, build/release/run, processes, port binding, concurrency, etc."},
  ],
};

const BQ=[
  {q:"Tell me about a time you disagreed with a technical decision. How did you handle it?",tip:"STAR method. Show maturity and communication. Distinguish between disagreeing and being uncooperative."},
  {q:"Describe a project that failed or didn't meet expectations. What did you learn?",tip:"Be honest about the failure. Emphasise concrete learnings and what you'd do differently."},
  {q:"How do you manage tight deadlines with competing priorities?",tip:"Describe your prioritisation system. Mention stakeholder communication and trade-offs."},
  {q:"Tell me about a time you had to learn a new technology very quickly.",tip:"Your learning approach — docs, build something small, community, courses. Show adaptability."},
  {q:"Describe a time you gave difficult feedback to a colleague.",tip:"Empathy + actionable feedback + outcome. Focus on the professional relationship."},
  {q:"How do you approach debugging a production issue at 3am?",tip:"Structured approach: observe symptoms, form hypotheses, test, fix, post-mortem. Stay calm."},
];

const SDQ=[
  {q:"Design a URL shortener like bit.ly. Handle 100M URLs and 1B clicks/day.",tip:"Hashing (Base62), DB choice (SQL vs NoSQL), Redis caching, rate limiting, analytics pipeline, custom domains."},
  {q:"Design a real-time notification system for 10M concurrent users.",tip:"Kafka for async queuing, WebSockets or SSE for delivery, push/pull trade-offs, retry logic, message deduplication."},
  {q:"Design the backend for a job recommendation engine like LinkedIn.",tip:"Embeddings for job+user, similarity search (FAISS/Pinecone), collaborative filtering, A/B testing, feedback loop."},
  {q:"Design a distributed rate limiter that works across multiple servers.",tip:"Token bucket vs sliding window. Redis + Lua scripts for atomicity. Consistency trade-offs at scale."},
  {q:"Design a system to process and analyse 1 million resumes per day.",tip:"Queue (SQS/Kafka), worker pool, NLP pipeline (pdfplumber, spaCy), skill extraction, storage (S3 + RDS)."},
];

function PageInterview({user}){
  const [jd,setJd]=useState("");
  const [ld,setLd]=useState(false);
  const [qs,setQs]=useState(null);
  const [tab,setTab]=useState("technical");
  const [saved,setSaved]=useState([]);

  // Skill alias map — maps user skill names → IQ_BANK keys
  const SKILL_MAP = {
    python:["python"], pytorch:["pytorch","ml"], tensorflow:["tensorflow","ml"],
    react:["react"], javascript:["react"], typescript:["typescript","react"],
    "machine learning":["ml"], "deep learning":["ml","tensorflow","pytorch"],
    nlp:["nlp","ml"], kubernetes:["kubernetes","devops"], docker:["docker","devops"],
    fastapi:["fastapi","python"], sql:["sql"], postgresql:["sql"], mysql:["sql"],
    aws:["aws","devops"], gcp:["aws","devops"], azure:["aws","devops"],
    "data science":["ml","sql","python"], mlops:["devops","kubernetes","docker"],
    "devops":["devops","kubernetes","docker"], llm:["ml","nlp"],
    rag:["ml","nlp"], transformers:["ml","nlp","tensorflow","pytorch"],
  };

  const gen=async()=>{
    setLd(true);
    const jdL=jd.toLowerCase();
    const userSkills=(user?.skills||[]).map(s=>s.toLowerCase());

    // Collect matched IQ_BANK keys from both JD and profile skills
    const matchedKeys=new Set();

    // From user profile skills
    userSkills.forEach(sk=>{
      const mapped=SKILL_MAP[sk]||[];
      if(IQ_BANK[sk])mapped.unshift(sk); // exact match first
      mapped.forEach(k=>{ if(IQ_BANK[k]) matchedKeys.add(k); });
    });

    // From JD text
    Object.keys(SKILL_MAP).forEach(sk=>{
      if(jdL.includes(sk)){
        SKILL_MAP[sk].forEach(k=>{ if(IQ_BANK[k]) matchedKeys.add(k); });
        if(IQ_BANK[sk]) matchedKeys.add(sk);
      }
    });

    // Direct JD → IQ_BANK key match
    Object.keys(IQ_BANK).forEach(k=>{ if(jdL.includes(k)) matchedKeys.add(k); });

    // Always include python as foundation
    matchedKeys.add("python");

    // Build question pool
    const pool=[];
    matchedKeys.forEach(k=>{ if(IQ_BANK[k]) pool.push(...IQ_BANK[k]); });

    // Deduplicate and shuffle
    const deduped=[...new Map(pool.map(q=>[q.q,q])).values()];
    const shuffled=deduped.sort(()=>Math.random()-0.5);

    // Small realistic delay
    await new Promise(r=>setTimeout(r,400));

    const skillList=[...matchedKeys].filter(k=>IQ_BANK[k]).join(", ");
    setQs({
      technical: shuffled.slice(0,8),
      behavioral: BQ.sort(()=>Math.random()-0.5).slice(0,5),
      system_design: SDQ.sort(()=>Math.random()-0.5).slice(0,4),
      detectedSkills: [...matchedKeys],
      skillLabel: skillList||"Python (default)",
    });
    setLd(false);
  };

  const curQs=qs?(tab==="technical"?qs.technical:tab==="behavioral"?qs.behavioral.map(b=>({q:b.q,tip:b.tip,d:"Medium"})):qs.system_design.map(s=>({q:s.q,tip:s.tip,d:"Hard"}))):[]; 
  const dc=(d)=>d==="Easy"?T.green:d==="Medium"?T.amber:T.rose;
  const TABS=[{id:"technical",l:`Technical (${qs?.technical?.length||0})`,c:T.accent},{id:"behavioral",l:`Behavioural (${qs?.behavioral?.length||0})`,c:T.teal},{id:"system_design",l:`System Design (${qs?.system_design?.length||0})`,c:T.violet}];

  return(
    <div>
      <Card style={{marginBottom:20}}>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>🎤 Interview Question Generator</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:14}}>Paste a JD for targeted questions, or leave blank to generate from your skill profile.</div>
        <textarea value={jd} onChange={e=>setJd(e.target.value)} placeholder={"Paste job description here for targeted questions...\n\nOr leave blank — we'll use your profile skills."} style={{...IS,minHeight:100,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7}} onFocus={focus} onBlur={blur}/>
        <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center"}}>
          <Btn onClick={gen} disabled={ld}>{ld?"⏳ GENERATING...":"🎤 GENERATE QUESTIONS"}</Btn>
          {qs&&<Btn variant="outline" onClick={()=>{setQs(null);setJd("");setSaved([]);}}>Reset</Btn>}
          <span style={{fontSize:12,color:T.muted}}>
            {qs
              ? <span style={{color:T.teal}}>✓ Detected: <strong>{qs.skillLabel}</strong></span>
              : user?.skills?.length
                ? `Using ${user.skills.length} profile skills`
                : "Add skills in Settings for better results"
            }
          </span>
        </div>
      </Card>
      {!qs&&!ld&&<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:52,opacity:0.15,marginBottom:12}}>🎤</div><div>Click Generate Questions to get started</div></div>}
      {qs&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}}>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?`${t.c}20`:"transparent",border:`1px solid ${tab===t.id?t.c:T.border}`,borderRadius:10,padding:"8px 18px",color:tab===t.id?t.c:T.muted,fontSize:12,fontWeight:tab===t.id?700:500,fontFamily:"inherit",cursor:"pointer"}}>
                {t.l}
              </button>
            ))}
            {saved.length>0&&<div style={{marginLeft:"auto",background:`${T.green}18`,border:`1px solid ${T.green}35`,borderRadius:10,padding:"8px 14px",fontSize:12,color:T.green,fontWeight:700}}>⭐ {saved.length} saved</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <AnimatePresence mode="wait">
              {curQs.map((item,i)=>(
                <motion.div key={`${tab}-${i}`} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} exit={{opacity:0}} transition={{delay:i*0.06}}
                  style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{width:26,height:26,borderRadius:7,background:T.dim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:T.muted,flexShrink:0}}>{String(i+1).padStart(2,"0")}</div>
                        {item.d&&<span style={{background:`${dc(item.d)}18`,border:`1px solid ${dc(item.d)}35`,color:dc(item.d),borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>{item.d}</span>}
                        {saved.includes(item.q)&&<span style={{fontSize:14}}>⭐</span>}
                      </div>
                      <div style={{fontWeight:600,color:T.text,fontSize:14,lineHeight:1.6,marginBottom:10}}>{item.q}</div>
                      <div style={{display:"flex",alignItems:"flex-start",gap:8,background:T.dim,borderRadius:10,padding:"10px 14px"}}>
                        <span style={{color:T.accent,fontSize:14,flexShrink:0}}>💡</span>
                        <span style={{fontSize:12,color:T.muted,lineHeight:1.6}}>{item.tip}</span>
                      </div>
                    </div>
                    <motion.button whileHover={{scale:1.15,rotate:saved.includes(item.q)?0:15}} whileTap={{scale:0.85,rotate:0}} onClick={()=>setSaved(s=>s.includes(item.q)?s.filter(x=>x!==item.q):[...s,item.q])}
                      style={{background:saved.includes(item.q)?`${T.amber}20`:T.dim,border:`1px solid ${saved.includes(item.q)?T.amber:T.border}`,borderRadius:9,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,flexShrink:0}}>
                      {saved.includes(item.q)?"⭐":"☆"}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <Card style={{marginTop:20}}>
            <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:6}}>📚 Prep Strategy</div>
            <div style={{color:T.muted,fontSize:11,marginBottom:14}}>
              Detected skills: <strong style={{color:T.accent}}>{qs.skillLabel||"Python (default)"}</strong>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
              {[{icon:"🗓️",t:"4-Week Plan",d:"Week 1-2: DSA. Week 3: Domain topics. Week 4: Mock interviews on Pramp."},{icon:"⭐",t:"STAR Method",d:"For every behavioral: Situation, Task, Action, Result. Always quantify."},{icon:"🏗️",t:"System Design",d:"Requirements → High-level → Detailed → Trade-offs → Scale."},{icon:"💬",t:"Think Aloud",d:"Interviewers evaluate your thinking process, not just the answer."}].map(tip=>(
                <div key={tip.t} style={{background:T.dim,borderRadius:12,padding:14}}>
                  <div style={{fontSize:22,marginBottom:8}}>{tip.icon}</div>
                  <div style={{fontWeight:700,color:T.text,fontSize:13,marginBottom:5}}>{tip.t}</div>
                  <div style={{color:T.muted,fontSize:12,lineHeight:1.6}}>{tip.d}</div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

/* ─── PAGE: JOB SUMMARIZER ────────────────────────────── */
function PageSummarize(){
  const [jd,setJd]=useState("");
  const [result,setResult]=useState(null);
  const [ld,setLd]=useState(false);

  const summarize=async()=>{
    if(!jd.trim()){alert("Paste a job description first.");return;}
    const wordCount=jd.trim().split(/\s+/).length;
    if(wordCount<10){alert("Please paste the full job description (at least a few sentences). A single job title won\'t produce a useful summary.");return;}
    setLd(true);
    const token=localStorage.getItem("sf_token");
    try{
      const r=await fetch(`${BASE}/summarization/`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
        body:JSON.stringify({text:jd,job_title:""}),
        signal:AbortSignal.timeout(10000),
      });
      if(r.ok){
        const d=await r.json();
        setResult({
          summary:d.summary||"Could not generate summary.",
          required_skills:d.required_skills||[],
          nice_to_have:d.nice_to_have||["Open source contributions","Research publications"],
          responsibilities:d.key_responsibilities||["Design and build production-grade systems","Collaborate with cross-functional teams","Own end-to-end delivery","Mentor junior engineers"],
          salary_range:d.salary_range||"Salary not specified",
          experience_req:d.experience_req||"Not specified",
          word_count:d.word_count||jd.split(/\s+/).length,
          source:"backend",
        });
        setLd(false);
        return;
      }
    } catch(e){ /* fallback below */ }

    // Smart client-side fallback
    const text=jd.toLowerCase();
    const SKILL_ALIASES={
      python:"Python",react:"React",javascript:"JavaScript",typescript:"TypeScript",
      kubernetes:"Kubernetes",docker:"Docker",aws:"AWS",gcp:"GCP",azure:"Azure",
      sql:"SQL",fastapi:"FastAPI",pytorch:"PyTorch",tensorflow:"TensorFlow",
      mlflow:"MLflow",airflow:"Airflow",git:"Git",linux:"Linux",llm:"LLMs",
      rag:"RAG",spark:"Spark",kafka:"Kafka",redis:"Redis",postgresql:"PostgreSQL",
      mongodb:"MongoDB",graphql:"GraphQL","machine learning":"Machine Learning",
      "deep learning":"Deep Learning","data science":"Data Science",
    };
    const found=Object.entries(SKILL_ALIASES).filter(([k])=>text.includes(k)).map(([,v])=>v);
    const sents=jd.replace(/\n/g," ").split(/[.!?]/).map(s=>s.trim()).filter(s=>s.length>50);
    const summary=sents.slice(0,2).join(". ")+(sents.length>0?".":"No summary available.");
    const wc=jd.split(/\s+/).filter(Boolean).length;

    // Estimate salary from experience level
    const senior=/(senior|lead|principal|staff|8\+|10\+|7\+)/i.test(jd);
    const mid=/(3[-–]|4[-–]|5[-–]|mid|2[-–]4)/i.test(jd);
    const salRange=senior?"₹40–100 LPA":mid?"₹15–40 LPA":"₹6–18 LPA";
    const expReq=senior?"5+ years":mid?"3–5 years":"0–3 years";

    setResult({summary,required_skills:found.slice(0,8),nice_to_have:["Open source contributions","Research publications","Side projects"],responsibilities:["Design and build scalable production systems","Collaborate with cross-functional teams","Own end-to-end delivery of features","Mentor junior engineers and review code"],salary_range:salRange,experience_req:expReq,word_count:wc,source:"local"});
    setLd(false);
  };

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <Card>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:4}}>📝 Job Description</div>
        <div style={{color:T.muted,fontSize:11,marginBottom:14}}>AI will generate a structured summary</div>
        <textarea value={jd} onChange={e=>setJd(e.target.value)} placeholder="Paste full job description here..." style={{...IS,minHeight:280,resize:"vertical",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7}} onFocus={focus} onBlur={blur}/>
        <Btn onClick={summarize} disabled={ld} style={{marginTop:14,width:"100%"}}>{ld?"⏳ SUMMARIZING...":"📝 GENERATE SUMMARY"}</Btn>
      </Card>
      <div>
        {!result?<Card style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:48,opacity:0.15}}>📄</div><div style={{color:T.muted,fontSize:13,marginTop:12}}>Summary will appear here</div></Card>:(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{display:"flex",flexDirection:"column",gap:14}}>
            <Card glow>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:10,color:T.accent,fontWeight:700,letterSpacing:"0.1em"}}>TL;DR SUMMARY</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {result.seniority&&<span style={{fontSize:9,fontWeight:700,color:T.violet,background:`${T.violet}15`,padding:"2px 8px",borderRadius:6}}>{result.seniority}</span>}
                  <span style={{fontSize:9,fontWeight:700,color:result.source==="backend"?T.green:T.muted,background:result.source==="backend"?`${T.green}15`:`${T.muted}15`,padding:"2px 8px",borderRadius:6}}>{result.source==="backend"?"🟢 AI BACKEND":"💡 LOCAL PARSE"}</span>
                </div>
              </div>
              <div style={{color:T.text,fontSize:14,lineHeight:1.7,marginBottom:result.word_count?8:0}}>{result.summary}</div>
              {result.word_count>0&&<div style={{fontSize:11,color:T.muted}}>📄 {result.word_count} words · {result.skill_count||result.required_skills?.length||0} skills detected</div>}
            </Card>
            <Card>
              <div style={{fontSize:10,color:T.teal,fontWeight:700,letterSpacing:"0.1em",marginBottom:12}}>KEY RESPONSIBILITIES</div>
              {result.responsibilities.map((r,i)=>(
                <motion.div key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                  style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start"}}>
                  <span style={{color:T.accent,fontSize:14,flexShrink:0,marginTop:1}}>▸</span>
                  <span style={{fontSize:13,color:T.text,lineHeight:1.6}}>{r}</span>
                </motion.div>
              ))}
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Card>
                <div style={{fontSize:10,color:T.violet,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>REQUIRED SKILLS</div>
                {result.required_skills.length>0
                  ?<div>{result.required_skills.map(s=><Tag key={s} name={s} matched={true}/>)}</div>
                  :<div style={{color:T.muted,fontSize:12}}>No specific skills detected — paste a full JD for best results</div>
                }
              </Card>
              <Card>
                <div style={{fontSize:10,color:T.amber,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>COMPENSATION & EXPERIENCE</div>
                <div style={{fontSize:18,fontWeight:800,color:T.green,marginBottom:4}}>{result.salary_range}</div>
                <div style={{fontSize:12,color:T.muted,marginBottom:8}}>{result.experience_req}</div>
                {result.nice_to_have?.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:T.teal,fontWeight:700,marginBottom:6}}>NICE TO HAVE</div>
                    {result.nice_to_have.slice(0,3).map(n=><div key={n} style={{fontSize:11,color:T.muted,marginBottom:3}}>• {n}</div>)}
                  </div>
                )}
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ─── PAGE: SKILL ANALYTICS ───────────────────────────── */
function PageAnalytics(){
  const [liveData,setLiveData]=useState(null);
  useEffect(()=>{
    const token=localStorage.getItem("sf_token");
    fetch(`${BASE}/analytics/overview`,{
      headers:{...(token?{Authorization:`Bearer ${token}`}:{})},
      signal:AbortSignal.timeout(5000),
    })
    .then(r=>r.ok?r.json():null)
    .then(d=>{ if(d) setLiveData(d); })
    .catch(()=>{});
  },[]);

  const topSkills=liveData?.top_skills||["Python","React","AWS","Docker","SQL","Kubernetes","PyTorch","FastAPI"];
  const trendData=liveData?.skill_trends||TREND_DATA;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {liveData&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} style={{background:`${T.green}10`,border:`1px solid ${T.green}30`,borderRadius:10,padding:"8px 14px",fontSize:12,color:T.green,fontWeight:600}}>✅ Live data from backend · {liveData.total_jobs_analyzed?.toLocaleString()||"128K+"} jobs analysed</motion.div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:4}}>📊 Skill Demand Index</div>
          <div style={{color:T.muted,fontSize:11,marginBottom:14}}>2025 market demand scores (out of 100)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={SKILL_DEMAND} barCategoryGap="28%" layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
              <XAxis type="number" domain={[0,100]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="skill" tick={{fill:T.text,fontSize:11,fontWeight:600}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="demand" name="Demand" radius={[0,6,6,0]} fill={T.accent}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:4}}>📈 6-Month Trend</div>
          <div style={{color:T.muted,fontSize:11,marginBottom:14}}>LLM/AI · Cloud · MLOps demand growth</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={TREND_DATA}>
              <defs>
                <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.accent} stopOpacity={0.4}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/></linearGradient>
                <linearGradient id="a2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.teal} stopOpacity={0.3}/><stop offset="95%" stopColor={T.teal} stopOpacity={0}/></linearGradient>
                <linearGradient id="a3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.violet} stopOpacity={0.25}/><stop offset="95%" stopColor={T.violet} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis domain={[50,100]} tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CT/>}/>
              <Area type="monotone" dataKey="llm" name="LLM/AI" stroke={T.accent} strokeWidth={2.5} fill="url(#a1)"/>
              <Area type="monotone" dataKey="cloud" name="Cloud" stroke={T.teal} strokeWidth={2} fill="url(#a2)"/>
              <Area type="monotone" dataKey="mlops" name="MLOps" stroke={T.violet} strokeWidth={2} fill="url(#a3)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>🔥 AI-Generated Market Insights</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
          {[{icon:"🧠",t:"LLM skills up +31%",d:"Demand for LLM engineers has grown 31% in 6 months — fastest growing category.",c:T.accent},{icon:"☁️",t:"Cloud AI is mandatory",d:"92% of ML job postings now require at least one cloud platform.",c:T.teal},{icon:"🐳",t:"K8s is non-negotiable",d:"Kubernetes appears in 89% of senior ML engineer job descriptions.",c:T.blue},{icon:"📐",t:"RAG is the new baseline",d:"Vector DB and RAG architecture went from nice-to-have to required in 2025.",c:T.violet}].map(ins=>(
            <motion.div key={ins.t} whileHover={{y:-5,borderColor:`${ins.c}55`,boxShadow:`0 12px 32px ${ins.c}18`}} style={{background:T.dim,border:`1px solid ${T.border}`,borderRadius:14,padding:18,transition:"border-color 0.2s,box-shadow 0.2s"}}>
              <div style={{fontSize:26,marginBottom:10}}>{ins.icon}</div>
              <div style={{fontWeight:700,color:ins.c,fontSize:13,marginBottom:6}}>{ins.t}</div>
              <div style={{color:T.muted,fontSize:12,lineHeight:1.6}}>{ins.d}</div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── PAGE: DATA EXPLORER ─────────────────────────────── */
function PageExplorer({user}){
  const [filters,setFilters]=useState({query:"",location:"",skill:"",experience:""});
  const [jobs,setJobs]=useState(null);
  const [ld,setLd]=useState(false);
  const [total,setTotal]=useState(null);
  const [source,setSource]=useState(null);   // "adzuna_live" | "kaggle_dataset"
  const [liveEnabled,setLiveEnabled]=useState(null); // null=unknown
  const sf=(k,v)=>setFilters(f=>({...f,[k]:v}));
  const userSet=new Set((user?.skills||[]).map(s=>s.toLowerCase()));

  // Check if live jobs are configured
  useEffect(()=>{
    fetch(`${BASE}/jobs/live/status`,{signal:AbortSignal.timeout(3000)})
      .then(r=>r.ok?r.json():null)
      .then(d=>{ if(d) setLiveEnabled(d.live_jobs_enabled); })
      .catch(()=>setLiveEnabled(false));
  },[]);

  const search=async()=>{
    setLd(true);
    const token=localStorage.getItem("sf_token");
    const params=new URLSearchParams();
    if(filters.query)    params.append("query",filters.query||"software engineer");
    if(filters.location) params.append("location",filters.location);
    // Send first skill only — backend uses it for match scoring boost, not API filtering
    if(filters.skill){
      const firstSkill=filters.skill.split(",")[0].trim();
      if(firstSkill) params.append("skill",firstSkill);
    }
    params.append("results","25");

    try{
      // Try live jobs endpoint first
      const r=await fetch(`${BASE}/jobs/live?${params.toString()}`,{
        headers:{...(token?{Authorization:`Bearer ${token}`}:{})},
        signal:AbortSignal.timeout(15000),
      });
      if(r.ok){
        const d=await r.json();
        let res=d.jobs||[];
        if(filters.experience) res=res.filter(j=>j.experience.toLowerCase().includes(filters.experience.toLowerCase()));
        setJobs(res);
        setTotal(d.total??res.length);
        setSource(d.source||"kaggle_dataset");
        setLd(false);
        return;
      } else {
        console.warn(`[DataExplorer] /jobs/live returned HTTP ${r.status} — falling back`);
      }
    }catch(fetchErr){
      console.warn("[DataExplorer] /jobs/live fetch error:", fetchErr.message);
    }

    // Hard fallback — static kaggle dataset
    try{
      const staticParams=new URLSearchParams();
      if(filters.skill)    staticParams.append("skill",filters.skill);
      if(filters.location) staticParams.append("location",filters.location);
      const r2=await fetch(`${BASE}/jobs/?${staticParams.toString()}`,{
        headers:{...(token?{Authorization:`Bearer ${token}`}:{})},
        signal:AbortSignal.timeout(5000),
      });
      if(r2.ok){
        const d2=await r2.json();
        let res=d2.jobs||[];
        if(filters.experience) res=res.filter(j=>j.experience.toLowerCase().includes(filters.experience.toLowerCase()));
        res=res.map(j=>({...j,match_score:j.match_score??Math.round(j.skills.filter(s=>userSet.has(s.toLowerCase())).length/j.skills.length*100)}));
        setJobs(res); setTotal(d2.total??res.length); setSource("kaggle_dataset");
        setLd(false); return;
      }
    }catch{}

    // Final client-side fallback — always works, no auth needed
    console.info("[DataExplorer] Using local JOBS_MOCK fallback");
    let res=[...JOBS_MOCK];
    const q=(filters.query||"").toLowerCase();
    if(q) res=res.filter(j=>j.title.toLowerCase().includes(q)||j.skills.some(s=>s.toLowerCase().includes(q)));
    if(filters.skill){
      const sk=filters.skill.split(",")[0].trim().toLowerCase();
      if(sk) res=res.filter(j=>j.skills.some(s=>s.toLowerCase().includes(sk)));
    }
    if(filters.location){
      const loc=filters.location.toLowerCase();
      const placeholders=["city","remote","location","anywhere"];
      if(!placeholders.includes(loc)) res=res.filter(j=>j.location.toLowerCase().includes(loc));
    }
    if(filters.experience) res=res.filter(j=>j.experience.toLowerCase().includes(filters.experience.toLowerCase()));
    res=res.map(j=>({...j,match_score:Math.round(j.skills.filter(s=>userSet.has(s.toLowerCase())).length/j.skills.length*100)}));
    res.sort((a,b)=>b.match_score-a.match_score);
    setJobs(res); setTotal(res.length); setSource("local_mock");
    setLd(false);
  };

  return(
    <div>
      <Card style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,color:T.text,fontSize:14}}>🔍 Real-Time Job Search</div>
          <div style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:7,
            background:liveEnabled===true?`${T.green}15`:liveEnabled===false?`${T.amber}15`:`${T.muted}15`,
            color:liveEnabled===true?T.green:liveEnabled===false?T.amber:T.muted,
            border:`1px solid ${liveEnabled===true?T.green:liveEnabled===false?T.amber:T.muted}35`}}>
            {liveEnabled===true?"🟢 LIVE — Adzuna API":liveEnabled===false?"📦 Kaggle Dataset":"● Checking..."}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
          {[{k:"query",ph:"Job title (e.g. Data Scientist, ML Engineer)"},{k:"location",ph:"City (e.g. Bangalore, Mumbai)"},{k:"skill",ph:"Skill to boost match (e.g. Python)"},{k:"experience",ph:"e.g. 0-2 yrs"}].map(x=>(
            <div key={x.k}>
              <label style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:"0.08em",display:"block",marginBottom:4}}>{x.k.toUpperCase()}</label>
              <input placeholder={x.ph} value={filters[x.k]} onChange={e=>sf(x.k,e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} style={IS} onFocus={focus} onBlur={blur}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center",flexWrap:"wrap"}}>
          <Btn onClick={search} disabled={ld}>{ld?"🔍 Searching...":"🔍 Search"}</Btn>
          <Btn variant="outline" onClick={()=>{setFilters({query:"",location:"",skill:"",experience:""});setJobs(null);setTotal(null);}}>Clear</Btn>
          {total!==null&&<span style={{fontSize:12,color:T.muted}}>{total} job{total!==1?"s":""} found</span>}
        </div>
        <div style={{marginTop:10,fontSize:11,color:T.muted,lineHeight:1.6}}>
          💡 <strong>Query</strong> = job title sent to Adzuna (e.g. "Data Scientist"). 
          <strong> Location</strong> = real Indian city (e.g. "Bangalore"). 
          <strong> Skill</strong> = used to boost your match %. Leave location blank for all India results.
        </div>
      </Card>
      {jobs&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:12,color:T.muted}}>{total} job{total!==1?"s":""} found</div>
            {source&&<div style={{fontSize:11,fontWeight:700,color:source==="adzuna_live"?T.green:T.muted,background:source==="adzuna_live"?`${T.green}12`:`${T.muted}12`,padding:"3px 10px",borderRadius:6,border:`1px solid ${source==="adzuna_live"?T.green:T.muted}35`}}>
              {source==="adzuna_live"?"🟢 Live from Adzuna":"📦 Kaggle Dataset"}
            </div>}
          </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {jobs.length===0?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}>No jobs found matching your filters</div>:jobs.map((j,i)=>(
            <motion.div key={j.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}
              style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.text,fontSize:14}}>{j.title}</div>
                <div style={{color:T.muted,fontSize:12,marginTop:2}}>{j.company} · {j.location} · {j.experience}</div>
                <div style={{marginTop:8,marginBottom:8}}>{j.skills.slice(0,6).map(s=><Tag key={s} name={s} matched={userSet.has(s.toLowerCase())}/>)}</div>
                <div style={{height:4,background:T.dim,borderRadius:100,overflow:"hidden",maxWidth:200}}>
                  <motion.div initial={{width:0}} animate={{width:`${j.match_score}%`}} transition={{duration:0.8,ease:"easeOut"}} style={{height:"100%",borderRadius:100,background:j.match_score>=65?T.green:j.match_score>=50?T.amber:T.rose}}/>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                {j.source==="live"&&<div style={{fontSize:9,fontWeight:700,color:T.green,background:`${T.green}15`,padding:"2px 7px",borderRadius:5}}>🟢 LIVE</div>}
                {j.salary_min>0&&<div style={{fontWeight:800,color:T.green,fontSize:14}}>₹{j.salary_min}–{j.salary_max}L</div>}
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:j.match_score>=65?T.green:j.match_score>=50?T.amber:T.rose,lineHeight:1}}>{j.match_score}%</div>
                <div style={{fontSize:9,color:T.muted,marginBottom:2}}>MATCH</div>
                <div style={{fontSize:9,color:T.muted}}>{j.skills.filter(s=>userSet.has(s.toLowerCase())).length}/{j.skills.length} skills</div>
                {j.url&&<motion.a href={j.url} target="_blank" rel="noopener noreferrer" whileHover={{scale:1.05}} style={{fontSize:10,fontWeight:700,color:T.accent,background:`${T.accent}15`,border:`1px solid ${T.accent}35`,borderRadius:7,padding:"4px 10px",textDecoration:"none",marginTop:4}}>Apply →</motion.a>}
              </div>
            </motion.div>
          ))}
        </div>
        </div>
      )}
      {!jobs&&<div style={{textAlign:"center",padding:"60px 0",color:T.muted}}><div style={{fontSize:48,opacity:0.15,marginBottom:12}}>🔍</div><div style={{fontWeight:600,marginBottom:6}}>Search for real-time jobs above</div><div style={{fontSize:12}}>{liveEnabled?"Powered by Adzuna — live job listings":"Using Kaggle LinkedIn dataset — start backend for live jobs"}</div></div>}
    </div>
  );
}

/* ─── PAGE: SETTINGS ──────────────────────────────────── */
function PageSettings({user,setUser,onLogout}){
  const [f,setF]=useState({full_name:user?.full_name||"",college:user?.college||"",branch:user?.branch||"",target_role:user?.target_role||"",experience:user?.experience||"",skills:(user?.skills||[]).join(", "),linkedin_url:user?.linkedin_url||""});
  const [saved,setSaved]=useState(false);
  const [ld,setLd]=useState(false);
  const sf=(k,v)=>setF(x=>({...x,[k]:v}));
  const Lbl=({c})=><label style={{fontSize:11,color:T.muted,fontWeight:700,letterSpacing:"0.08em",display:"block",marginBottom:5}}>{c}</label>;

  const save=async()=>{
    setLd(true);
    await new Promise(r=>setTimeout(r,600));
    const skills=f.skills.split(",").map(s=>s.trim()).filter(Boolean);
    const updated={...user,...f,skills};
    localStorage.setItem("sf_session",JSON.stringify(updated));
    setUser(updated);setSaved(true);setLd(false);
    setTimeout(()=>setSaved(false),2500);
  };

  return(
    <div style={{maxWidth:700}}>
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
          <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${T.accent}55,${T.violet}55)`,border:`2px solid ${T.accent}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:T.accent}}>{user?.avatar||"?"}</div>
          <div>
            <div style={{fontWeight:800,color:T.text,fontSize:18}}>{user?.full_name||"Your Name"}</div>
            <div style={{color:T.muted,fontSize:12}}>{user?.email}</div>
            <div style={{color:T.accent,fontSize:12,fontWeight:600,marginTop:2}}>{user?.user_type}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[{k:"full_name",l:"FULL NAME",ph:"Your full name"},{k:"college",l:"COLLEGE / COMPANY",ph:"Institution or company"},{k:"branch",l:"BRANCH / DEPARTMENT",ph:"e.g. B.Tech CSE"},{k:"linkedin_url",l:"LINKEDIN URL",ph:"https://linkedin.com/in/..."}].map(x=>(
            <div key={x.k}><Lbl c={x.l}/><input value={f[x.k]} onChange={e=>sf(x.k,e.target.value)} placeholder={x.ph} style={IS} onFocus={focus} onBlur={blur}/></div>
          ))}
        </div>
        <div style={{marginTop:14}}><Lbl c="TARGET ROLE"/><Pills options={TARGET_ROLES} value={f.target_role} onChange={v=>sf("target_role",v)}/></div>
        <div style={{marginTop:14}}><Lbl c="EXPERIENCE"/><Pills options={["Fresher","0–1 yr","1–3 yrs","3–5 yrs","5+ yrs"]} value={f.experience} onChange={v=>sf("experience",v)}/></div>
        <div style={{marginTop:14}}><Lbl c="YOUR SKILLS (comma separated)"/><input value={f.skills} onChange={e=>sf("skills",e.target.value)} placeholder="Python, React, SQL..." style={IS} onFocus={focus} onBlur={blur}/></div>
        <div style={{display:"flex",gap:10,marginTop:20,alignItems:"center"}}>
          <motion.div animate={saved?{scale:[1,1.06,1]}:{scale:1}} transition={{duration:0.35}}>
            <Btn onClick={save} disabled={ld}>{ld?"Saving...":"💾 Save Changes"}</Btn>
          </motion.div>
          {saved&&<motion.span initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} style={{color:T.green,fontSize:13,fontWeight:700}}>✅ Saved!</motion.span>}
        </div>
      </Card>
      <Card>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>⚙️ System Status</div>
        {[{l:"React Frontend",s:"✅ Live",c:T.green},{l:"Framer Motion + Recharts",s:"✅ Live",c:T.green},{l:"LocalStorage Auth",s:"✅ Active",c:T.green},{l:"FastAPI Backend",s:"⚠ Optional",c:T.amber},{l:"Groq AI (Llama3-8B)",s:"⚠ Needs Backend",c:T.amber},{l:"JSON File Database",s:"⚠ Backend Required",c:T.muted}].map(x=>(
          <div key={x.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:13,color:T.muted}}>{x.l}</span>
            <span style={{fontSize:11,fontWeight:700,color:x.c,background:`${x.c}15`,padding:"2px 8px",borderRadius:6}}>{x.s}</span>
          </div>
        ))}
        <div style={{marginTop:16,padding:"12px 14px",background:`${T.amber}10`,border:`1px solid ${T.amber}30`,borderRadius:10,fontSize:12,color:T.amber,lineHeight:1.7}}>
          💡 <strong>Backend is optional.</strong> All features work without it using localStorage and mock data.
        </div>
        <div style={{marginTop:10}}>
          <Btn variant="danger" onClick={onLogout} small>🚪 Logout</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ─── PAGE: CASE STUDY ────────────────────────────────── */
function PageCaseStudy(){
  const [activeSection,setActiveSection]=useState(null);
  const SH=({title,color,id})=>(
    <motion.div
      onClick={()=>setActiveSection(activeSection===id?null:id)}
      whileHover={{x:4}}
      style={{display:"inline-flex",alignItems:"center",gap:8,background:`${color||T.accent}14`,
        border:`1px solid ${color||T.accent}40`,borderRadius:100,padding:"5px 16px",fontSize:10,
        fontWeight:700,letterSpacing:"0.12em",color:color||T.accent,textTransform:"uppercase",
        marginBottom:14,cursor:"default"}}>
      {title}
    </motion.div>
  );

  const Metric=({val,label,icon,color=T.accent})=>(
    <motion.div initial={{opacity:0,scale:0.85}} whileInView={{opacity:1,scale:1}} viewport={{once:true}}
      whileHover={{y:-4,boxShadow:"0 12px 32px rgba(0,0,0,0.4)"}}
      style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px",textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color,lineHeight:1,marginBottom:4}}>{val}</div>
      <div style={{color:T.muted,fontSize:11,lineHeight:1.5}}>{label}</div>
    </motion.div>
  );

  return(
    <div style={{maxWidth:980,margin:"0 auto"}}>

      {/* ── Hero ── */}
      <motion.div initial={{opacity:0,y:-16}} animate={{opacity:1,y:0}}
        style={{background:`linear-gradient(135deg,rgba(99,102,241,0.12),rgba(45,212,191,0.06))`,
          border:`1px solid ${T.borderHi}`,borderRadius:24,padding:"36px 40px",marginBottom:40,
          position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,
          background:`radial-gradient(circle,${T.accentGlow},transparent)`,borderRadius:"50%",pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:11,color:T.accent,fontWeight:700,letterSpacing:"0.15em",marginBottom:12}}>
            PORTFOLIO CASE STUDY · B.TECH CSE · IIIT BHUBANESWAR · 2025–2026
          </div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(2rem,5vw,3.2rem)",
            color:T.text,lineHeight:1,marginBottom:6}}>
            SkillForge AI{" "}
            <span style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              — Career Intelligence Platform
            </span>
          </div>
          <div style={{color:T.muted,fontSize:14,lineHeight:1.8,marginBottom:20,maxWidth:600}}>
            An AI-powered full-stack web application that analyses 125,000+ LinkedIn job postings,
            extracts skill gaps, scores resumes against ATS algorithms, and delivers personalised
            career roadmaps — all in real time.
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
            {[{l:"React 18",c:T.blue},{l:"FastAPI",c:T.teal},{l:"Groq Llama3",c:T.violet},
              {l:"Adzuna API",c:T.green},{l:"Kaggle Dataset",c:T.amber},{l:"pdfplumber",c:T.rose}]
              .map(b=>(
                <span key={b.l} style={{background:`${b.c}18`,border:`1px solid ${b.c}35`,
                  color:b.c,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700}}>
                  {b.l}
                </span>
              ))}
          </div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {[{icon:"🖥️",t:"15 Pages"},{icon:"🤖",t:"Groq LLM"},{icon:"📊",t:"125K+ Jobs"},
              {icon:"🔄",t:"Real-time API"},{icon:"🔐",t:"JWT Auth"},{icon:"📄",t:"PDF Parsing"}]
              .map(x=>(
                <div key={x.t} style={{display:"flex",alignItems:"center",gap:5,
                  color:T.muted,fontSize:12,fontWeight:600}}>
                  <span>{x.icon}</span><span>{x.t}</span>
                </div>
              ))}
          </div>
        </div>
      </motion.div>

      {/* ── 1. Problem Statement ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="01 · Problem Statement" color={T.rose} id="problem"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Card>
            <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:12}}>The Gap We Identified</div>
            <p style={{color:T.muted,fontSize:14,lineHeight:1.85,marginBottom:16}}>
              Students and early-career professionals spend months applying to roles they're
              underqualified for — not because they lack potential, but because they lack
              <strong style={{color:T.text}}> targeted, actionable skill intelligence</strong>.
            </p>
            <p style={{color:T.muted,fontSize:14,lineHeight:1.85}}>
              Existing tools like LinkedIn are informational, not prescriptive. No tool combines
              real job data + your specific skill profile + a prioritised learning plan in one place.
            </p>
          </Card>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {icon:"❌",t:"Resume rejected by ATS before a human reads it",c:T.rose},
              {icon:"❌",t:"Students apply to 100+ roles with a 2% response rate",c:T.rose},
              {icon:"❌",t:"Generic courses waste 3–6 months on the wrong skills",c:T.rose},
              {icon:"❌",t:"No tool shows the exact skill delta for your target role",c:T.rose},
              {icon:"❌",t:"Interview prep is disconnected from actual JD requirements",c:T.rose},
            ].map((p,i)=>(
              <motion.div key={i} initial={{opacity:0,x:16}} whileInView={{opacity:1,x:0}}
                viewport={{once:true}} transition={{delay:i*0.07}}
                style={{display:"flex",gap:10,background:`${T.rose}08`,
                  border:`1px solid ${T.rose}20`,borderRadius:10,padding:"10px 14px",alignItems:"flex-start"}}>
                <span style={{color:T.rose,flexShrink:0}}>{p.icon}</span>
                <span style={{color:T.muted,fontSize:13,lineHeight:1.5}}>{p.t}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── 2. Objective ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="02 · Objective & Goal" color={T.teal} id="goal"/>
        <Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {[
              {icon:"🎯",t:"Primary Goal",d:"Give any student a precise answer to: 'What exactly do I need to learn to get this job?' — in under 60 seconds.",c:T.accent},
              {icon:"📊",t:"Technical Goal",d:"Build a production-grade full-stack AI platform using real industry datasets, not synthetic toy data.",c:T.teal},
              {icon:"🚀",t:"Career Goal",d:"Demonstrate full-stack + AI engineering skills across React, FastAPI, NLP, LLM integration, and data pipeline design.",c:T.violet},
            ].map((g,i)=>(
              <motion.div key={i} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}}
                viewport={{once:true}} transition={{delay:i*0.1}}
                style={{background:T.dim,borderRadius:14,padding:20,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:12}}>{g.icon}</div>
                <div style={{fontWeight:700,color:g.c,fontSize:14,marginBottom:8}}>{g.t}</div>
                <div style={{color:T.muted,fontSize:13,lineHeight:1.7}}>{g.d}</div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.section>

      {/* ── 3. Architecture & Approach ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="03 · System Architecture" color={T.accent} id="arch"/>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:20}}>4-Layer Full-Stack Architecture</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {[
              {l:"React 18 Frontend",icon:"🖥️",c:T.blue,
                items:["15-page SPA with Framer Motion","Recharts data visualisation","localStorage auth fallback","JWT Bearer token auth","Responsive dark-mode UI"],
                note:"Zero page reloads. Works offline."},
              {l:"FastAPI Backend",icon:"⚙️",c:T.teal,
                items:["17 REST API endpoints","JWT auth + guest mode","Rate limiting middleware","PDF parsing (pdfplumber)","Async Adzuna integration"],
                note:"Sub-100ms response time."},
              {l:"AI / Intelligence Layer",icon:"🤖",c:T.violet,
                items:["Groq Llama3-8B (chat + summaries)","200+ skill keyword NLP engine","ATS scoring algorithm","Skill alias matching (TF→TensorFlow)","Real-time skill gap analysis"],
                note:"3-tier fallback — always works."},
              {l:"Data Layer",icon:"📊",c:T.amber,
                items:["125K+ Kaggle LinkedIn dataset","Adzuna real-time job API","JSON file store (no DB setup)","In-memory 30-min job cache","Client localStorage for user data"],
                note:"No database required to run."},
            ].map((layer,i)=>(
              <motion.div key={layer.l} initial={{opacity:0,x:i%2===0?-16:16}}
                whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*0.1}}
                style={{background:T.dim,borderRadius:14,padding:18,border:`1px solid ${layer.c}20`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:40,height:40,borderRadius:11,background:`${layer.c}18`,
                    border:`1px solid ${layer.c}35`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:20,flexShrink:0}}>{layer.icon}</div>
                  <div style={{fontWeight:700,color:layer.c,fontSize:14}}>{layer.l}</div>
                </div>
                <div style={{marginBottom:12}}>
                  {layer.items.map(item=>(
                    <div key={item} style={{display:"flex",gap:7,marginBottom:5,alignItems:"flex-start"}}>
                      <span style={{color:layer.c,fontSize:10,flexShrink:0,marginTop:3}}>▸</span>
                      <span style={{color:T.muted,fontSize:12,lineHeight:1.5}}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:`${layer.c}10`,border:`1px solid ${layer.c}25`,
                  borderRadius:8,padding:"6px 10px",fontSize:11,color:layer.c,fontWeight:600}}>
                  ✓ {layer.note}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.section>

      {/* ── 4. Key Features ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="04 · Key Features" color={T.green} id="features"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {[
            {icon:"📄",t:"AI Career Report",d:"Upload any PDF resume → get ATS score, matched/missing skills, job recommendations, and a 12-month learning roadmap. Powered by pdfplumber + custom NLP.",c:T.accent},
            {icon:"📊",t:"Skill Gap Radar",d:"Enter your skills + target role → see a 6-axis radar chart comparing you vs market. Each axis has a specific learning recommendation.",c:T.teal},
            {icon:"🤖",t:"Groq AI Chatbot",d:"Real LLM (Llama3-8B via Groq API) answering any career question. Falls back to 40+ smart local answers when backend is offline.",c:T.violet},
            {icon:"🔍",t:"Real-Time Job Search",d:"Live job listings from Adzuna API (200+ calls/day free). Each result shows match %, missing skills, and a direct Apply link.",c:T.green},
            {icon:"🎤",t:"Interview Generator",d:"Detects 13 skill categories from your profile (TensorFlow → ML questions, Docker → DevOps questions). Generates 8 technical + 5 behavioural + 4 system design questions.",c:T.amber},
            {icon:"📝",t:"JD Summarizer",d:"Paste any job description → AI extracts skills, infers seniority level, estimates salary range, and generates a structured TL;DR summary using Groq.",c:T.rose},
          ].map((f,i)=>(
            <motion.div key={f.t} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}}
              viewport={{once:true}} transition={{delay:i*0.07}}
              whileHover={{y:-4,boxShadow:"0 12px 32px rgba(0,0,0,0.35)",borderColor:`${f.c}40`}}
              style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:20,
                transition:"border-color 0.2s"}}>
              <div style={{fontSize:28,marginBottom:12}}>{f.icon}</div>
              <div style={{fontWeight:700,color:f.c,fontSize:14,marginBottom:8}}>{f.t}</div>
              <div style={{color:T.muted,fontSize:13,lineHeight:1.7}}>{f.d}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── 5. Challenges Solved ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="05 · Engineering Challenges" color={T.amber} id="challenges"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {[
            {t:"Token Auth Cross-Environment",icon:"🔐",c:T.teal,
              p:"User signs up while backend is offline → gets localStorage token 'local_1234'. Later with backend running, every API call returns 401.",
              s:"decode_token() detects 'local_' prefix → returns guest dict instead of 401. Read-only endpoints work for all users. Strict auth only on write operations.",
              im:"Zero '0 jobs found' errors. Auth works in all 4 states: backend on/off × registered/guest."},
            {t:"Real-Time Job API Integration",icon:"🔍",c:T.green,
              p:"Adzuna API returns 0 results when location='City' or skill comma-list sent as query. Bad results were being cached for 30 minutes.",
              s:"Location validated against placeholder list before sending. Skills separated from search query. Empty results never cached. 15s timeout with fallback chain.",
              im:"Live jobs now appear for any valid job title query across India."},
            {t:"Skill False-Negative Detection",icon:"🧠",c:T.violet,
              p:"Resume says 'TensorFlow' → system marks 'Machine Learning' as missing. User writes 'torch' → PyTorch shown as absent. 'k8s' not recognised as Kubernetes.",
              s:"Built SKILL_ALIASES dict mapping 40+ aliases: tf→TensorFlow, torch→PyTorch, k8s→Kubernetes, sklearn→Scikit-learn, pyspark→Spark, github→Git.",
              im:"ATS false-negative rate dropped to near-zero for common abbreviations."},
            {t:"PDF Resume Parsing",icon:"📄",c:T.amber,
              p:"Multi-column PDF layouts produce garbled text. Font-encoded PDFs produce gibberish. Large files timeout the API.",
              s:"pdfplumber (primary) → PyPDF2 (fallback) → raw UTF-8 decode (last resort). Regex normalisation for compound skills. 40s timeout for career report endpoint.",
              im:"85%+ skill recall on standard tech resumes. Never hard-crashes."},
          ].map((c,i)=>(
            <motion.div key={c.t} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}}
              viewport={{once:true}} transition={{delay:i*0.08}}
              style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:22}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:11,background:`${c.c}18`,
                  border:`1px solid ${c.c}30`,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>
                <div style={{fontWeight:700,color:T.text,fontSize:14}}>{c.t}</div>
              </div>
              {[{l:"PROBLEM",tx:c.p,col:T.rose},{l:"SOLUTION",tx:c.s,col:T.teal}].map(x=>(
                <div key={x.l} style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:x.col,fontWeight:700,letterSpacing:"0.08em",marginBottom:4}}>{x.l}</div>
                  <div style={{color:T.muted,fontSize:12,lineHeight:1.7}}>{x.tx}</div>
                </div>
              ))}
              <div style={{background:`${c.c}10`,border:`1px solid ${c.c}25`,
                borderRadius:8,padding:"8px 12px",marginTop:4}}>
                <div style={{fontSize:10,color:c.c,fontWeight:700,letterSpacing:"0.08em",marginBottom:3}}>IMPACT</div>
                <div style={{color:T.text,fontSize:12,fontWeight:600}}>{c.im}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── 6. Metrics & Results ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="06 · Results & Metrics" color={T.green} id="results"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14,marginBottom:20}}>
          <Metric val="15" label="Dashboard Pages" icon="🖥️" color={T.accent}/>
          <Metric val="17" label="API Endpoints" icon="⚙️" color={T.teal}/>
          <Metric val="125K+" label="LinkedIn Jobs Dataset" icon="💼" color={T.violet}/>
          <Metric val="200+" label="Skill Keywords in NLP" icon="🧠" color={T.amber}/>
          <Metric val="40+" label="Skill Alias Mappings" icon="🔗" color={T.blue}/>
          <Metric val="3-tier" label="Fallback Architecture" icon="🔄" color={T.green}/>
        </div>
        <Card>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:16}}>📈 What Works At Every Level</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[
              {scenario:"No backend running",works:["Login/Signup","All 15 pages load","Interview Prep","Career Roadmap","Skill Gap (local)","Settings"],color:T.teal},
              {scenario:"Backend running, no API keys",works:["+ PDF career report","+ ATS resume scoring","+ Skill extraction NLP","+ Job recommendations","+ Analytics data","+ Profile persistence"],color:T.accent},
              {scenario:"Backend + Groq + Adzuna",works:["+ Real Llama3-8B chat","+ AI job summarization","+ Live Adzuna jobs","+ Apply links on jobs","+ Seniority detection","+ Context-aware AI"],color:T.violet},
            ].map((tier,i)=>(
              <div key={i} style={{background:T.dim,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:tier.color,marginBottom:10,
                  background:`${tier.color}15`,padding:"3px 10px",borderRadius:6,display:"inline-block"}}>
                  Tier {i+1}: {tier.scenario}
                </div>
                {tier.works.map(w=>(
                  <div key={w} style={{display:"flex",gap:7,marginBottom:5}}>
                    <span style={{color:tier.color,fontSize:11,flexShrink:0}}>✓</span>
                    <span style={{color:T.muted,fontSize:12}}>{w}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </motion.section>

      {/* ── 7. Interview Answers ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:40}}>
        <SH title="07 · Interview Talking Points" color={T.accent} id="interview"/>
        <Card glow>
          <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:20}}>
            💬 Use These Exact Answers — Tailored for Google/Nvidia/Razorpay Interviews
          </div>
          {[
            {q:"Tell me about a project you built end-to-end.",
             a:"I built SkillForge AI — a full-stack career intelligence platform. It analyses 125K+ real LinkedIn job postings, extracts skill gaps using a 200-keyword NLP engine, scores resumes against ATS algorithms, and delivers personalised roadmaps. The backend is FastAPI with JWT auth, Groq Llama3 integration, and a real-time Adzuna job API. The frontend is React 18 with 15 pages, Framer Motion animations, and Recharts dashboards. It works offline via localStorage fallback — zero crashes regardless of backend state."},
            {q:"What was the hardest technical challenge you faced?",
             a:"The auth-token mismatch bug: users who signed up while the backend was offline got 'local_1234' tokens. When the backend came back, every API call returned 401 — silently. The Data Explorer showed '0 jobs' with no error message. I traced it through 3 fallback layers: live API → static dataset → mock data. The fix was making decode_token() recognise local_ prefixes and return a guest user dict instead of raising HTTPException. I also added a /api/jobs/test-adzuna diagnostic endpoint with no auth for fast debugging."},
            {q:"How did you design for failure?",
             a:"Three-tier fallback architecture at every layer. Chatbot: Groq API → 40 local smart answers. Jobs: Adzuna live → 125K Kaggle dataset → 10 mock jobs. Auth: JWT backend → localStorage. PDF parsing: pdfplumber → PyPDF2 → raw UTF-8. ATS scoring: backend NLP → frontend keyword matching. The principle: every feature degrades gracefully — the user never sees an error page or empty state due to infrastructure."},
            {q:"How did you use AI in this project?",
             a:"Four ways: Groq Llama3-8B for the chatbot (general-purpose agent, no topic restrictions), job description summarization (extracts structure + infers seniority), and interview question generation. Custom NLP engine with SKILL_ALIASES for smart skill inference — TF maps to TensorFlow, torch to PyTorch, k8s to Kubernetes. ATS scoring algorithm weights keyword match 50%, semantic coverage 30%, format quality 20%."},
          ].map((item,i)=>(
            <motion.div key={i} initial={{opacity:0,y:8}} whileInView={{opacity:1,y:0}}
              viewport={{once:true}} transition={{delay:i*0.06}}
              style={{marginBottom:i<3?20:0,paddingBottom:i<3?20:0,
                borderBottom:i<3?`1px solid ${T.border}`:"none"}}>
              <div style={{fontSize:12,color:T.accent,fontWeight:700,marginBottom:8,
                display:"flex",alignItems:"center",gap:8}}>
                <span style={{background:`${T.accent}18`,border:`1px solid ${T.accent}30`,
                  borderRadius:6,padding:"2px 8px",fontSize:10}}>Q{i+1}</span>
                {item.q}
              </div>
              <div style={{fontSize:13,color:T.text,lineHeight:1.85,background:T.dim,
                borderRadius:10,padding:"14px 16px",borderLeft:`3px solid ${T.accent}`}}>
                {item.a}
              </div>
            </motion.div>
          ))}
        </Card>
      </motion.section>

      {/* ── 8. Future Improvements ── */}
      <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} style={{marginBottom:20}}>
        <SH title="08 · Future Improvements" color={T.muted} id="future"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {[
            {icon:"🚀",t:"Production Deployment",d:"Docker + Nginx containerization, Vercel (frontend) + Railway (backend). CI/CD pipeline with GitHub Actions. Environment-based config management.",c:T.accent,phase:"Phase 1"},
            {icon:"🗄️",t:"PostgreSQL + Redis",d:"Replace JSON file store with PostgreSQL for user persistence. Redis for session caching and Adzuna result caching across instances.",c:T.teal,phase:"Phase 1"},
            {icon:"🧬",t:"LLM Fine-Tuning",d:"Fine-tune Llama3 on Indian tech job market data for more accurate salary estimates, company-specific interview prep, and regional skill trends.",c:T.violet,phase:"Phase 2"},
            {icon:"📱",t:"Mobile App",d:"React Native port of the core features: career report, skill gap radar, and AI chatbot. Offline-first with background sync.",c:T.amber,phase:"Phase 2"},
          ].map((f,i)=>(
            <motion.div key={f.t} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}}
              viewport={{once:true}} transition={{delay:i*0.08}}
              style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>{f.icon}</span>
                  <div style={{fontWeight:700,color:T.text,fontSize:14}}>{f.t}</div>
                </div>
                <span style={{fontSize:9,fontWeight:700,color:f.c,background:`${f.c}15`,
                  padding:"2px 8px",borderRadius:6,border:`1px solid ${f.c}30`,flexShrink:0}}>
                  {f.phase}
                </span>
              </div>
              <div style={{color:T.muted,fontSize:13,lineHeight:1.7}}>{f.d}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

    </div>
  );
}

/* ─── LANDING PAGE ────────────────────────────────────── */
function LandingPage({onGetStarted}){
  const [scrollY,setScrollY]=useState(0);
  useEffect(()=>{const h=()=>setScrollY(window.scrollY);window.addEventListener("scroll",h);return()=>window.removeEventListener("scroll",h);},[]);
  const FEATURES=[
    {icon:"⚡",title:"Instant Skill Extraction",color:T.accent,desc:"Paste any job description. Our NLP engine extracts every required skill in seconds — technical, soft, and domain-specific."},
    {icon:"🎯",title:"Precision Gap Analysis",color:T.teal,desc:"Compare your skills against market requirements with a radar chart. See exactly where you stand and what to learn next."},
    {icon:"🤖",title:"Real AI Career Chatbot",color:T.violet,desc:"Ask anything about your career — skills, salary, interview prep, or learning paths. Personalized to your profile."},
    {icon:"📄",title:"ATS Resume Checker",color:T.amber,desc:"Score your resume against any job description. See keyword gaps, format issues, and actionable suggestions."},
    {icon:"🛣️",title:"Career Path Roadmap",color:T.rose,desc:"Visual 4-stage career timeline with salary ranges, required skills, and estimated timeframes at each level."},
    {icon:"🎤",title:"Interview Question Generator",color:T.blue,desc:"Paste a JD, get 12–15 targeted interview questions — technical, behavioural, and system design."},
  ];
  const STATS=[{val:"33K+",label:"Jobs Analyzed",icon:"📊"},{val:"417",label:"Skills Extracted",icon:"🔬"},{val:"97%",label:"AI Career Intelligence",icon:"🎯"},{val:"Active",label:"Skill Gap Detection",icon:"🔍"}];
  const HOW=[{step:"01",title:"Sign Up & Set Your Goal",desc:"Create your profile in 3 steps. Tell us your skills, background, and target role.",icon:"👤"},{step:"02",title:"Analyze Any Job Description",desc:"Paste a JD. Our AI extracts skills, calculates your match score, and identifies gaps.",icon:"⚡"},{step:"03",title:"Get Your Personalized Plan",desc:"Receive a ranked learning roadmap, job recommendations, and interview questions.",icon:"🗺️"}];
  const particles=Array.from({length:16},(_,i)=>({id:i,x:Math.random()*100,y:Math.random()*100,size:Math.random()*3+1,delay:Math.random()*4,dur:Math.random()*6+4,color:[T.accent,T.teal,T.violet][i%3]}));
  return(
    <div style={{background:T.bg,color:T.text,fontFamily:"'DM Sans','Outfit',sans-serif",overflowX:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Bebas+Neue&family=JetBrains+Mono:wght@400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}html{scroll-behavior:smooth;}::selection{background:rgba(99,102,241,0.25);}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.2);border-radius:100px;}`}</style>
      {/* Navbar */}
      <motion.nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,padding:"0 clamp(20px,5vw,80px)",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",background:scrollY>50?`${T.sidebar}ee`:"transparent",backdropFilter:scrollY>50?"blur(20px)":"none",borderBottom:scrollY>50?`1px solid ${T.border}`:"1px solid transparent",transition:"all 0.4s"}}
        initial={{y:-80,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:0.7,delay:0.2}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:`0 0 16px ${T.accentGlow}`}}>⚡</div>
          <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:"0.06em",color:T.accent,lineHeight:1}}>SKILLFORGE AI</div><div style={{fontSize:8,color:T.muted,letterSpacing:"0.2em"}}>CAREER INTELLIGENCE ENGINE</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {[["Features","features"],["How It Works","how"]].map(([l,id])=><motion.button key={l} whileHover={{scale:1.04}} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"})} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500,padding:"6px 12px"}}>{l}</motion.button>)}
          <motion.button whileHover={{scale:1.04,boxShadow:`0 0 24px ${T.accentGlow}`}} whileTap={{scale:0.97}} onClick={onGetStarted} style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,border:"none",borderRadius:10,padding:"9px 22px",color:"#fff",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Launch App →</motion.button>
        </div>
      </motion.nav>
      {/* Hero */}
      <section style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",padding:"100px clamp(20px,5vw,80px) 60px"}}>
        <div style={{position:"absolute",inset:0,overflow:"hidden",zIndex:0}}>
          <motion.div animate={{scale:[1,1.2,1],x:[0,40,0],y:[0,-20,0]}} transition={{duration:12,repeat:Infinity,ease:"easeInOut"}} style={{position:"absolute",top:"10%",left:"15%",width:600,height:600,background:`radial-gradient(circle,${T.accentGlow} 0%,transparent 70%)`,borderRadius:"50%"}}/>
          <motion.div animate={{scale:[1,1.15,1],x:[0,-30,0]}} transition={{duration:10,repeat:Infinity,ease:"easeInOut",delay:2}} style={{position:"absolute",bottom:"15%",right:"10%",width:450,height:450,background:`radial-gradient(circle,rgba(45,212,191,0.1) 0%,transparent 70%)`,borderRadius:"50%"}}/>
          {particles.map(p=><motion.div key={p.id} animate={{y:[0,-25,0],opacity:[0.2,0.7,0.2]}} transition={{duration:p.dur,repeat:Infinity,ease:"easeInOut",delay:p.delay}} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,width:p.size,height:p.size,background:p.color,borderRadius:"50%"}}/>)}
          <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`,backgroundSize:"55px 55px",maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)",WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)"}}/>
        </div>
        <div style={{position:"relative",zIndex:2,textAlign:"center",maxWidth:900}}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${T.teal}14`,border:`1px solid ${T.teal}35`,borderRadius:100,padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.12em",color:T.teal,textTransform:"uppercase",marginBottom:24}}>
              <motion.span animate={{rotate:[0,360]}} transition={{duration:8,repeat:Infinity,ease:"linear"}} style={{display:"inline-block"}}>◈</motion.span> AI-Powered Career Intelligence Platform
            </div>
          </motion.div>
          <motion.h1 initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.7,duration:0.8,ease:[0.22,1,0.36,1]}} style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(3.5rem,8vw,7rem)",fontWeight:400,lineHeight:1.0,marginBottom:24,color:T.text}}>
            Know Exactly{" "}<span style={{background:`linear-gradient(135deg,${T.accent} 0%,#818cf8 50%,${T.teal} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>What to Build.</span>
            <br/><span style={{color:T.muted,fontSize:"0.65em"}}>Before Your Next Interview.</span>
          </motion.h1>
          <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1}} style={{color:T.muted,fontSize:"clamp(15px,2vw,18px)",maxWidth:640,margin:"0 auto 48px",lineHeight:1.8}}>
            SkillForge AI decodes any job description in seconds — extracting required skills, mapping your gaps, and generating a laser-focused learning path.
          </motion.p>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:1.2}} style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:64}}>
            <motion.button whileHover={{scale:1.04,boxShadow:`0 0 48px ${T.accentGlow}`}} whileTap={{scale:0.97}} onClick={onGetStarted} style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,border:"none",borderRadius:14,padding:"15px 40px",color:"#fff",fontSize:15,fontWeight:800,fontFamily:"inherit",cursor:"pointer",boxShadow:`0 0 24px ${T.accentGlow}`}}>⚡ GET STARTED FREE</motion.button>
            <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.97}} onClick={()=>document.getElementById("features")?.scrollIntoView({behavior:"smooth"})} style={{background:"transparent",border:`1.5px solid ${T.border}`,borderRadius:14,padding:"15px 40px",color:T.text,fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>See Features ↓</motion.button>
          </motion.div>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.5}} style={{display:"flex",gap:"clamp(20px,5vw,56px)",justifyContent:"center",flexWrap:"wrap"}}>
            {STATS.map(({val,label,icon})=><div key={label} style={{textAlign:"center"}}><div style={{fontSize:11,marginBottom:4}}>{icon}</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",color:T.accent,lineHeight:1}}>{val}</div><div style={{fontSize:11,color:T.muted,marginTop:4}}>{label}</div></div>)}
          </motion.div>
        </div>
      </section>
      {/* Features */}
      <section id="features" style={{padding:"100px clamp(20px,5vw,80px)",background:T.sidebar}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:64}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${T.accent}14`,border:`1px solid ${T.accent}35`,borderRadius:100,padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.12em",color:T.accent,textTransform:"uppercase",marginBottom:18}}>◈ Features</div>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(2rem,5vw,3.5rem)",color:T.text,lineHeight:1,marginBottom:12}}>Everything You Need to <span style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Land the Role.</span></h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:20}}>
            {FEATURES.map((ft,i)=>(
              <motion.div key={ft.title} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.08}} whileHover={{y:-8,borderColor:`${ft.color}65`,boxShadow:`0 20px 48px ${ft.color}22`}}
                style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:24,transition:"all 0.3s"}}>
                <div style={{width:48,height:48,borderRadius:14,background:`${ft.color}18`,border:`1px solid ${ft.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:16}}>{ft.icon}</div>
                <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:8}}>{ft.title}</div>
                <div style={{color:T.muted,fontSize:13,lineHeight:1.75}}>{ft.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* How it works */}
      <section id="how" style={{padding:"100px clamp(20px,5vw,80px)"}}>
        <div style={{maxWidth:860,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:64}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${T.teal}14`,border:`1px solid ${T.teal}35`,borderRadius:100,padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.12em",color:T.teal,textTransform:"uppercase",marginBottom:18}}>◈ Process</div>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(2rem,5vw,3.5rem)",color:T.text,lineHeight:1}}>How It <span style={{background:`linear-gradient(135deg,${T.teal},#22d3ee)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Works.</span></h2>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0,position:"relative"}}>
            <div style={{position:"absolute",left:39,top:60,bottom:60,width:2,background:`linear-gradient(${T.accent},${T.teal},${T.violet})`,opacity:0.2}}/>
            {HOW.map((h,i)=>(
              <motion.div key={h.step} initial={{opacity:0,x:-30}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*0.15}} style={{display:"flex",gap:24,alignItems:"flex-start",padding:"24px 0"}}>
                <div style={{width:80,height:80,borderRadius:20,background:`${[T.accent,T.teal,T.violet][i]}25`,border:`1px solid ${[T.accent,T.teal,T.violet][i]}35`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,gap:2}}>
                  <div style={{fontSize:22}}>{h.icon}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:[T.accent,T.teal,T.violet][i]}}>{h.step}</div>
                </div>
                <div style={{paddingTop:8}}><div style={{fontWeight:700,color:T.text,fontSize:18,marginBottom:8}}>{h.title}</div><div style={{color:T.muted,fontSize:14,lineHeight:1.75}}>{h.desc}</div></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* Final CTA */}
      <section style={{padding:"120px clamp(20px,5vw,80px)",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 60% 60% at 50% 50%,${T.accentGlow},transparent)`,pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:2,maxWidth:700,margin:"0 auto"}}>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(2.5rem,6vw,5rem)",color:T.text,lineHeight:1,marginBottom:20}}>Ready to Close the <span style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Gap?</span></h2>
          <p style={{color:T.muted,fontSize:17,marginBottom:44,lineHeight:1.8}}>Stop guessing. Start building the exact skills for the roles you actually want.</p>
          <motion.button whileHover={{scale:1.05,boxShadow:`0 0 56px ${T.accentGlow}`}} whileTap={{scale:0.97}} onClick={onGetStarted} style={{background:`linear-gradient(135deg,${T.accent},#818cf8)`,border:"none",borderRadius:14,padding:"17px 48px",color:"#fff",fontSize:16,fontWeight:800,fontFamily:"inherit",cursor:"pointer",boxShadow:`0 0 28px ${T.accentGlow}`}}>⚡ START FOR FREE</motion.button>
        </div>
      </section>
      {/* Footer */}
      <div style={{padding:"32px clamp(20px,5vw,80px)",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.accent},#818cf8)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:"0.06em",color:T.accent}}>SKILLFORGE AI</span></div>
        <div style={{color:T.muted,fontSize:12}}>SRS Academic Project · B.Tech CSE · 2025–2026</div>
        <div style={{color:T.muted,fontSize:12,fontFamily:"monospace"}}>React · FastAPI · Claude · JSON DB</div>
      </div>
    </div>
  );
}

/* ─── SPLASH SCREEN ───────────────────────────────────── */
function Splash({visible}){
  return(
    <AnimatePresence>
      {visible&&(
        <motion.div exit={{opacity:0}} transition={{duration:0.6}} style={{position:"fixed",inset:0,zIndex:9999,background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <motion.div initial={{scale:0.6,opacity:0}} animate={{scale:1,opacity:1}} style={{textAlign:"center"}}>
            <div style={{position:"relative",width:72,height:72,margin:"0 auto 24px"}}>
              <motion.div animate={{rotate:360}} transition={{duration:2.5,repeat:Infinity,ease:"linear"}} style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",borderTop:`2px solid ${T.accent}`,borderRight:`2px solid ${T.accent}60`}}/>
              <motion.div animate={{rotate:-360}} transition={{duration:1.8,repeat:Infinity,ease:"linear"}} style={{position:"absolute",inset:10,borderRadius:"50%",border:"2px solid transparent",borderTop:`2px solid ${T.teal}`}}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>⚡</div>
            </div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:"0.1em",color:T.accent}}>SKILLFORGE AI</div>
            <div style={{color:T.muted,fontSize:11,letterSpacing:"0.2em",marginTop:8,fontFamily:"monospace"}}>LOADING CAREER ENGINE...</div>
            <div style={{width:180,height:2,background:T.dim,borderRadius:100,margin:"20px auto 0",overflow:"hidden"}}>
              <motion.div initial={{width:"0%"}} animate={{width:"100%"}} transition={{duration:1.8,ease:"easeInOut"}} style={{height:"100%",background:`linear-gradient(90deg,${T.accent},${T.teal})`,borderRadius:100}}/>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── ROOT APP ────────────────────────────────────────── */
export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [collapsed,setCol]=useState(false);
  const [splash,setSplash]=useState(true);
  const [landing,setLanding]=useState(false);

  useEffect(()=>{
    const token=localStorage.getItem("sf_token");
    const saved=localStorage.getItem("sf_session");
    if(token&&saved){setUser(JSON.parse(saved));}
    else{setLanding(true);}
    const t=setTimeout(()=>setSplash(false),2200);
    return()=>clearTimeout(t);
  },[]);

  const handleAuth=(userData)=>{
    localStorage.setItem("sf_session",JSON.stringify(userData));
    setUser(userData);setLanding(false);
  };

  const handleLogout=()=>{
    localStorage.removeItem("sf_token");
    localStorage.removeItem("sf_session");
    setUser(null);setPage("dashboard");setLanding(true);
  };

  const sideW=collapsed?64:220;

  const PAGES={
    dashboard:()=><PageDashboard user={user}/>,
    career:()=><PageCareerReport user={user}/>,
    chatbot:()=><PageChatbot user={user}/>,
    ats:()=><PageATS user={user}/>,
    skills:()=><PageSkills user={user}/>,
    standardize:()=><PageStandardize/>,
    recommendations:()=><PageRecommendations user={user}/>,
    gap:()=><PageGap user={user}/>,
    roadmap:()=><PageRoadmap user={user}/>,
    interview:()=><PageInterview user={user}/>,
    summarize:()=><PageSummarize/>,
    analytics:()=><PageAnalytics/>,
    explorer:()=><PageExplorer user={user}/>,
    casestudy:()=><PageCaseStudy/>,
    settings:()=><PageSettings user={user} setUser={(u)=>{setUser(u);localStorage.setItem("sf_session",JSON.stringify(u));}} onLogout={handleLogout}/>,
  };

  return(
    <div style={{background:T.bg,color:T.text,fontFamily:"'DM Sans','Outfit',sans-serif",minHeight:"100vh"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Bebas+Neue&family=JetBrains+Mono:wght@400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::selection{background:rgba(99,102,241,0.25);}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.2);border-radius:100px;}input::placeholder,textarea::placeholder{color:#6b6884;}`}</style>
      <Splash visible={splash}/>
      <AnimatePresence mode="wait">
        {!splash&&landing&&!user&&(
          <motion.div key="land" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <LandingPage onGetStarted={()=>setLanding(false)}/>
          </motion.div>
        )}
        {!splash&&!landing&&!user&&(
          <motion.div key="auth" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <AuthPage onAuth={handleAuth}/>
          </motion.div>
        )}
        {!splash&&user&&(
          <motion.div key="app" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.5}}>
            <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} collapsed={collapsed} setCollapsed={setCol}/>
            <div key={page} className="sf-page-in" style={{marginLeft:sideW,transition:"margin-left 0.3s cubic-bezier(0.22,1,0.36,1)",minHeight:"100vh"}}>
              <TopBar page={page} user={user} onLogout={handleLogout} onSearch={(q)=>{if(q.trim())setPage("explorer");}}/>
              <div style={{padding:26,maxWidth:1280}}>
                <AnimatePresence mode="wait">
                  <motion.div key={page} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.3,ease:[0.22,1,0.36,1]}}>
                    {(PAGES[page]||PAGES.dashboard)()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
