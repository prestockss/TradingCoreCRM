-- TradingCoreCRM v0.2 직원 계정 기능 마이그레이션
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.

alter table public.profiles add column if not exists login_id text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists active boolean not null default true;

create unique index if not exists profiles_login_id_unique
on public.profiles (lower(login_id)) where login_id is not null;

alter table public.customers add column if not exists owner_name text;
alter table public.customers add column if not exists inbound_message text;
alter table public.customers add column if not exists telegram_name text;
alter table public.customers add column if not exists deposit_completed boolean default false;

-- 기존 대표계정과 아이디 prestockss 연결
update public.profiles
set login_id = 'prestockss',
    display_name = coalesce(nullif(display_name,''),'대표계정'),
    active = true
where lower(email) = 'prestockss@gmail.com';
