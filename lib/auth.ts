export const STAFF_KEY='botrader-crm-staff-final-v1';
export const SESSION_KEY='botrader-crm-session-final-v1';

export async function hashPassword(value:string){
  const data=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
