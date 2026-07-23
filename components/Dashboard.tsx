'use client';
import {useEffect,useMemo,useState} from 'react';
import type {ConsultationEntry,Customer,IpRule,PendingAccess,Sensitivity,StaffMember,StaffRole,Stage} from '@/lib/types';
import {createClient} from '@/lib/supabase';

const STORAGE_KEY='botrader-crm-customers-final-v1';
const OLD_KEYS=['botrader-crm-customers-v4','botrader-crm-customers-v3','botrader-crm-customers-v2'];
const SECURITY_KEY='botrader-crm-security-final-v1';
const stages:Stage[]=['신규','상담중','텔레그램','거래소가입','입금','활성회원','휴면','종료'];
const grades:Sensitivity[]=['상','중','하','폐'];
const roles:StaffRole[]=['최고관리자','관리자','일반담당자'];

function localDate(d=new Date()){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDate(d)}
function today(){return localDate()}
function yesterday(){return addDays(today(),-1)}
function tomorrow(){return addDays(today(),1)}
function uid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function normalizeCustomer(raw:any):Customer{
 const history:Array<ConsultationEntry>=Array.isArray(raw.consultation_history)?raw.consultation_history.filter((x:any)=>x&&x.content).map((x:any)=>({id:x.id||uid(),date:x.date||raw.first_inbound_date||today(),content:String(x.content),created_at:x.created_at||new Date().toISOString()})):[];
 if(!history.length&&raw.consultation_notes){history.push({id:uid(),date:raw.first_inbound_date||today(),content:String(raw.consultation_notes),created_at:raw.updated_at||new Date().toISOString()});}
 return {...raw,id:raw.id||uid(),first_inbound_date:raw.first_inbound_date||today(),sensitivity:grades.includes(raw.sensitivity)?raw.sensitivity:'중',db_type:raw.db_type||'',inbound_content:raw.inbound_content??raw.inbound_message??'',name:raw.name||'',phone:raw.phone||'',telegram_alias:raw.telegram_alias??raw.telegram_name??'',telegram_joined:!!raw.telegram_joined,exchange_joined:!!raw.exchange_joined,exchange_name:raw.exchange_name||'',deposited:raw.deposited??raw.deposit_completed??(['입금','활성회원'].includes(raw.stage)),consultation_notes:history.map(x=>x.content).join('\n'),consultation_history:history,stage:stages.includes(raw.stage)?raw.stage:'신규',owner_name:raw.owner_name||'',next_contact_at:raw.next_contact_at||null,updated_at:raw.updated_at||new Date().toISOString()};
}
function blankCustomer():Customer{return normalizeCustomer({id:uid(),first_inbound_date:today(),sensitivity:'중',db_type:'개인텔',inbound_content:'',name:'',phone:'',telegram_alias:'',telegram_joined:false,exchange_joined:false,exchange_name:'',deposited:false,consultation_notes:'',consultation_history:[],stage:'신규',owner_name:'',next_contact_at:null,updated_at:new Date().toISOString()});}
function fmtDate(value:string){if(!value)return '-';const d=new Date(value+'T00:00:00');if(Number.isNaN(d.getTime()))return value;return `${d.getMonth()+1}/${d.getDate()}`}

const defaultStaff:StaffMember[]=[];
function mapRole(role:string):StaffRole{return role==='owner'?'최고관리자':(['admin','manager'].includes(role)?'관리자':'일반담당자')}
const defaultSecurity={mode:'승인된 IP만',koreaOnly:false,rules:[] as IpRule[],pending:[] as PendingAccess[]};

