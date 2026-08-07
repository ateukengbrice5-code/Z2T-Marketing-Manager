import { supabase } from "../supabase.js";

export async function logActivity(currentUser, eventType, description, metadata) {
  if (!currentUser) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    await supabase.functions.invoke("log-activity", {
      body: { eventType, description, metadata: metadata || {} },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (e) {
    console.error("Erreur d'enregistrement du journal d'activité", e);
  }
}

export async function getActivityLog() {
  const { data, error } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  return (data || []).map((a) => ({
    id: a.id, userId: a.user_id, username: a.username, eventType: a.event_type,
    description: a.description, createdAt: a.created_at,
    ipAddress: a.ip_address, device: a.device, metadata: a.metadata || {},
  }));
}

export async function getAllUsers() {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth?.user?.id;
  const { data, error } = await supabase.from("profiles").select("*").order("role").order("username");
  if (error) throw error;
  return (data || [])
    .filter((p) => p.id !== myId)
    .map((p) => ({ id: p.id, username: p.username, role: p.role, vendorId: p.vendor_id, isOnline: !!p.is_online, lastSeenAt: p.last_seen_at }));
}

export async function getSecondaryAdmins() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "admin").eq("is_primary", false);
  if (error) throw error;
  return (data || []).map((u) => ({ id: u.id, username: u.username }));
}
