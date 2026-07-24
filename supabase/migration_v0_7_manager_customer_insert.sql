drop policy if exists "owners insert customers" on public.customers;
drop policy if exists "owners or managers insert customers" on public.customers;

create policy "owners or managers insert customers"
on public.customers
for insert
with check (
 auth.uid() = created_by
 and exists (
  select 1
  from public.profiles p
  where p.id = auth.uid()
   and p.active
   and (
    p.login_id = 'prestockss'
    or p.role::text in ('owner','admin','manager')
   )
 )
);
