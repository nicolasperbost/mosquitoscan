-- Pro Dashboard foundation (inspired by the Gemini mockup's information
-- architecture: sites → zones → alerts → reports), rebuilt on real data and
-- scoped per authenticated account (see lot 4's auth foundation) rather
-- than the mockup's hardcoded/random data.
--
-- Deliberately does NOT include any HACCP/ARS compliance claim or
-- certificate concept — see the conversation flag on that. Reports built
-- on this schema must stay factual ("intervention log", "detection
-- summary"), never a sanitary compliance certificate.

create table if not exists public.pro_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_name text,
  address text,
  lat numeric,
  lng numeric,
  active_traps integer not null default 0,
  last_inspection date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_sites_user_idx on public.pro_sites (user_id);

alter table public.pro_sites enable row level security;

create policy "Users manage their own sites (select)"
  on public.pro_sites for select using (auth.uid() = user_id);
create policy "Users manage their own sites (insert)"
  on public.pro_sites for insert with check (auth.uid() = user_id);
create policy "Users manage their own sites (update)"
  on public.pro_sites for update using (auth.uid() = user_id);
create policy "Users manage their own sites (delete)"
  on public.pro_sites for delete using (auth.uid() = user_id);

-- Real, persisted risk zones per site (replaces the mockup's fictional
-- "directional sonar cones" with a plain marker-on-plan model, consistent
-- with what expertise.tsx / site-map.tsx already do elsewhere in the app).
create table if not exists public.pro_zones (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.pro_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  risk_level text not null check (risk_level in ('critique', 'eleve', 'modere', 'faible')),
  risk_factor text,
  recommendation text,
  trap_installed boolean not null default false,
  rel_x numeric, -- 0..1 position on the site's plan image, like SitePoint
  rel_y numeric,
  created_at timestamptz not null default now()
);

create index if not exists pro_zones_site_idx on public.pro_zones (site_id);

alter table public.pro_zones enable row level security;

create policy "Users manage their own zones (select)"
  on public.pro_zones for select using (auth.uid() = user_id);
create policy "Users manage their own zones (insert)"
  on public.pro_zones for insert with check (auth.uid() = user_id);
create policy "Users manage their own zones (update)"
  on public.pro_zones for update using (auth.uid() = user_id);
create policy "Users manage their own zones (delete)"
  on public.pro_zones for delete using (auth.uid() = user_id);

-- Human-entered timeline events (treatments, inspections, notes) — real
-- equivalent of the mockup's TimelineEvent, but actually persisted and
-- entered by a real operator rather than fixture data.
create table if not exists public.pro_interventions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.pro_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('treatment', 'inspection', 'sensor', 'note')),
  title text not null,
  description text,
  operator text,
  created_at timestamptz not null default now()
);

create index if not exists pro_interventions_site_idx on public.pro_interventions (site_id, created_at desc);

alter table public.pro_interventions enable row level security;

create policy "Users manage their own interventions (select)"
  on public.pro_interventions for select using (auth.uid() = user_id);
create policy "Users manage their own interventions (insert)"
  on public.pro_interventions for insert with check (auth.uid() = user_id);
create policy "Users manage their own interventions (update)"
  on public.pro_interventions for update using (auth.uid() = user_id);
create policy "Users manage their own interventions (delete)"
  on public.pro_interventions for delete using (auth.uid() = user_id);
