import { supabase } from "./supabase.js";

// -----------------------------------------------------------------------------
// Authentification — tout le monde se connecte avec un simple nom
// d'utilisateur (aucun vrai e-mail requis, pour rester simple). En coulisses,
// on fabrique une adresse technique invisible pour Supabase.
// -----------------------------------------------------------------------------

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@z2t.local`;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getMyProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
  if (error) return null;
  return {
    id: data.id, username: data.username, role: data.role,
    vendorId: data.vendor_id, isPrimary: data.is_primary,
  };
}

// -----------------------------------------------------------------------------
// Présence (statut en ligne / hors ligne)
// -----------------------------------------------------------------------------

export async function setPresence(userId, isOnline) {
  try {
    if (isOnline) {
      await supabase.rpc("touch_last_seen");
    } else {
      await supabase.from("profiles").update({ is_online: false, last_seen_at: new Date().toISOString() }).eq("id", userId);
    }
  } catch (e) {
    console.error("Erreur de mise à jour de présence", e);
  }
}

// Statut de présence de chaque vendeur ayant un compte de connexion
export async function getVendorPresence() {
  const { data, error } = await supabase.from("profiles").select("vendor_id, is_online, last_seen_at").eq("role", "vendor").not("vendor_id", "is", null);
  if (error) throw error;
  const map = {};
  (data || []).forEach((p) => { map[p.vendor_id] = { isOnline: !!p.is_online, lastSeenAt: p.last_seen_at }; });
  return map;
}

export async function hasAnyAccount() {
  const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  if (error) return true; // en cas de doute, ne pas proposer de recréer un admin
  return (count || 0) > 0;
}

// Tout premier compte administrateur (aucun compte n'existe encore)
export async function createFirstAdmin(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("Création du compte impossible (vérifie que les inscriptions par e-mail sont activées dans Supabase).");
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId, username: username.trim(), role: "admin", vendor_id: null, is_primary: true,
  });
  if (profileError) throw new Error(profileError.message);
  return true;
}

export async function signIn(username, password) {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Identifiant ou mot de passe incorrect.");
  return getMyProfile();
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Création d'un compte vendeur, gestionnaire ou administrateur secondaire par
// un admin/manager déjà connecté. Passe par une fonction Supabase Edge (voir
// supabase/functions/manage-user) pour ne pas déconnecter la session en cours.
export async function createAccount({ username, password, role, vendorId }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-user", {
    body: { action: "create", username, password, role, vendorId: vendorId || null },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(error.message || "Erreur lors de la création du compte.");
  if (data?.error) throw new Error(data.error);
  return true;
}

export async function deleteAccount(userId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-user", {
    body: { action: "delete", userId },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(error.message || "Erreur lors de la suppression du compte.");
  if (data?.error) throw new Error(data.error);
  return true;
}

export async function getSecondaryAdmins() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "admin").eq("is_primary", false);
  if (error) throw error;
  return (data || []).map((u) => ({ id: u.id, username: u.username }));
}

// -----------------------------------------------------------------------------
// Journal d'activité (comptes administrateurs secondaires uniquement)
// -----------------------------------------------------------------------------

// N'enregistre rien pour l'admin principal — voir App.jsx, appelé seulement
// quand currentUser est un admin secondaire. Passe par une fonction Edge pour
// capturer l'adresse IP et l'appareil côté serveur (impossible depuis le navigateur).
export async function logActivity(currentUser, eventType, description, metadata) {
  if (!currentUser || currentUser.role !== "admin" || currentUser.isPrimary) return;
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

// -----------------------------------------------------------------------------
// Annuaire — tous les utilisateurs de la plateforme
// -----------------------------------------------------------------------------

export async function getAllUsers() {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth?.user?.id;
  const { data, error } = await supabase.from("profiles").select("*").order("role").order("username");
  if (error) throw error;
  return (data || [])
    .filter((p) => p.id !== myId)
    .map((p) => ({ id: p.id, username: p.username, role: p.role, vendorId: p.vendor_id, isOnline: !!p.is_online, lastSeenAt: p.last_seen_at }));
}

// -----------------------------------------------------------------------------
// Messagerie directe — n'importe quel utilisateur peut écrire à n'importe qui
// -----------------------------------------------------------------------------

// Récupère (ou crée) la conversation directe entre l'utilisateur connecté et un autre
export async function getOrCreateDMConversation(otherUserId) {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user.id;
  const { data: existing, error: selErr } = await supabase
    .from("dm_conversations").select("id")
    .or(`and(user_a.eq.${myId},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${myId})`)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;
  const { data: created, error: insErr } = await supabase
    .from("dm_conversations").insert({ user_a: myId, user_b: otherUserId }).select("id").single();
  if (insErr) throw insErr;
  return created.id;
}

export async function getDMMessages(conversationId) {
  const { data, error } = await supabase.from("dm_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, senderUsername: m.sender_username,
    content: m.content, read: m.read, createdAt: m.created_at, editedAt: m.edited_at, deletedAt: m.deleted_at,
    attachmentUrl: m.attachment_url, attachmentType: m.attachment_type,
  }));
}

export async function sendDMMessage({ conversationId, senderId, senderUsername, content, attachmentUrl, attachmentType }) {
  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: conversationId, sender_id: senderId, sender_username: senderUsername, content,
    attachment_url: attachmentUrl || null, attachment_type: attachmentType || null,
  });
  if (error) throw error;
  await supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function markDMMessagesRead(conversationId, myUserId) {
  const { error } = await supabase.from("dm_messages").update({ read: true }).eq("conversation_id", conversationId).neq("sender_id", myUserId).eq("read", false);
  if (error) throw error;
}

// Nombre de messages non lus, groupés par conversation, pour l'utilisateur connecté
export async function getDMUnreadCounts() {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user.id;
  const { data: convs, error: convErr } = await supabase.from("dm_conversations").select("id, user_a, user_b").or(`user_a.eq.${myId},user_b.eq.${myId}`);
  if (convErr) throw convErr;
  const myConvIds = (convs || []).map((c) => c.id);
  if (myConvIds.length === 0) return {};
  const { data, error } = await supabase.from("dm_messages").select("conversation_id").in("conversation_id", myConvIds).eq("read", false).neq("sender_id", myId).is("deleted_at", null);
  if (error) throw error;
  const byConv = {};
  (data || []).forEach((m) => { byConv[m.conversation_id] = (byConv[m.conversation_id] || 0) + 1; });
  // Reformate par "autre utilisateur" pour un affichage direct dans l'annuaire
  const byOtherUser = {};
  (convs || []).forEach((c) => {
    if (!byConv[c.id]) return;
    const otherId = c.user_a === myId ? c.user_b : c.user_a;
    byOtherUser[otherId] = byConv[c.id];
  });
  return byOtherUser;
}

export async function editDMMessage(id, newContent) {
  const { error } = await supabase.from("dm_messages").update({ content: newContent, edited_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteDMMessage(id) {
  const { error } = await supabase.from("dm_messages").update({ deleted_at: new Date().toISOString(), content: "" }).eq("id", id);
  if (error) throw error;
}

// Pièce jointe : upload dans le bucket "attachments", rangée par conversation
export async function uploadDMAttachment(conversationId, file) {
  const ext = file.name.split(".").pop();
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data: signed, error: urlErr } = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (urlErr) throw urlErr;
  return { url: signed.signedUrl, type: file.type, path };
}

// Toutes les conversations de la plateforme, en lecture seule — réservé à
// l'administrateur principal (la RLS ne l'autorise que pour lui).
export async function getAllConversations() {
  const { data: convs, error } = await supabase.from("dm_conversations").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  if (!convs || convs.length === 0) return [];
  const userIds = Array.from(new Set(convs.flatMap((c) => [c.user_a, c.user_b])));
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, username, role").in("id", userIds);
  if (pErr) throw pErr;
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return convs.map((c) => ({
    id: c.id,
    userA: byId[c.user_a] || { username: "Compte supprimé" },
    userB: byId[c.user_b] || { username: "Compte supprimé" },
    updatedAt: c.updated_at,
  }));
}

// -----------------------------------------------------------------------------
// Produits
// -----------------------------------------------------------------------------

export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*").order("nom");
  if (error) throw error;
  return (data || []).map((p) => ({ id: p.id, nom: p.nom, prix: Number(p.prix), stock: p.stock }));
}

export async function addProduct({ nom, prix, stock }) {
  const { error } = await supabase.from("products").insert({ nom, prix, stock });
  if (error) throw error;
}

export async function updateProductStock(id, stock) {
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Vendeurs
// -----------------------------------------------------------------------------

export async function getVendors() {
  const { data, error } = await supabase.from("vendors").select("*").order("nom");
  if (error) throw error;
  return (data || []).map((v) => ({ id: v.id, nom: v.nom }));
}

export async function addVendor(nom) {
  const { data, error } = await supabase.from("vendors").insert({ nom }).select().single();
  if (error) throw error;
  return { id: data.id, nom: data.nom };
}

export async function deleteVendor(id) {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
}

export async function getVendorAccounts() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "vendor");
  if (error) throw error;
  return (data || []).map((u) => ({ id: u.id, username: u.username, vendorId: u.vendor_id }));
}

export async function getManagerAccounts() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "manager");
  if (error) throw error;
  return (data || []).map((u) => ({ id: u.id, username: u.username }));
}

// -----------------------------------------------------------------------------
// Journées (distribution / retour du soir / versements / dépenses)
// -----------------------------------------------------------------------------

export function emptyDayData() {
  return { lines: [], versements: {}, expenses: [] };
}

export async function getDay(date) {
  const { data, error } = await supabase.from("days").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  if (!data) return { date, ...emptyDayData() };
  return { date, ...data.data };
}

export async function setDay(dayObj) {
  const { date, ...rest } = dayObj;
  const { error } = await supabase.from("days").upsert({ date, data: rest, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getDaysList() {
  const { data, error } = await supabase.from("days").select("date").order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map((d) => d.date);
}

export async function getDaysInRange(dates) {
  if (!dates.length) return [];
  const { data, error } = await supabase.from("days").select("*").in("date", dates);
  if (error) throw error;
  return (data || []).map((d) => ({ date: d.date, ...d.data }));
}

// -----------------------------------------------------------------------------
// Retraits
// -----------------------------------------------------------------------------

export async function getWithdrawals() {
  const { data, error } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((w) => ({
    id: w.id, vendorId: w.vendor_id, vendorNom: w.vendor_nom, montant: Number(w.montant),
    methode: w.methode, numeroMobile: w.numero_mobile, date: w.date, statut: w.statut,
    approvedBy: w.approved_by, approvedAt: w.approved_at, refusalReason: w.refusal_reason,
  }));
}

export async function createWithdrawal({ vendorId, vendorNom, montant, methode, numeroMobile, date }) {
  const { error } = await supabase.from("withdrawals").insert({
    vendor_id: vendorId, vendor_nom: vendorNom, montant, methode, numero_mobile: numeroMobile || null, date, statut: "en_attente",
  });
  if (error) throw error;
}

export async function updateWithdrawalStatus(id, statut, { approvedBy, refusalReason } = {}) {
  const patch = { statut };
  if (statut === "approuve") { patch.approved_by = approvedBy || null; patch.approved_at = new Date().toISOString(); }
  if (statut === "refuse") { patch.refusal_reason = refusalReason || null; patch.approved_by = approvedBy || null; patch.approved_at = new Date().toISOString(); }
  const { error } = await supabase.from("withdrawals").update(patch).eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export async function getNotifications() {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((n) => ({ id: n.id, vendorId: n.vendor_id, message: n.message, read: n.read, createdAt: n.created_at }));
}

export async function createNotification({ vendorId, message }) {
  const { error } = await supabase.from("notifications").insert({ vendor_id: vendorId, message, read: false });
  if (error) throw error;
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
