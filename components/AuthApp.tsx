'use client';
import {useEffect,useState} from 'react';
import Dashboard from '@/components/Dashboard';
import type {Customer,StaffMember} from '@/lib/types';
import {hashPassword,SESSION_KEY,STAFF_KEY} from '@/lib/auth';

const root:StaffMember={id:'owner-root',name:'대표',role:'최고관리자',active:true,username:'',passwordHash:''};

export default function AuthApp({initial}:{initial:Customer[]}){
 const [ready,setReady]=useState(false);
 const [staff,setStaff]=useState<StaffMember[]>([]);
 const [session,setSession]=useState<string|null>(null);
 const [mode,setMode]=useState<'setup'|'login'>('login');
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [password2,setPassword2]=useState('');
 const [error,setError]=useState('');

 useEffect(()=>{
  try{
   const saved=JSON.parse(localStorage.getItem(STAFF_KEY)||'[]') as StaffMember[];
   const normalized=(Array.isArray(saved)&&saved.length?saved:[root]).map(s=>({...s,username:s.username||'',passwordHash:s.passwordHash||''}));
   setStaff(normalized);
   const hasCredential=normalized.some(s=>s.active&&s.username&&s.passwordHash);
   setMode(hasCredential?'login':'setup');
   const savedSession=localStorage.getItem(SESSION_KEY);
   if(savedSession&&normalized.some(s=>s.id===savedSession&&s.active&&s.username&&s.passwordHash))setSession(savedSession);
  }catch{setStaff([root]);setMode('setup');}
  setReady(true);
 },[]);

 async function setup(){
  setError('');
  if(username.trim().length<4)return setError('아이디는 4자 이상 입력해 주세요.');
  if(password.length<8)return setError('비밀번호는 8자 이상 입력해 주세요.');
  if(password!==password2)return setError('비밀번호 확인이 일치하지 않습니다.');
  const hash=await hashPassword(password);
  const current=staff.length?staff:[root];
  const updated=current.map((s,i)=>s.role==='최고관리자'||i===0?{...s,id:s.id||'owner-root',name:s.name||'대표',role:'최고관리자',active:true,username:username.trim(),passwordHash:hash}:s);
  localStorage.setItem(STAFF_KEY,JSON.stringify(updated));
  localStorage.setItem(SESSION_KEY,updated[0].id);
  setStaff(updated);setSession(updated[0].id);setPassword('');setPassword2('');
 }

 async function login(){
  setError('');
  const hash=await hashPassword(password);
  const user=staff.find(s=>s.active&&s.username===username.trim()&&s.passwordHash===hash);
  if(!user)return setError('아이디 또는 비밀번호가 올바르지 않습니다.');
  localStorage.setItem(SESSION_KEY,user.id);setSession(user.id);setPassword('');
 }
 function logout(){localStorage.removeItem(SESSION_KEY);setSession(null);setUsername('');setPassword('');setMode('login');}

 if(!ready)return <main className="loginShell"><div className="loginCard"><h1>CRM</h1><p>불러오는 중입니다.</p></div></main>;
 if(session)return <Dashboard initial={initial} authenticatedUserId={session} onLogout={logout}/>;
 return <main className="loginShell"><div className="loginCard">
  <div className="loginBrand">CRM <span>로컬 안정화 v1.1</span></div>
  <h1>{mode==='setup'?'최고관리자 계정 만들기':'로그인'}</h1>
  <p className="muted">{mode==='setup'?'처음 한 번만 대표 계정의 아이디와 비밀번호를 설정합니다.':'등록된 계정으로 로그인해 주세요.'}</p>
  <label>아이디<input autoFocus value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&mode==='login')login()}} placeholder="아이디 입력"/></label>
  <label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&mode==='login')login()}} placeholder="8자 이상"/></label>
  {mode==='setup'&&<label>비밀번호 확인<input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} placeholder="비밀번호 다시 입력"/></label>}
  {error&&<div className="loginError">{error}</div>}
  <button className="primary loginButton" onClick={mode==='setup'?setup:login}>{mode==='setup'?'대표 계정 생성':'로그인'}</button>
  <div className="loginNotice">현재 로컬 버전의 계정은 이 컴퓨터 브라우저에 저장됩니다. 온라인 공동사용 전환 시 서버 인증으로 교체됩니다.</div>
 </div></main>
}
