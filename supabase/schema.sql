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
    ('agenda_herinnering_minuten', '60'),
    ('weer_plaats',                'Wemeldinge')
on conflict (key) do nothing;


-- ============================================================================
-- TERUGKERENDE KLUSSEN
-- Onderhoud is herhaling: elke vier weken bij dezelfde tuin. Een reeks legt
-- het patroon vast; de losse klussen worden er echt uit weggeschreven, zodat
-- de agenda-feed, de weerwaarschuwingen en de facturatie er niets van hoeven
-- te weten.
-- ============================================================================

create table if not exists public.klus_reeksen (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    klant_id        uuid references public.klanten(id) on delete set null,
    titel           text not null,
    soort           text not null default 'onderhoud'
                      check (soort in ('beplanting','groenadvies','onderhoud','bezichtiging','anders')),

    -- Het patroon. De weekdag volgt uit start_datum, dus die vragen we niet
    -- apart: kiest hij dinsdag 14 april, dan is het elke dinsdag.
    start_datum     date not null,
    tot_datum       date,                       -- leeg = doorlopend
    interval_weken  integer not null default 4
                      check (interval_weken between 1 and 52),
    start_tijd      time not null,
    eind_tijd       time not null,

    -- Wordt overgenomen in elke klus die eruit ontstaat.
    adres           text,
    omschrijving    text,
    prijsmodel      text not null default 'uurtarief'
                      check (prijsmodel in ('uurtarief','vast')),
    uurtarief       numeric(10,2),
    vast_bedrag     numeric(10,2),
    weersgevoelig   boolean not null default false,

    actief          boolean not null default true,
    check (eind_tijd > start_tijd),
    check (tot_datum is null or tot_datum >= start_datum)
);

create index if not exists klus_reeksen_actief_idx on public.klus_reeksen (actief, start_datum);

drop trigger if exists klus_reeksen_touch on public.klus_reeksen;
create trigger klus_reeksen_touch
    before update on public.klus_reeksen
    for each row execute function public.touch_updated_at();

-- Koppeling vanuit een klus terug naar zijn reeks.
--   reeks_id      — uit welke reeks deze klus komt (leeg = losse klus)
--   losgekoppeld  — handmatig aangepast, dus bij het bijwerken van de reeks
--                   met rust laten
alter table public.klussen add column if not exists
    reeks_id uuid references public.klus_reeksen(id) on delete set null;
alter table public.klussen add column if not exists
    losgekoppeld boolean not null default false;

create index if not exists klussen_reeks_idx on public.klussen (reeks_id);

alter table public.klus_reeksen enable row level security;

drop policy if exists "admin_all_klus_reeksen" on public.klus_reeksen;
create policy "admin_all_klus_reeksen" on public.klus_reeksen
    for all to authenticated using (true) with check (true);


-- ============================================================================
-- MATERIALEN EN GEREEDSCHAP
-- Twee soorten in één catalogus:
--   gereedschap — gaat mee en komt weer mee terug, niet doorbelast
--   verbruik    — gaat op bij de klant en kan doorbelast worden
-- Beide komen als afvinklijst in de omschrijving van de agenda-afspraak.
--
-- Let op: geen aanleg-materiaal (bestrating, schuttingen). Vermaire doet
-- beplanting, groenadvies en onderhoud.
-- ============================================================================

create table if not exists public.materiaal_catalogus (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now(),
    naam        text not null unique,
    categorie   text not null default 'Overig',
    soort       text not null default 'verbruik'
                  check (soort in ('gereedschap','verbruik')),
    eenheid     text not null default 'stuk',
    sort_order  integer not null default 0,
    actief      boolean not null default true,
    eigen       boolean not null default false   -- zelf toegevoegd, geen standaardlijst
);

create index if not exists materiaal_catalogus_idx
    on public.materiaal_catalogus (actief, categorie, sort_order);

alter table public.materiaal_catalogus enable row level security;

drop policy if exists "admin_all_materiaal_catalogus" on public.materiaal_catalogus;
create policy "admin_all_materiaal_catalogus" on public.materiaal_catalogus
    for all to authenticated using (true) with check (true);

-- De regels per klus hangen aan de bestaande tabel materialen. omschrijving
-- blijft de naam; die wordt gekopieerd zodat het hernoemen van een
-- catalogusregel de geschiedenis van een oude klus niet verandert.
alter table public.materialen add column if not exists
    catalogus_id uuid references public.materiaal_catalogus(id) on delete set null;
