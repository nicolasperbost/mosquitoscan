-- Cloud-backed storage for authenticated accounts. Kept deliberately as
-- jsonb blobs (rather than fully normalized columns) mirroring RoomModel /
-- DetectionEvent as they exist in src/types/room.ts — this avoids having to
-- write and maintain a second schema migration every time those client-side
-- types evolve (they already have several optional fields added over
-- several iterations: source, deviceLabel, insectCategory, harmonicRatio...).
-- Trade-off: no server-side querying/filtering on individual fields without
-- casting jsonb — acceptable for now since all filtering happens client-side
-- anyway (history.tsx, devices.tsx).
--
-- IMPORTANT: unlike detections_sensors/site_maps/analysis_calls (open access
-- by design, per the "no user accounts yet" instruction), these two tables
-- are scoped per-user from the start, since this is precisely the
-- foundation for turning the app into a paid product with real per-account
-- data. Do not open these RLS policies up.

create table if not exists public.cloud_rooms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cloud_rooms enable row level security;

create policy "Users can read their own room"
  on public.cloud_rooms for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own room"
  on public.cloud_rooms for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own room"
  on public.cloud_rooms for update
  using (auth.uid() = user_id);

create table if not exists public.cloud_detections (
  row_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The app's own DetectionEvent.id (e.g. "det_1720000000000",
  -- "sd-filename-...") — kept distinct from row_id so upserts from the
  -- client can target "this specific detection" without depending on
  -- row_id, which the client never sees.
  detection_id text not null,
  detection jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, detection_id)
);

create index if not exists cloud_detections_user_created_idx
  on public.cloud_detections (user_id, created_at desc);

alter table public.cloud_detections enable row level security;

create policy "Users can read their own detections"
  on public.cloud_detections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own detections"
  on public.cloud_detections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own detections"
  on public.cloud_detections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own detections"
  on public.cloud_detections for delete
  using (auth.uid() = user_id);
