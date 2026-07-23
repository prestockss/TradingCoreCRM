-- 일반담당자는 상담 기록과 다음 연락일만 수정할 수 있습니다.
-- 최고관리자와 부관리자는 기존처럼 모든 고객정보를 수정할 수 있습니다.

create or replace function public.enforce_agent_customer_edit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  select p.role::text
    into actor_role
  from public.profiles p
  where p.id = auth.uid()
    and p.active;

  if actor_role = 'agent' and
     (to_jsonb(new) - array[
       'consultation_history',
       'consultation_notes',
       'next_contact_at',
       'updated_at'
     ]) is distinct from
     (to_jsonb(old) - array[
       'consultation_history',
       'consultation_notes',
       'next_contact_at',
       'updated_at'
     ])
  then
    raise exception '일반담당자는 상담내용과 다음 연락일만 수정할 수 있습니다.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_agent_customer_edit_fields
on public.customers;

create trigger enforce_agent_customer_edit_fields
before update on public.customers
for each row
execute function public.enforce_agent_customer_edit_fields();