alter table public.materialen add column if not exists
    soort text not null default 'verbruik' check (soort in ('gereedschap','verbruik'));
alter table public.materialen add column if not exists
    eenheid text not null default 'stuk';
alter table public.materialen add column if not exists
    afgevinkt boolean not null default false;
alter table public.materialen add column if not exists
    sort_order integer not null default 0;

-- ----------------------------------------------------------------------------
-- Standaardlijst. Eenmalig gevuld; eigen aanvullingen blijven staan omdat
-- er op naam niets wordt overschreven.
-- ----------------------------------------------------------------------------
insert into public.materiaal_catalogus (naam, categorie, soort, eenheid, sort_order) values
    -- Handgereedschap
    ('Snoeischaar',            'Handgereedschap', 'gereedschap', 'stuk',  10),
    ('Takkenschaar',           'Handgereedschap', 'gereedschap', 'stuk',  11),
    ('Handheggenschaar',       'Handgereedschap', 'gereedschap', 'stuk',  12),
    ('Snoeizaag',              'Handgereedschap', 'gereedschap', 'stuk',  13),
    ('Telescoopsnoeier',       'Handgereedschap', 'gereedschap', 'stuk',  14),
    ('Spade',                  'Handgereedschap', 'gereedschap', 'stuk',  15),
    ('Schep',                  'Handgereedschap', 'gereedschap', 'stuk',  16),
    ('Spitvork',               'Handgereedschap', 'gereedschap', 'stuk',  17),
    ('Bladhark',               'Handgereedschap', 'gereedschap', 'stuk',  18),
    ('Grondhark',              'Handgereedschap', 'gereedschap', 'stuk',  19),
    ('Schoffel',               'Handgereedschap', 'gereedschap', 'stuk',  20),
    ('Onkruidkrabber',         'Handgereedschap', 'gereedschap', 'stuk',  21),
    ('Plantschep',             'Handgereedschap', 'gereedschap', 'stuk',  22),
    ('Grondboor',              'Handgereedschap', 'gereedschap', 'stuk',  23),
    ('Straatbezem',            'Handgereedschap', 'gereedschap', 'stuk',  24),
    ('Kruiwagen',              'Handgereedschap', 'gereedschap', 'stuk',  25),
    ('Emmer',                  'Handgereedschap', 'gereedschap', 'stuk',  26),
    ('Gieter',                 'Handgereedschap', 'gereedschap', 'stuk',  27),
    ('Tuinslang',              'Handgereedschap', 'gereedschap', 'stuk',  28),
    ('Rolmaat',                'Handgereedschap', 'gereedschap', 'stuk',  29),
    ('Waterpas',               'Handgereedschap', 'gereedschap', 'stuk',  30),

    -- Machines
    ('Accuheggenschaar',       'Machines', 'gereedschap', 'stuk',  40),
    ('Bosmaaier',              'Machines', 'gereedschap', 'stuk',  41),
    ('Grasmaaier',             'Machines', 'gereedschap', 'stuk',  42),
    ('Kantensteker',           'Machines', 'gereedschap', 'stuk',  43),
    ('Bladblazer',             'Machines', 'gereedschap', 'stuk',  44),
    ('Kettingzaag',            'Machines', 'gereedschap', 'stuk',  45),
    ('Hakselaar',              'Machines', 'gereedschap', 'stuk',  46),
    ('Verticuteermachine',     'Machines', 'gereedschap', 'stuk',  47),
    ('Accu en lader',          'Machines', 'gereedschap', 'stuk',  48),
    ('Mengsmering',            'Machines', 'verbruik',    'liter', 49),
    ('Benzine',                'Machines', 'verbruik',    'liter', 50),
    ('Kettingzaagolie',        'Machines', 'verbruik',    'liter', 51),
    ('Maaidraad',              'Machines', 'verbruik',    'rol',   52),
    ('Verlengsnoer',           'Machines', 'gereedschap', 'stuk',  53),
    ('Aggregaat',              'Machines', 'gereedschap', 'stuk',  54),

    -- Grond en bodem
    ('Potgrond',               'Grond en bodem', 'verbruik', 'zak', 60),
    ('Tuinaarde',              'Grond en bodem', 'verbruik', 'm3',  61),
    ('Compost',                'Grond en bodem', 'verbruik', 'm3',  62),
    ('Boomschors',             'Grond en bodem', 'verbruik', 'm3',  63),
    ('Houtsnippers',           'Grond en bodem', 'verbruik', 'm3',  64),
    ('Cacaodoppen',            'Grond en bodem', 'verbruik', 'zak', 65),
    ('Ophoogzand',             'Grond en bodem', 'verbruik', 'm3',  66),
    ('Split',                  'Grond en bodem', 'verbruik', 'm3',  67),
    ('Organische mest',        'Grond en bodem', 'verbruik', 'zak', 68),
    ('Korrelmest',             'Grond en bodem', 'verbruik', 'kg',  69),
    ('Kalk',                   'Grond en bodem', 'verbruik', 'zak', 70),
    ('Bodemverbeteraar',       'Grond en bodem', 'verbruik', 'zak', 71),

    -- Beplanting
    ('Worteldoek',             'Beplanting', 'verbruik', 'm2',   80),
    ('Gronddoekpennen',        'Beplanting', 'verbruik', 'stuk', 81),
    ('Vaste planten',          'Beplanting', 'verbruik', 'stuk', 82),
    ('Heesters',               'Beplanting', 'verbruik', 'stuk', 83),
    ('Haagplanten',            'Beplanting', 'verbruik', 'stuk', 84),
    ('Bomen',                  'Beplanting', 'verbruik', 'stuk', 85),
    ('Bloembollen',            'Beplanting', 'verbruik', 'stuk', 86),
    ('Graszaad',               'Beplanting', 'verbruik', 'kg',   87),
    ('Graszoden',              'Beplanting', 'verbruik', 'm2',   88),
    ('Boompaal',               'Beplanting', 'verbruik', 'stuk', 89),
    ('Boomband',               'Beplanting', 'verbruik', 'stuk', 90),
    ('Bindtouw',               'Beplanting', 'verbruik', 'rol',  91),
    ('Bamboestokken',          'Beplanting', 'verbruik', 'stuk', 92),
    ('Plantenvoeding',         'Beplanting', 'verbruik', 'stuk', 93),
    ('Druppelslang',           'Beplanting', 'verbruik', 'm',    94),

    -- Afvoer
    ('Bigbag leeg',            'Afvoer', 'verbruik',    'stuk', 100),
    ('Groenafval afvoeren',    'Afvoer', 'verbruik',    'm3',   101),
    ('Snoeiafval afvoeren',    'Afvoer', 'verbruik',    'm3',   102),
    ('Aanhanger',              'Afvoer', 'gereedschap', 'stuk', 103),
    ('Dekkleed',               'Afvoer', 'gereedschap', 'stuk', 104),
    ('Spanbanden',             'Afvoer', 'gereedschap', 'stuk', 105),
    ('Vuilniszakken',          'Afvoer', 'verbruik',    'stuk', 106),

    -- Veiligheid
    ('Werkhandschoenen',       'Veiligheid', 'gereedschap', 'paar', 110),
    ('Veiligheidsbril',        'Veiligheid', 'gereedschap', 'stuk', 111),
    ('Gehoorbescherming',      'Veiligheid', 'gereedschap', 'stuk', 112),
    ('Veiligheidsschoenen',    'Veiligheid', 'gereedschap', 'paar', 113),
    ('Zaagbroek',              'Veiligheid', 'gereedschap', 'stuk', 114),
    ('Helm met vizier',        'Veiligheid', 'gereedschap', 'stuk', 115),
    ('Kniebeschermers',        'Veiligheid', 'gereedschap', 'paar', 116),
    ('EHBO-koffer',            'Veiligheid', 'gereedschap', 'stuk', 117),
    ('Pionnen',                'Veiligheid', 'gereedschap', 'stuk', 118),
    ('Afzetlint',              'Veiligheid', 'gereedschap', 'rol',  119),

    -- Overig
    ('Ladder',                 'Overig', 'gereedschap', 'stuk', 130),
    ('Trap',                   'Overig', 'gereedschap', 'stuk', 131),
    ('Zeil',                   'Overig', 'gereedschap', 'stuk', 132),
    ('Verlichting',            'Overig', 'gereedschap', 'stuk', 133),
    ('Drinkwater',             'Overig', 'gereedschap', 'stuk', 134)
on conflict (naam) do nothing;
