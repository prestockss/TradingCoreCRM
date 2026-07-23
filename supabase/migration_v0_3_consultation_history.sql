alter table public.customers
add column if not exists consultation_notes text;

alter table public.customers
add column if not exists consultation_history jsonb
not null default '[]'::jsonb;
