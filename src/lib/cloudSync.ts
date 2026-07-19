import { supabase } from "@/integrations/supabase/client";
import type { RoomModel, DetectionEvent } from "@/types/room";

/** Best-effort push — failures are logged but never thrown, since sync must
 *  never block or break the local-first UX that already works without an
 *  account. A signed-in user with a flaky connection should still be able
 *  to use the app exactly like a signed-out one. */
export async function pushRoomToCloud(userId: string, room: RoomModel): Promise<void> {
  const { error } = await supabase
    .from("cloud_rooms")
    .upsert({ user_id: userId, room: room as unknown as Record<string, unknown>, updated_at: new Date().toISOString() });
  if (error) console.warn("[cloudSync] pushRoomToCloud failed", error);
}

export async function pushDetectionToCloud(userId: string, detection: DetectionEvent): Promise<void> {
  const { error } = await supabase.from("cloud_detections").upsert(
    {
      user_id: userId,
      detection_id: detection.id,
      detection: detection as unknown as Record<string, unknown>,
    },
    { onConflict: "user_id,detection_id" },
  );
  if (error) console.warn("[cloudSync] pushDetectionToCloud failed", error);
}

export interface CloudSnapshot {
  room: RoomModel | null;
  detections: DetectionEvent[];
}

/** Pulls everything for this user. Called once on sign-in to hydrate local
 *  state — see mergeCloudIntoLocal() in roomStore.ts for how this combines
 *  with whatever was already stored locally (e.g. detections captured while
 *  signed out, before this account existed on this device). */
export async function pullCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  const [{ data: roomRow, error: roomError }, { data: detRows, error: detError }] = await Promise.all([
    supabase.from("cloud_rooms").select("room").eq("user_id", userId).maybeSingle(),
    supabase
      .from("cloud_detections")
      .select("detection")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (roomError) console.warn("[cloudSync] pullCloudSnapshot room failed", roomError);
  if (detError) console.warn("[cloudSync] pullCloudSnapshot detections failed", detError);

  const room = roomRow?.room
    ? ({
        ...(roomRow.room as RoomModel),
        createdAt: new Date((roomRow.room as RoomModel).createdAt),
      } as RoomModel)
    : null;

  const detections: DetectionEvent[] = (detRows ?? []).map((r) => {
    const d = r.detection as DetectionEvent;
    return { ...d, timestamp: new Date(d.timestamp) };
  });

  return { room, detections };
}
