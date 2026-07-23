create table if not exists public.ip_allowlist (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete cascade,
 ip_address inet not null,
 label text,
 status text check(status in ('pending','approved','blocked')) default 'pending',
 approved_by uuid references public.profiles(id),
 approved_at timestamptz,
 last_seen_at timestamptz
);

alter table public.ip_allowlist enable row level security;

create unique index if not exists ip_blacklist_global_unique
on public.ip_allowlist (ip_address)
where status = 'blocked' and user_id is null;
