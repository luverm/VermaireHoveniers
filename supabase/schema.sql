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
drop policy if exists "authenticated_delete" on public.contact_requests;

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

create policy "authenticated_delete"
    on public.contact_requests
    for delete
    to authenticated
    using (true);

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
        project_id in (select id from public.projects where published = true)
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
    ('service1_title',       'Beplanting'),
    ('service1_description', 'Het juiste groen op de juiste plek. Wij selecteren en planten beplanting die past bij uw bodem, lichtval en stijl.'),
    ('service2_title',       'Groenadvies'),
    ('service2_description', 'Het juiste advies bespaart u geld en zorgen. Wij adviseren over plantkeuze, combinaties en duurzaam groen dat past bij uw tuin.'),
    ('service3_title',       'Onderhoud'),
    ('service3_description', 'Een tuin verdient continue zorg. Met onze onderhoudsbeurten houden wij uw tuin het hele jaar door verzorgd en netjes.'),
    ('contact_phone',    '+31 6 23 29 32 74'),
    ('contact_email',    'info@vermairehoveniers.nl'),
    ('contact_area',     'Wemeldinge & heel Zeeland'),
    ('footer_tagline',   'Uw tuin, onze passie.')
on conflict (key) do nothing;


-- ============================================================================
-- PLANNING — klanten, klussen, uren, materialen, agenda-feed
-- Let op: dit is bedrijfsdata. Anon krijgt NERGENS leesrechten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: klanten
-- ----------------------------------------------------------------------------
create table if not exists public.klanten (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    naam        text not null,
    bedrijf     text,
    email       text,
    telefoon    text,
    adres       text,
    postcode    text,
    plaats      text,
    notities    text,
    uurtarief   numeric(10,2),
    archived    boolean not null default false
);

create index if not exists klanten_naam_idx on public.klanten (naam);

drop trigger if exists klanten_touch on public.klanten;
create trigger klanten_touch
    before update on public.klanten
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Table: klussen
-- ----------------------------------------------------------------------------
create table if not exists public.klussen (
    id             uuid primary key default gen_random_uuid(),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    klant_id       uuid references public.klanten(id) on delete set null,
    titel          text not null,
    soort          text not null default 'onderhoud'
                     check (soort in ('beplanting','groenadvies','onderhoud','bezichtiging','anders')),
    start_tijd     timestamptz not null,
    eind_tijd      timestamptz not null,
    adres          text,
    omschrijving   text,
    status         text not null default 'gepland'
                     check (status in ('gepland','bezig','afgerond','geannuleerd')),
    prijsmodel     text not null default 'uurtarief'
                     check (prijsmodel in ('uurtarief','vast')),
    uurtarief      numeric(10,2),
    vast_bedrag    numeric(10,2),
    weersgevoelig  boolean not null default false,
    gefactureerd   boolean not null default false,
    check (eind_tijd > start_tijd)
);

create index if not exists klussen_start_idx        on public.klussen (start_tijd);
create index if not exists klussen_klant_idx        on public.klussen (klant_id);
create index if not exists klussen_gefactureerd_idx on public.klussen (gefactureerd, status);

drop trigger if exists klussen_touch on public.klussen;
create trigger klussen_touch
    before update on public.klussen
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Table: uren  (fase 2 UI, tabel nu al aangemaakt zodat je het schema maar
--               één keer hoeft te draaien)
-- ----------------------------------------------------------------------------
create table if not exists public.uren (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    klus_id       uuid not null references public.klussen(id) on delete cascade,
    datum         date not null default current_date,
    aantal        numeric(6,2) not null,
    omschrijving  text
);

create index if not exists uren_klus_idx on public.uren (klus_id);

-- ----------------------------------------------------------------------------
-- Table: materialen  (fase 2 UI)
-- ----------------------------------------------------------------------------
create table if not exists public.materialen (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    klus_id       uuid not null references public.klussen(id) on delete cascade,
    omschrijving  text not null,
    aantal        numeric(10,2) not null default 1,
    inkoopprijs   numeric(10,2),
    bedrag        numeric(10,2) not null default 0
);

create index if not exists materialen_klus_idx on public.materialen (klus_id);

-- ----------------------------------------------------------------------------
-- Table: agenda_feed — één rij met het geheime token voor de ICS-feed.
-- Staat bewust NIET in site_settings, want die tabel is publiek leesbaar.
-- ----------------------------------------------------------------------------
create table if not exists public.agenda_feed (
    id          boolean primary key default true check (id),
    token       text not null default encode(gen_random_bytes(24), 'hex'),
    updated_at  timestamptz not null default now()
);

insert into public.agenda_feed (id) values (true) on conflict (id) do nothing;

drop trigger if exists agenda_feed_touch on public.agenda_feed;
create trigger agenda_feed_touch
    before update on public.agenda_feed
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security — uitsluitend authenticated (de admin). Geen anon-toegang.
-- De ICS-feed draait server-side op de service role en omzeilt RLS bewust.
-- ----------------------------------------------------------------------------
alter table public.klanten     enable row level security;
alter table public.klussen     enable row level security;
alter table public.uren        enable row level security;
alter table public.materialen  enable row level security;
alter table public.agenda_feed enable row level security;

drop policy if exists "admin_all_klanten"     on public.klanten;
drop policy if exists "admin_all_klussen"     on public.klussen;
drop policy if exists "admin_all_uren"        on public.uren;
drop policy if exists "admin_all_materialen"  on public.materialen;
drop policy if exists "admin_all_agenda_feed" on public.agenda_feed;

create policy "admin_all_klanten"     on public.klanten
    for all to authenticated using (true) with check (true);

create policy "admin_all_klussen"     on public.klussen
    for all to authenticated using (true) with check (true);

create policy "admin_all_uren"        on public.uren
    for all to authenticated using (true) with check (true);

create policy "admin_all_materialen"  on public.materialen
    for all to authenticated using (true) with check (true);

create policy "admin_all_agenda_feed" on public.agenda_feed
    for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Table: admin_settings — interne instellingen (tarieven, btw, SnelStart-link).
-- Bewust apart van site_settings: die tabel is publiek leesbaar, deze niet.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_settings (
    key         text primary key,
    value       text,
    updated_at  timestamptz not null default now()
);

drop trigger if exists admin_settings_touch on public.admin_settings;
create trigger admin_settings_touch
    before update on public.admin_settings
    for each row execute function public.touch_updated_at();

alter table public.admin_settings enable row level security;

drop policy if exists "admin_all_admin_settings" on public.admin_settings;
create policy "admin_all_admin_settings" on public.admin_settings
    for all to authenticated using (true) with check (true);

insert into public.admin_settings (key, value) values
    ('standaard_uurtarief',        '55.00'),
    ('btw_percentage',             '21'),
    ('snelstart_url',              'https://web.snelstart.nl/'),
    ('agenda_herinnering_minuten', '60')
on conflict (key) do nothing;
