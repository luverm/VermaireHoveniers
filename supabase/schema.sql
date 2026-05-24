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


-- ============================================================================
-- Projects + Site Settings + Storage
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: projects
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    title       text not null,
    description text,
    location    text,
    sort_order  integer not null default 0,
    published   boolean not null default true
);

create index if not exists projects_sort_idx       on public.projects (sort_order, created_at desc);
create index if not exists projects_published_idx  on public.projects (published);

-- Auto-bump updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
    before update on public.projects
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Table: project_photos
-- ----------------------------------------------------------------------------
create table if not exists public.project_photos (
    id            uuid primary key default gen_random_uuid(),
    project_id    uuid not null references public.projects(id) on delete cascade,
    storage_path  text not null,
    alt           text,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now()
);

create index if not exists project_photos_idx on public.project_photos (project_id, sort_order);

-- ----------------------------------------------------------------------------
-- Table: site_settings (key-value editable site copy)
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
    key         text primary key,
    value       text,
    updated_at  timestamptz not null default now()
);

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
    before update on public.site_settings
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
--   Public (anon) can READ published projects, their photos, and site_settings.
--   Authenticated (admin) has FULL access.
-- ----------------------------------------------------------------------------
alter table public.projects       enable row level security;
alter table public.project_photos enable row level security;
alter table public.site_settings  enable row level security;

drop policy if exists "public_read_projects"        on public.projects;
drop policy if exists "admin_all_projects"          on public.projects;
drop policy if exists "public_read_project_photos"  on public.project_photos;
drop policy if exists "admin_all_project_photos"    on public.project_photos;
drop policy if exists "public_read_site_settings"   on public.site_settings;
drop policy if exists "admin_all_site_settings"     on public.site_settings;

create policy "public_read_projects" on public.projects
    for select to anon using (published = true);

create policy "public_read_project_photos" on public.project_photos
    for select to anon using (
        exists (select 1 from public.projects p where p.id = project_id and p.published = true)
    );

create policy "public_read_site_settings" on public.site_settings
    for select to anon using (true);

create policy "admin_all_projects" on public.projects
    for all to authenticated using (true) with check (true);

create policy "admin_all_project_photos" on public.project_photos
    for all to authenticated using (true) with check (true);

create policy "admin_all_site_settings" on public.site_settings
    for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Storage bucket for project photos
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public_read_project_photos_storage" on storage.objects;
drop policy if exists "admin_upload_project_photos"        on storage.objects;
drop policy if exists "admin_update_project_photos"        on storage.objects;
drop policy if exists "admin_delete_project_photos"        on storage.objects;

create policy "public_read_project_photos_storage" on storage.objects
    for select to anon using (bucket_id = 'project-photos');

create policy "admin_upload_project_photos" on storage.objects
    for insert to authenticated with check (bucket_id = 'project-photos');

create policy "admin_update_project_photos" on storage.objects
    for update to authenticated using (bucket_id = 'project-photos');

create policy "admin_delete_project_photos" on storage.objects
    for delete to authenticated using (bucket_id = 'project-photos');

-- ----------------------------------------------------------------------------
-- Default site_settings seed (only inserted if missing — won't overwrite edits)
-- ----------------------------------------------------------------------------
insert into public.site_settings (key, value) values
    ('hero_tagline',     'Hoveniers in Zeeland'),
    ('hero_title',       'Uw tuin, onze passie'),
    ('hero_description', 'Wij verzorgen uw tuin met aandacht en vakmanschap — van beplanting tot groenadvies en onderhoud. Uw groen, in vertrouwde handen.'),
    ('stat1_number',     '30'),
    ('stat1_label',      'Tevreden klanten'),
    ('stat2_number',     '6'),
    ('stat2_label',      'Jaar ervaring'),
    ('about_paragraph1', 'Vermaire Hoveniers is gespecialiseerd in beplanting, groenadvies en onderhoud. Geen aanleg — wel alle aandacht voor het groen dat uw tuin tot leven brengt, met meer dan 6 jaar ervaring in heel Zeeland.'),
    ('about_paragraph2', 'Wij werken met oog voor detail, persoonlijk advies en oprechte betrokkenheid bij elke tuin die wij verzorgen.'),
    ('contact_phone',    '+31 6 23 29 32 74'),
    ('contact_email',    'info@vermairehoveniers.nl'),
    ('contact_area',     'Wemeldinge & heel Zeeland'),
    ('footer_tagline',   'Uw tuin, onze passie.')
on conflict (key) do nothing;
