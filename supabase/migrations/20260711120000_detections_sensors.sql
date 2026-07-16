-- Detections pushed by fixed WiFi sensors via the ingest-sensor edge
-- function. Kept as a separate table from the client-only localStorage
-- roomStore detections (src/lib/roomStore.ts) since these arrive
-- server-side, out of band, and need to be readable by any client
-- subscribed to the site's realtime channel.
--
-- The app is in open-access mode for now (no user accounts), so RLS is
-- enabled with an open read policy. Tighten this (e.g. scope to an
-- authenticated account_id) once the paid/account tier is introduced —
-- do not leave open reads in place once real customer data lands here.

create table if not exists public.detections_sensors (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  device_label text,
  recorded_at timestamptz not null default now(),
  peak_frequency numeric not null,
  snr numeric not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 100),
  species_hint text,
  created_at timestamptz not null default now()
);

create index if not exists detections_sensors_device_id_idx on public.detections_sensors (device_id);
create index if not exists detections_sensors_recorded_at_idx on public.detections_sensors (recorded_at desc);

alter table public.detections_sensors enable row level security;

-- Open read policy: acceptable while the app has no accounts. Revisit before
-- introducing paid multi-tenant access.
create policy "Anyone can read sensor detections"
  on public.detections_sensors
  for select
  using (true);

-- No public insert policy: rows are written exclusively by the ingest-sensor
-- edge function using the service role key, never directly from the client.