export default function Dashboard({initial,authenticatedUserId,onLogout}:{initial:Customer[],authenticatedUserId:string,onLogout:()=>void}){

 const supabase=useMemo(()=>createClient(),[]);

 const normalizedInitial=useMemo(()=>initial.map(normalizeCustomer),[initial]);
 const [customers,setCustomers]=useState<Customer[]>(normalizedInitial);
 const [staff,setStaff]=useState<StaffMember[]>(defaultStaff);
 const currentUserId=authenticatedUserId;
 const [security,setSecurity]=useState(defaultSecurity);
 const [loaded,setLoaded]=useState(false);
 const [q,setQ]=useState(''); const [grade,setGrade]=useState('전체'); const [dbType,setDbType]=useState('전체');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [editing,setEditing]=useState<Customer|null>(null);
 const [showStaff,setShowStaff]=useState(false);
 const [showDue,setShowDue]=useState(false);
 const [showTomorrow,setShowTomorrow]=useState(false);
 const [showSecurity,setShowSecurity]=useState(false);
 const [importing,setImporting]=useState(false);

 useEffect(()=>{
  async function load(){
    const {data,error}=await supabase
      .from('customers')
      .select('*')
      .order('created_at',{ascending:false});

    if(error){
      console.error(error);
      setCustomers([]);
    }else{
      setCustomers((data||[]).map(normalizeCustomer));
    }

    try{
      const {data:{session}}=await supabase.auth.getSession();

      if(session){
        const {data:myProfile,error:profileError}=await supabase
          .from('profiles')
          .select('id, login_id, email, display_name, role, active')
          .eq('id',session.user.id)
          .maybeSingle();

        if(profileError)throw profileError;

        if(myProfile){
          const me:StaffMember={
            id:myProfile.id,
            name:myProfile.display_name||myProfile.login_id||'사용자',
            username:myProfile.login_id||'',
            email:myProfile.email||'',
            role:mapRole(myProfile.role),
            active:!!myProfile.active
          };

          if(['owner','admin','manager'].includes(myProfile.role)){
            const response=await fetch('/api/staff',{headers:{Authorization:`Bearer ${session.access_token}`}});
            if(response.ok){
              const result=await response.json();
              setStaff((result.staff||[]).map((x:any)=>({
                id:x.id,
                name:x.display_name||x.login_id,
                username:x.login_id,
                email:x.email,
                role:mapRole(x.role),
                active:!!x.active
              })));
            }else{
              setStaff([me]);
            }
          }else{
            setStaff([me]);
          }
        }
      }

      const savedSecurity=JSON.parse(localStorage.getItem(SECURITY_KEY)||'null');
      if(savedSecurity)setSecurity({...defaultSecurity,...savedSecurity});
    }catch(error){console.error(error)}

    setLoaded(true);
  }

  load();
},[supabase]);


useEffect(()=>{
  if(loaded)localStorage.setItem(SECURITY_KEY,JSON.stringify(security));
},[security,loaded]);

 const currentUser=staff.find(s=>s.id===currentUserId&&s.active)||{id:currentUserId,name:'사용자',role:'일반담당자' as StaffRole,active:true};
 const isAdmin=currentUser.role==='최고관리자'||currentUser.role==='관리자';
 const scopedCustomers=useMemo(()=>isAdmin?customers:customers.filter(c=>c.owner_name===currentUser.name),[customers,currentUser.name,isAdmin]);
 const selected=scopedCustomers.find(x=>x.id===selectedId)||null;
 const dbTypes=useMemo(()=>Array.from(new Set(scopedCustomers.map(c=>c.db_type).filter(Boolean) as string[])).sort(),[scopedCustomers]);
 const rows=useMemo(()=>scopedCustomers.filter(c=>{const t=[c.name,c.phone,c.telegram_alias,c.inbound_content,c.owner_name,...c.consultation_history.map(x=>x.content)].join(' ').toLowerCase();return t.includes(q.toLowerCase())&&(grade==='전체'||c.sensitivity===grade)&&(dbType==='전체'||c.db_type===dbType)}),[scopedCustomers,q,grade,dbType]);
 const total=scopedCustomers.length;
 const countConsulted=(date:string)=>scopedCustomers.filter(c=>c.consultation_history.some(x=>x.date===date)).length;
 const yesterdayConsulted=countConsulted(yesterday());
 const todayConsulted=countConsulted(today());
 const tomorrowCustomers=useMemo(()=>scopedCustomers.filter(c=>c.next_contact_at===tomorrow()).sort((a,b)=>(a.owner_name||'').localeCompare(b.owner_name||'')),[scopedCustomers]);
 const dueCustomers=useMemo(()=>scopedCustomers.filter(c=>c.next_contact_at&&c.next_contact_at<=today()).sort((a,b)=>(a.next_contact_at||'').localeCompare(b.next_contact_at||'')),[scopedCustomers]);
 const assignableStaff=staff.filter(s=>s.active).map(s=>s.name);

 async function saveCustomer(c:Customer){
  const next=normalizeCustomer({
  ...c,
  owner_name:c.owner_name||currentUser.name,
  updated_at:new Date().toISOString()
});
  const alreadyExists=customers.some(x=>x.id===next.id);

  try{
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user)throw new Error('로그인 사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');

    const payload={
      first_inbound_date:next.first_inbound_date||null,
      sensitivity:next.sensitivity,
      db_type:next.db_type||null,
      inbound_message:next.inbound_content||null,
      name:next.name?.trim()||next.phone?.trim()||'이름 미입력',
      phone:next.phone||null,
      telegram_name:next.telegram_alias||null,
      telegram_joined:!!next.telegram_joined,
      exchange_joined:!!next.exchange_joined,
      exchange_name:next.exchange_name||null,
      deposit_completed:!!next.deposited,
      stage:next.stage,
      next_contact_at:next.next_contact_at||null,
      owner_name:next.owner_name||null,
      updated_at:next.updated_at
    };

    if(alreadyExists){
      const {data,error}=await supabase
        .from('customers')
        .update(payload)
        .eq('id',next.id)
        .select('*')
        .single();

      if(error)throw error;

      const saved=normalizeCustomer(data);
      setCustomers(prev=>prev.map(x=>x.id===saved.id?saved:x));
      setEditing(null);
      setSelectedId(saved.id);
      alert('고객 정보가 Supabase에 수정 저장되었습니다.');
      return;
    }

    const {data,error}=await supabase
      .from('customers')
      .insert({
        id:next.id,
        ...payload,
        created_by:user.id
      })
      .select('*')
      .single();

    if(error)throw error;

    const saved=normalizeCustomer(data);
    setCustomers(prev=>[saved,...prev]);
    setEditing(null);
    setSelectedId(saved.id);
    alert('신규 고객이 Supabase에 저장되었습니다.');
  }catch(error:any){
    console.error(error);
    alert(`저장 실패: ${error?.message||'권한 또는 입력값을 확인해 주세요.'}`);
  }
 }
 async function addConsultation(customerId:string,date:string,content:string,remindIn3Days:boolean){
  if(!content.trim())return;
  const customer=customers.find(c=>c.id===customerId);
  if(!customer)return;

  const entry:ConsultationEntry={id:uid(),date:date||today(),content:content.trim(),created_at:new Date().toISOString()};
  const history=[...customer.consultation_history,entry];
  const nextContactAt=remindIn3Days?addDays(date||today(),3):customer.next_contact_at;

  try{
   const {data,error}=await supabase
    .from('customers')
    .update({
     consultation_history:history,
     consultation_notes:history.map(x=>x.content).join('\n'),
     next_contact_at:nextContactAt,
     updated_at:new Date().toISOString()
    })
    .eq('id',customerId)
    .select('*')
    .single();

   if(error)throw error;
   const saved=normalizeCustomer(data);
   setCustomers(prev=>prev.map(c=>c.id===customerId?saved:c));
  }catch(error:any){
   console.error(error);
   alert(`메모 저장 실패: ${error?.message||'알 수 없는 오류'}`);
  }
 }
 async function deleteConsultation(customerId:string,entryId:string){
  if(!confirm('이 상담 기록을 삭제할까요?'))return;
  const customer=customers.find(c=>c.id===customerId);
  if(!customer)return;

  const history=customer.consultation_history.filter(x=>x.id!==entryId);

  try{
   const {data,error}=await supabase
    .from('customers')
    .update({
     consultation_history:history,
     consultation_notes:history.map(x=>x.content).join('\n'),
     updated_at:new Date().toISOString()
    })
    .eq('id',customerId)
    .select('*')
    .single();

   if(error)throw error;
   const saved=normalizeCustomer(data);
   setCustomers(prev=>prev.map(c=>c.id===customerId?saved:c));
  }catch(error:any){
   console.error(error);
   alert(`메모 삭제 실패: ${error?.message||'알 수 없는 오류'}`);
  }
 }
 function archiveCustomer(id:string){if(!confirm('이 고객을 종료 상태로 변경할까요? 데이터는 삭제되지 않습니다.'))return;setCustomers(p=>p.map(x=>x.id===id?{...x,stage:'종료',updated_at:new Date().toISOString()}:x));setSelectedId(null);}
 async function hardDeleteCustomer(id:string){
  if(!isAdmin)return;
  if(!confirm('관리자 전용 완전 삭제입니다. 복구할 수 없습니다. 계속할까요?'))return;

  try{
    const {error}=await supabase
      .from('customers')
      .delete()
      .eq('id',id);

    if(error)throw error;

    setCustomers(prev=>prev.filter(customer=>customer.id!==id));
    setSelectedId(null);
    alert('고객이 Supabase에서 완전히 삭제되었습니다.');
  }catch(error:any){
    console.error(error);
    alert(`삭제 실패: ${error?.message||'삭제 권한을 확인해 주세요.'}`);
  }
 }
 function resetData(){if(confirm('입력·수정한 내용을 모두 지우고 최초 데이터로 되돌릴까요?')){setCustomers(normalizedInitial);localStorage.removeItem(STORAGE_KEY);for(const key of OLD_KEYS)localStorage.removeItem(key);}}
 function download(){const blob=new Blob([JSON.stringify(customers,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='CRM_백업.json';a.click();URL.revokeObjectURL(a.href)}
 function upload(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(String(r.result));if(!Array.isArray(parsed))throw new Error();setCustomers(parsed.map(normalizeCustomer));alert('백업 파일을 불러왔습니다.')}catch{alert('CRM_백업.json 파일을 확인해 주세요.')}};r.readAsText(f);e.target.value='';}

 async function importCustomersToSupabase(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];
  e.target.value='';
  if(!file)return;
  if(!confirm(`${file.name}의 고객 데이터를 Supabase에 등록할까요?`))return;

  setImporting(true);
  try{
   const parsed=JSON.parse(await file.text());
   if(!Array.isArray(parsed))throw new Error('JSON 최상위 형식이 배열이 아닙니다.');

   const {data:{user},error:userError}=await supabase.auth.getUser();
   if(userError||!user)throw new Error('로그인 사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');

   const rows=parsed.map((raw:any,index:number)=>{
    const customer=normalizeCustomer(raw);
    return {
     id:customer.id,
     first_inbound_date:customer.first_inbound_date||null,
     sensitivity:customer.sensitivity,
     db_type:customer.db_type||null,
     inbound_message:customer.inbound_content||null,
     name:customer.name?.trim()||customer.phone?.trim()||`이름 미입력 ${index+1}`,
     phone:customer.phone||null,
     telegram_name:customer.telegram_alias||null,
     telegram_joined:!!customer.telegram_joined,
     exchange_joined:!!customer.exchange_joined,
     exchange_name:customer.exchange_name||null,
     deposit_completed:!!customer.deposited,
     stage:customer.stage,
     next_contact_at:customer.next_contact_at||null,
     created_by:user.id,
     updated_at:customer.updated_at||new Date().toISOString()
    };
   });

   let uploaded=0;
   for(let i=0;i<rows.length;i+=100){
    const batch=rows.slice(i,i+100);
    const {error}=await supabase.from('customers').upsert(batch,{onConflict:'id'});
    if(error)throw error;
    uploaded+=batch.length;
   }

   const {data,error}=await supabase
    .from('customers')
    .select('*')
    .order('created_at',{ascending:false});

   if(error)throw error;
   setCustomers((data||[]).map(normalizeCustomer));
   alert(`${uploaded}명 업로드 완료`);
  }catch(error:any){
   console.error(error);
   alert(`업로드 실패: ${error?.message||'파일 또는 권한을 확인해 주세요.'}`);
  }finally{
   setImporting(false);
  }
 }

 return <main className="wrap">
  <div className="top"><div><div className="title">CRM <span className="version">로컬 안정화 v1.1 · 로그인 적용</span></div><div className="roleNotice">현재 사용자: <b>{currentUser.name}</b> · {currentUser.role}{!isAdmin&&' · 본인 담당 DB만 표시'}</div></div><div className="topActions">
   {isAdmin&&<button onClick={()=>setShowStaff(true)}>사용자·관리자 관리</button>}{isAdmin&&<button onClick={()=>setShowSecurity(true)}>보안 관리</button>}<button onClick={onLogout}>로그아웃</button><button className="primary" onClick={()=>setEditing(blankCustomer())}>+ 신규 고객</button>
  </div></div>
  <section className="kpis"><div className="card kpi">전체 DB 수<strong>{total}</strong></div><div className="card kpi">전일 상담 수<strong>{yesterdayConsulted}</strong></div><div className="card kpi">오늘 상담 수<strong>{todayConsulted}</strong></div><button className="card kpi clickableKpi" onClick={()=>setShowTomorrow(true)}>내일 상담 예약<strong>{tomorrowCustomers.length}</strong><span>목록 보기</span></button></section>
  <div className="dueBanner" onClick={()=>setShowDue(true)}><div><b>오늘 연락해야 할 고객</b><span>예정일이 오늘이거나 지난 고객을 확인합니다.</span></div><strong>{dueCustomers.length}명</strong></div>
  <div className="toolbar"><input placeholder="이름·연락처·상담내용 검색" value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:300}}/><select value={grade} onChange={e=>setGrade(e.target.value)}><option>전체</option>{grades.map(x=><option key={x}>{x}</option>)}</select><select value={dbType} onChange={e=>setDbType(e.target.value)}><option>전체</option>{dbTypes.map(x=><option key={x}>{x}</option>)}</select><label className="buttonLike">백업 불러오기<input hidden type="file" accept="application/json" onChange={upload}/></label>{isAdmin&&<label className="buttonLike">{importing?'Supabase 업로드 중...':'기존 고객 Supabase 가져오기'}<input hidden type="file" accept="application/json" disabled={importing} onChange={importCustomersToSupabase}/></label>}<button onClick={download}>백업 다운로드</button>{isAdmin&&<button onClick={resetData}>초기화</button>}</div>
  <div className="tableHint">열 제목의 오른쪽 가장자리를 드래그하면 폭을 넓히거나 줄일 수 있습니다.</div>
  <div className="tableWrap"><table><thead><tr><ResizableTh label="최초 인입"/><ResizableTh label="감도"/><ResizableTh label="DB유형"/><ResizableTh label="DB유입메세지" wide/><ResizableTh label="이름/필명"/><ResizableTh label="연락처"/><ResizableTh label="텔레그램 필명"/><ResizableTh label="담당자"/><ResizableTh label="상담 횟수"/><ResizableTh label="상담내용" wide/></tr></thead><tbody>{rows.map(c=><tr key={c.id} className="clickable" onClick={()=>setSelectedId(c.id)}><td>{c.first_inbound_date||'-'}</td><td><span className={'badge '+({상:'high',중:'mid',하:'low',폐:'dead'}[c.sensitivity])}>{c.sensitivity}</span></td><td>{c.db_type||'-'}</td><td className="clipCell">{c.inbound_content||'-'}</td><td><b>{c.name||'-'}</b></td><td>{c.phone||'-'}</td><td>{c.telegram_alias||'-'}</td><td>{c.owner_name||'미배정'}</td><td><b>{c.consultation_history.length}회</b></td><td className="clipCell">{c.consultation_history.at(-1)?.content||'-'}</td></tr>)}</tbody></table></div>

  {selected&&!editing&&<CustomerDetail customer={selected} isAdmin={isAdmin} onClose={()=>setSelectedId(null)} onEdit={()=>setEditing({...selected,consultation_history:[...selected.consultation_history]})} onArchive={()=>archiveCustomer(selected.id)} onHardDelete={()=>hardDeleteCustomer(selected.id)} onAdd={addConsultation} onDeleteEntry={deleteConsultation}/>} 
  {editing&&<CustomerForm value={editing} owners={assignableStaff} onCancel={()=>setEditing(null)} onSave={saveCustomer}/>} 
  {showStaff&&<StaffManager staff={staff} onChange={setStaff} onClose={()=>setShowStaff(false)}/>} 
  {showDue&&<CustomerListModal title="오늘 연락해야 할 고객" subtitle="예정일이 오늘이거나 지난 고객입니다." customers={dueCustomers} onClose={()=>setShowDue(false)} onOpen={id=>{setShowDue(false);setSelectedId(id)}}/>}
  {showTomorrow&&<CustomerListModal title="내일 상담 예약 고객" subtitle="다음 연락일이 내일로 지정된 고객입니다." customers={tomorrowCustomers} onClose={()=>setShowTomorrow(false)} onOpen={id=>{setShowTomorrow(false);setSelectedId(id)}}/>}
  {showSecurity&&<SecurityManager value={security} onChange={setSecurity} onClose={()=>setShowSecurity(false)}/>} 
 </main>
}

