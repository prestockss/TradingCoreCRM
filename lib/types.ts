export type Sensitivity='상'|'중'|'하'|'폐';
export type Stage='신규'|'상담중'|'텔레그램'|'거래소가입'|'입금'|'활성회원'|'휴면'|'종료';
export type StaffRole='최고관리자'|'관리자'|'일반담당자';
export interface ConsultationEntry { id:string; date:string; content:string; created_at:string; }
export interface Customer{
 id:string;
 first_inbound_date:string|null;
 sensitivity:Sensitivity;
 db_type:string|null;
 inbound_content:string|null;
 name:string|null;
 phone:string|null;
 telegram_alias:string|null;
 telegram_joined:boolean|null;
 exchange_joined:boolean|null;
 exchange_name:string|null;
 deposited:boolean|null;
 consultation_notes:string|null;
 consultation_history:ConsultationEntry[];
 stage:Stage;
 owner_name:string|null;
 next_contact_at:string|null;
 updated_at:string;
}
export interface StaffMember{ id:string; name:string; role:StaffRole; active:boolean; username?:string; passwordHash?:string; }
export type IpRuleType='화이트리스트'|'블랙리스트';
export interface IpRule{ id:string; ip:string; label:string; type:IpRuleType; created_at:string; }
export interface PendingAccess{ id:string; staff_name:string; ip:string; device:string; requested_at:string; }
