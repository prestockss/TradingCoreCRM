alter type public.user_role add value if not exists 'manager';

do $$
declare policy_record record;
begin
 for policy_record in
  select policyname
  from pg_policies
  where schemaname = 'public'
   and tablename = 'customers'
   and cmd = 'SELECT'
 loop
  execute format('drop policy if exists %I on public.customers', policy_record.policyname);
 end loop;
end $$;

create policy "role based customer read"
on public.customers
for select
using (
 exists (
  select 1
  from public.profiles p
  where p.id = auth.uid()
   and p.active
   and (
    p.login_id = 'prestockss'
    or p.role::text in ('owner','admin','manager')
    or public.customers.owner_name = p.display_name
   )
 )
);

drop policy if exists "agents insert customers" on public.customers;
drop policy if exists "owners insert customers" on public.customers;

create policy "owners insert customers"
on public.customers
for insert
with check (
 auth.uid() = created_by
 and exists (
  select 1
  from public.profiles p
  where p.id = auth.uid()
   and p.active
   and (p.login_id = 'prestockss' or p.role::text = 'owner')
 )
);
