# Vermaire Hoveniers

Website + contactformulier-API + admin portaal voor klantaanvragen en
contactpogingen. Statische site met serverless functies, klaar voor
**Vercel** + **Supabase**.

```
index.html            Publieke website
admin/index.html       Admin portaal  (/admin)
api/contact.js         POST  — slaat een aanvraag op (service role, RLS-bypass)
api/config.js          GET   — geeft publieke Supabase-config aan de admin
css/, js/, assets/      Front-end
supabase/schema.sql     Database-schema + Row Level Security
```

## 1. Supabase opzetten

1. Maak een project op [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, plak de inhoud van
   [`supabase/schema.sql`](supabase/schema.sql) en voer het uit.
3. Maak het admin-account aan: **Authentication → Users → Add user**,
   vul e-mail + wachtwoord in en zet **Auto Confirm** aan. Dit account
   gebruik je om in te loggen op `/admin`.
4. Noteer uit **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Naar Vercel deployen

1. Push deze repository naar GitHub (al gedaan).
2. Ga naar [vercel.com](https://vercel.com) → **Add New… → Project** en
   importeer de repo. Vercel detecteert automatisch de statische site en
   de functies in `api/` — er is geen build-stap nodig.
3. Zet bij **Settings → Environment Variables** de drie waarden uit stap 1
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) voor
   *Production* én *Preview*.
4. **Deploy.**

Resultaat:

| Pad        | Wat                                             |
|------------|-------------------------------------------------|
| `/`        | De website. Het contactformulier post naar `/api/contact`. |
| `/admin`   | Inlogscherm → dashboard met alle aanvragen.     |

## 3. Lokaal draaien (optioneel)

```bash
npm install
npm i -g vercel
cp .env.example .env.local   # vul je Supabase-waarden in
vercel dev                    # site + /api functies op localhost
```

Een gewone statische server (bv. `python3 -m http.server`) toont de site
wél, maar `/api/contact` werkt dan niet — daarvoor is `vercel dev` nodig.

## Beveiliging

- De `service_role`-sleutel staat **alleen** in serverless env vars en wordt
  nooit naar de browser gestuurd.
- De `anon`-sleutel is veilig publiek; **Row Level Security** zorgt dat
  alleen een ingelogde admin de `contact_requests`-tabel kan lezen of wijzigen.
- Het publieke formulier schrijft uitsluitend via `/api/contact` (server-side
  validatie + honeypot tegen bots).
- `/admin` krijgt `noindex, nofollow`.
