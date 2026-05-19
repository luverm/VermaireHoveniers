-- ============================================================================
-- VERMAIRE HOVENIERS — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table: contact_requests
-- Stores klant aanvragen (offerteaanvragen) en contactpogingen vanuit de site.
-- ----------------------------------------------------------------------------
create table if not exists public.contact_requests (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    name        text        not null,
    email       text        not null,
    phone       text,
    service     text,
    message     text,
    status      text        not null default 'nieuw'
                  check (status in ('nieuw','gecontacteerd','afgerond','gearchiveerd')),
    source      text        not null default 'website',
    ip_hash     text,
    user_agent  text
);

create index if not exists contact_requests_created_at_idx
    on public.contact_requests (created_at desc);

create index if not exists contact_requests_status_idx
    on public.contact_requests (status);

-- ----------------------------------------------------------------------------
-- Row Level Security
--   - anon role: NO access (the public form writes via the service role key
--     in the /api/contact serverless function, which bypasses RLS).
--   - authenticated role (the admin who logs in): read + update.
-- ----------------------------------------------------------------------------
alter table public.contact_requests enable row level security;

drop policy if exists "authenticated_read"   on public.contact_requests;
drop policy if exists "authenticated_update" on public.contact_requests;

create policy "authenticated_read"
    on public.contact_requests
    for select
    to authenticated
    using (true);

create policy "authenticated_update"
    on public.contact_requests
    for update
    to authenticated
    using (true)
    with check (true);

-- ----------------------------------------------------------------------------
-- Admin account
-- Create the admin login in the Supabase Dashboard:
--   Authentication → Users → Add user → (email + password, "Auto Confirm").
-- That account is what you use to sign in at /admin.
-- ----------------------------------------------------------------------------
