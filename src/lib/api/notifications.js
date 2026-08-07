import { supabase } from "../supabase.js";

export async function getNotifications() {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((n) => ({
    id: n.id, vendorId: n.vendor_id, message: n.message, read: n.read, createdAt: n.created_at,
    type: n.type || "general", seenByAdmin: n.seen_by_admin,
  }));
}

export async function createNotification({ vendorId, message, type, seenByAdmin }) {
  const finalType = type || "general";
  const { error } = await supabase.from("notifications").insert({
    vendor_id: vendorId, message, read: false, type: finalType,
    seen_by_admin: seenByAdmin !== undefined ? seenByAdmin : finalType === "general",
  });
  if (error) throw error;
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markNotificationSeenByAdmin(id) {
  const { error } = await supabase.from("notifications").update({ seen_by_admin: true }).eq("id", id);
  if (error) throw error;
}