function ResizableTh({label,wide=false}:{label:string,wide?:boolean}){return <th className={wide?'wideTh':''}><div className="thResize">{label}</div></th>}

function CustomerDetail({customer,isAdmin,onClose,onEdit,onArchive,onHardDelete,onAdd,onDeleteEntry}:{customer:Customer,isAdmin:boolean,onClose:()=>void,onEdit:()=>void,onArchive:()=>void,onHardDelete:()=>void,onAdd:(id:string,date:string,content:string,remindIn3Days:boolean)=>void,onDeleteEntry:(id:string,entryId:string)=>void}){
 const [date,setDate]=useState(today());const [content,setContent]=useState('');const [remind,setRemind]=useState(true);
 const sorted=[...customer.consultation_history].sort((a,b)=>a.date.localeCompare(b.date)||a.created_at.localeCompare(b.created_at));
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal detail"><div className="modalHead"><div><h2>{customer.name||'이름 없음'}</h2><div className="muted">{customer.phone||'연락처 없음'}{customer.telegram_alias?` · 텔레그램 ${customer.telegram_alias}`:''}</div></div><button onClick={onClose}>닫기</button></div>
 <div className="detailGrid"><Info label="감도" value={customer.sensitivity}/><Info label="DB유형" value={customer.db_type}/><Info label="최초 인입" value={customer.first_inbound_date}/><Info label="담당자" value={customer.owner_name||'미배정'}/><Info label="텔레그램" value={customer.telegram_joined?'입장':'미입장'}/><Info label="가입" value={customer.exchange_joined?'완료':'미가입'}/><Info label="입금" value={customer.deposited?'완료':'미입금'}/><Info label="상담 횟수" value={`${customer.consultation_history.length}회`}/><Info label="다음 연락일" value={customer.next_contact_at||'미정'}/><Info label="상태" value={customer.stage}/></div>
 <h3>DB유입메세지</h3><div className="noteBox pre">{customer.inbound_content||'-'}</div>
 <div className="sectionTitle"><h3>상담 내용</h3><span className="muted">메모를 남길 때마다 날짜별로 저장됩니다.</span></div>
 <div className="addMemo"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><textarea rows={3} placeholder="새 상담 내용을 입력하세요" value={content} onChange={e=>setContent(e.target.value)}/><button className="primary" onClick={()=>{if(!content.trim())return;onAdd(customer.id,date,content,remind);setContent('');}}>상담 메모 추가</button></div>
 <label className="remindCheck"><input type="checkbox" checked={remind} onChange={e=>setRemind(e.target.checked)}/> 메모 저장 후 3일 뒤 다시 연락 알림</label>
 <div className="timeline">{sorted.length?sorted.map(entry=><div className="timelineRow" key={entry.id}><div className="timelineDate">{fmtDate(entry.date)}</div><div className="timelineContent">{entry.content}</div><button className="entryDelete" title="상담 기록 삭제" onClick={()=>onDeleteEntry(customer.id,entry.id)}>삭제</button></div>):<div className="empty">등록된 상담 기록이 없습니다.</div>}</div>
 <div className="modalActions"><button className="warning" onClick={onArchive}>종료 처리</button>{isAdmin&&<button className="danger" onClick={onHardDelete}>완전 삭제</button>}<button className="primary" onClick={onEdit}>정보 수정</button></div></div></div>
}
function Info({label,value}:{label:string,value:any}){return <div className="info"><span>{label}</span><b>{value||'-'}</b></div>}
function CustomerForm({value,owners,onCancel,onSave}:{value:Customer,owners:string[],onCancel:()=>void,onSave:(c:Customer)=>void}){
 const [c,setC]=useState<Customer>(value);const set=(k:keyof Customer,v:any)=>setC(p=>({...p,[k]:v}));
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel()}}><form className="modal" onSubmit={e=>{e.preventDefault();onSave(c)}}><div className="modalHead"><h2>{value.name?'고객 정보 수정':'신규 고객 등록'}</h2><button type="button" onClick={onCancel}>닫기</button></div><div className="formGrid">
 <label>이름/필명<input required value={c.name||''} onChange={e=>set('name',e.target.value)}/></label><label>연락처<input value={c.phone||''} onChange={e=>set('phone',e.target.value)}/></label><label>텔레그램 필명<input value={c.telegram_alias||''} onChange={e=>set('telegram_alias',e.target.value)}/></label><label>최초 인입일<input type="date" value={c.first_inbound_date||''} onChange={e=>set('first_inbound_date',e.target.value)}/></label><label>DB유형<input value={c.db_type||''} onChange={e=>set('db_type',e.target.value)}/></label><label>감도<select value={c.sensitivity} onChange={e=>set('sensitivity',e.target.value)}>{grades.map(x=><option key={x}>{x}</option>)}</select></label><label>담당자<select value={c.owner_name||''} onChange={e=>set('owner_name',e.target.value)}><option value="">미배정</option>{owners.map(x=><option key={x}>{x}</option>)}</select></label><label>다음 연락일<input type="date" value={c.next_contact_at||''} onChange={e=>set('next_contact_at',e.target.value||null)}/></label><label>상태<select value={c.stage} onChange={e=>set('stage',e.target.value)}>{stages.map(x=><option key={x}>{x}</option>)}</select></label>
 <label className="check"><input type="checkbox" checked={!!c.telegram_joined} onChange={e=>set('telegram_joined',e.target.checked)}/> 텔레그램 입장</label><label className="check"><input type="checkbox" checked={!!c.exchange_joined} onChange={e=>set('exchange_joined',e.target.checked)}/> 가입</label><label className="check"><input type="checkbox" checked={!!c.deposited} onChange={e=>set('deposited',e.target.checked)}/> 입금</label><label className="wide">DB유입메세지<textarea rows={4} value={c.inbound_content||''} onChange={e=>set('inbound_content',e.target.value)}/></label>
 </div><div className="modalActions"><button type="button" onClick={onCancel}>취소</button><button className="primary" type="submit">저장</button></div></form></div>
}
function StaffManager({staff,onChange,onClose}:{staff:StaffMember[],onChange:(v:StaffMember[])=>void,onClose:()=>void}){
 const supabase=useMemo(()=>createClient(),[]);
 const [name,setName]=useState('');const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [role,setRole]=useState<StaffRole>('일반담당자');const [busy,setBusy]=useState(false);
 async function request(method:string,body?:any){
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('로그인이 만료되었습니다.');
  const response=await fetch('/api/staff',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:body?JSON.stringify(body):undefined});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'처리 실패');return result;
 }
 async function refresh(){const result=await request('GET');onChange((result.staff||[]).map((x:any)=>({id:x.id,name:x.display_name||x.login_id,username:x.login_id,email:x.email,role:mapRole(x.role),active:!!x.active})));}
 async function add(){
  const n=name.trim(),u=username.trim().toLowerCase();if(!n||!u||!password){alert('이름, 아이디, 비밀번호를 모두 입력해 주세요.');return;}
  setBusy(true);try{await request('POST',{displayName:n,loginId:u,password,role:role==='관리자'?'admin':'staff'});await refresh();setName('');setUsername('');setPassword('');setRole('일반담당자');alert('계정이 생성되었습니다.');}catch(e:any){alert(e.message)}finally{setBusy(false)}
 }
 async function remove(id:string){const member=staff.find(x=>x.id===id);if(!member||member.role==='최고관리자')return;if(!confirm(`${member.name} 계정을 비활성화할까요?`))return;setBusy(true);try{await request('PATCH',{id,action:'active',active:false});await refresh();}catch(e:any){alert(e.message)}finally{setBusy(false)}}
 async function activate(id:string){setBusy(true);try{await request('PATCH',{id,action:'active',active:true});await refresh();}catch(e:any){alert(e.message)}finally{setBusy(false)}}
 async function resetPassword(id:string){const next=prompt('새 비밀번호를 입력하세요. (8자 이상)');if(!next)return;setBusy(true);try{await request('PATCH',{id,action:'password',password:next});alert('비밀번호가 변경되었습니다.');}catch(e:any){alert(e.message)}finally{setBusy(false)}}
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modalHead"><div><h2>사용자·관리자 관리</h2><div className="muted">Supabase Auth에 실제 로그인 계정을 생성합니다.</div></div><button onClick={onClose}>닫기</button></div>
 <div className="staffAdd staffAddAuth"><input placeholder="이름" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="로그인 아이디" value={username} onChange={e=>setUsername(e.target.value)}/><input type="password" placeholder="비밀번호 8자 이상" value={password} onChange={e=>setPassword(e.target.value)}/><select value={role} onChange={e=>setRole(e.target.value as StaffRole)}>{roles.filter(x=>x!=='최고관리자').map(x=><option key={x}>{x}</option>)}</select><button className="primary" disabled={busy} onClick={()=>void add()}>{busy?'처리 중...':'계정 추가'}</button></div>
 <div className="ownerList">{staff.map(member=><div className="ownerRow" key={member.id}><div><b>{member.name}</b><span className="staffRole">아이디: {member.username||'미설정'} · {member.role}{!member.active?' · 비활성':''}</span></div><div className="accountActions">{member.active&&<button disabled={busy} onClick={()=>void resetPassword(member.id)}>비밀번호 변경</button>}{member.role!=='최고관리자'&&(member.active?<button disabled={busy} className="entryDelete" onClick={()=>void remove(member.id)}>비활성화</button>:<button disabled={busy} onClick={()=>void activate(member.id)}>활성화</button>)}</div></div>)}</div>
 <div className="notice">비밀번호는 Supabase Auth가 안전하게 관리하며 화면이나 데이터베이스에 원문으로 저장하지 않습니다.</div>
 </div></div>
}
function CustomerListModal({title,subtitle,customers,onClose,onOpen}:{title:string,subtitle:string,customers:Customer[],onClose:()=>void,onOpen:(id:string)=>void}){
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modalHead"><div><h2>{title}</h2><div className="muted">{subtitle}</div></div><button onClick={onClose}>닫기</button></div><div className="dueList">{customers.length?customers.map(c=><button className="dueRow" key={c.id} onClick={()=>onOpen(c.id)}><div><b>{c.name||'이름 없음'}</b><span>{c.owner_name||'미배정'} · 감도 {c.sensitivity} · 상담 {c.consultation_history.length}회</span></div><div className="dueDate">{c.next_contact_at===today()?'오늘':c.next_contact_at===tomorrow()?'내일':`${fmtDate(c.next_contact_at||'')} 예정`}</div></button>):<div className="empty">대상 고객이 없습니다.</div>}</div></div></div>
}
function SecurityManager({value,onChange,onClose}:{value:any,onChange:(v:any)=>void,onClose:()=>void}){
 const [ip,setIp]=useState('');const [label,setLabel]=useState('');const [type,setType]=useState<'화이트리스트'|'블랙리스트'>('화이트리스트');
 function addRule(){if(!ip.trim())return;onChange({...value,rules:[...value.rules,{id:uid(),ip:ip.trim(),label:label.trim(),type,created_at:new Date().toISOString()}]});setIp('');setLabel('');}
 function removeRule(id:string){onChange({...value,rules:value.rules.filter((r:IpRule)=>r.id!==id)});}
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modalHead"><div><h2>보안 관리</h2><div className="muted">화이트리스트·블랙리스트·접속 정책을 관리합니다.</div></div><button onClick={onClose}>닫기</button></div>
  <div className="notice securityNotice"><b>현재는 로컬 버전입니다.</b><br/>아래 설정은 저장되지만 실제 IP 차단은 온라인 공동사용 버전으로 배포한 뒤 서버에서 적용됩니다.</div>
  <div className="securityPolicy"><label>접속 제한 수준<select value={value.mode} onChange={e=>onChange({...value,mode:e.target.value})}><option>아무데서나 접속 가능</option><option>승인된 계정만</option><option>승인된 IP만</option><option>승인된 IP + 승인된 기기</option></select></label><label className="check"><input type="checkbox" checked={!!value.koreaOnly} onChange={e=>onChange({...value,koreaOnly:e.target.checked})}/> 한국에서만 접속 허용</label></div>
  <h3>IP 규칙 추가</h3><div className="securityAdd"><input placeholder="예: 123.45.67.89" value={ip} onChange={e=>setIp(e.target.value)}/><input placeholder="예: 강남 사무실" value={label} onChange={e=>setLabel(e.target.value)}/><select value={type} onChange={e=>setType(e.target.value as any)}><option>화이트리스트</option><option>블랙리스트</option></select><button className="primary" onClick={addRule}>추가</button></div>
  <div className="securityGrid"><div><h3>화이트리스트</h3>{value.rules.filter((r:IpRule)=>r.type==='화이트리스트').map((r:IpRule)=><div className="ruleRow" key={r.id}><div><b>{r.ip}</b><span>{r.label||'설명 없음'}</span></div><button onClick={()=>removeRule(r.id)}>삭제</button></div>)}{!value.rules.some((r:IpRule)=>r.type==='화이트리스트')&&<div className="empty">등록된 IP가 없습니다.</div>}</div><div><h3>블랙리스트</h3>{value.rules.filter((r:IpRule)=>r.type==='블랙리스트').map((r:IpRule)=><div className="ruleRow" key={r.id}><div><b>{r.ip}</b><span>{r.label||'설명 없음'}</span></div><button onClick={()=>removeRule(r.id)}>해제</button></div>)}{!value.rules.some((r:IpRule)=>r.type==='블랙리스트')&&<div className="empty">차단된 IP가 없습니다.</div>}</div></div>
  <h3>승인 대기</h3><div className="empty">온라인 배포 후 새로운 IP의 접속 요청이 이곳에 표시됩니다.</div>
 </div></div>
}
