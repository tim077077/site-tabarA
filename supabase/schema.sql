-- =====================================================================
-- Corturi Făgăraș — Supabase schema + validated RPC functions.
-- Already applied to the live project (xtpozqhfjtjyepymchaz).
-- Kept here for reproducibility: run this on a fresh project to recreate
-- the backend, then set assets/config.js to that project's URL + key.
-- Default admin PIN is 1234 — change it from the admin panel after launch.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table public.camp_settings (
  id int primary key default 1,
  event_name text not null default 'Tabăra Făgăraș',
  booking_open boolean not null default true,
  admin_pin_hash text not null,
  constraint camp_settings_one_row check (id = 1)
);

create table public.camp_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender char(1) not null check (gender in ('M','F')),
  created_at timestamptz not null default now()
);

create table public.camp_tents (
  id uuid primary key default gen_random_uuid(),
  name text,
  gender char(1) not null check (gender in ('M','F')),
  capacity int not null check (capacity between 1 and 12),
  created_by uuid references public.camp_participants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.camp_assignments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.camp_participants(id) on delete cascade,
  tent_id uuid not null references public.camp_tents(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.camp_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.camp_participants(id) on delete set null,
  participant_ids uuid[] not null default '{}',
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

insert into public.camp_settings (id, admin_pin_hash)
values (1, extensions.crypt('1234', extensions.gen_salt('bf')));

-- RLS: anon may READ the non-sensitive tables; all writes go through the
-- SECURITY DEFINER functions below. settings + requests have no policies
-- (no direct anon access at all).
alter table public.camp_settings enable row level security;
alter table public.camp_participants enable row level security;
alter table public.camp_tents enable row level security;
alter table public.camp_assignments enable row level security;
alter table public.camp_requests enable row level security;
create policy anon_read_participants on public.camp_participants for select using (true);
create policy anon_read_tents on public.camp_tents for select using (true);
create policy anon_read_assignments on public.camp_assignments for select using (true);

-- ===== identity + invitations (migrations identity_and_invites, authed_tents_and_invites) =====
-- Phone-as-secret + per-user token (deny-all: no anon access, only via functions)
create table public.camp_secrets (
  participant_id uuid primary key references public.camp_participants(id) on delete cascade,
  phone_norm text,
  token uuid not null default gen_random_uuid()
);
alter table public.camp_secrets enable row level security;

-- invitations (invitee accepts on their own device; nobody is force-added)
create table public.camp_invites (
  id uuid primary key default gen_random_uuid(),
  tent_id uuid not null references public.camp_tents(id) on delete cascade,
  invitee_id uuid not null references public.camp_participants(id) on delete cascade,
  inviter_id uuid references public.camp_participants(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.camp_invites enable row level security;
create policy anon_read_invites on public.camp_invites for select using (true);

-- Functions (see migrations for full bodies):
--   verify_identity(id, phone) -> token   (the "login")
--   create_tent / join_tent / leave_tent / invite_to_tent / respond_invite /
--   get_my_invites / create_request  — ALL take (p_actor, p_token) and verify it
--   via camp_auth() so only the real person can act.
--   admin_* (incl. admin_set_gender / admin_set_phone) gated by bcrypt PIN.
-- Internal helpers are not exposed to anon:
revoke execute on function public.camp_check_pin(text) from anon, authenticated, public;
-- revoke execute on function public.camp_auth(uuid, uuid) from anon, authenticated, public;
-- revoke execute on function public.camp_norm_phone(text) from anon, authenticated, public;
