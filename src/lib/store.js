import { supabase } from "./supabase.js";

// -----------------------------------------------------------------------------
// Authentification — tout le monde se connecte avec un simple nom
// d'utilisateur (aucun vrai e-mail requis, pour rester simple). En coulisses,
// on fabrique une adresse technique invisible pour Supabase.
// -----------------------------------------------------------------------------

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@z2t.local`;
}

// supabase.functions.invoke() ne remplit PAS `data` quand la fonction répond
// avec un code non-2xx : le corps JSON (avec notre message d'erreur en
// français) reste dans error.context (un objet Response) et n'est jamais lu
// par défaut, ce qui affichait juste "Edge Function returned a non-2xx
// status code" à l'utilisateur. Ce helper va chercher le vrai message.
async function readFunctionError(error) {
  if (!error) return null;
  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_) {
    // le corps n'était pas du JSON exploitable, on retombe sur error.message
  }
  return error.message || "Erreur lors de l'appel à la fonction.";
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getMyProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await supabase.from("profiles").select("*, entreprises!profiles_entreprise_id_fkey(nom, statut, date_fin, features)").eq("id", auth.user.id).single();
  if (error) return null;
  const entreprise = data.entreprises;
  let blocked = false;
  let blockedReason = null;
  // Le super-admin garde toujours accès, quel que soit le statut de son
  // entreprise — il doit pouvoir gérer les abonnements même si le sien
  // (Boutique principale) était un jour désactivé par erreur.
  if (!data.is_super_admin && entreprise) {
    if (entreprise.statut !== "actif") {
      blocked = true;
      blockedReason = `L'accès de "${entreprise.nom}" est désactivé. Contacte l'administrateur de la plateforme pour le réactiver.`;
    } else if (entreprise.date_fin && entreprise.date_fin < todayISOForCheck()) {
      blocked = true;
      blockedReason = `L'abonnement de "${entreprise.nom}" a expiré le ${entreprise.date_fin}. Contacte l'administrateur de la plateforme pour le renouveler.`;
    }
  }
  return {
    id: data.id, username: data.username, role: data.role,
    vendorId: data.vendor_id, isPrimary: data.is_primary,
    isSuperAdmin: !!data.is_super_admin,
    entrepriseId: data.entreprise_id,
    features: entreprise?.features || { news_feed: true, sales_history: true, auto_carry_forward_stock: false },
    blocked, blockedReason,
  };
}

function todayISOForCheck() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
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
  // Utilise la fonction RPC has_any_account (SECURITY DEFINER) plutôt qu'un
  // SELECT direct sur profiles : la policy RLS de lecture exige auth.uid()
  // IS NOT NULL, donc un visiteur non connecté obtenait toujours 0 ligne,
  // et l'app le renvoyait à tort vers l'écran de création de compte.
  const { data, error } = await supabase.rpc("has_any_account");
  if (error) return true; // en cas de doute, ne pas proposer de recréer un admin
  return !!data;
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
  if (error) throw new Error(await readFunctionError(error));
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
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return true;
}

// Convertit un compte vendeur existant en compte "messagerie uniquement" —
// garde le même identifiant/mot de passe, perd l'accès à tout sauf la
// Messagerie. Le vendeur (produits, historique) n'est pas supprimé, juste
// détaché de ce compte de connexion.
export async function convertVendorToMessenger(userId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-user", {
    body: { action: "convert", userId, newRole: "messenger" },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(await readFunctionError(error));
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

// Enregistre l'action de tout utilisateur connecté (admin principal compris —
// avant, l'admin principal était ignoré ici, ce qui faisait disparaître son
// nom du Journal d'activité, par exemple lors de la validation d'un versement).
// Passe par une fonction Edge pour capturer l'adresse IP et l'appareil côté
// serveur (impossible depuis le navigateur).
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
  return (data || []).map((p) => ({ id: p.id, nom: p.nom, prix: Number(p.prix), stock: p.stock, categorie: p.categorie || "Général" }));
}

export async function addProduct({ nom, prix, stock, categorie }) {
  const { error } = await supabase.from("products").insert({ nom, prix, stock, categorie: (categorie || "").trim() || "Général" });
  if (error) throw error;
}

// @deprecated — écrit une valeur ABSOLUE calculée côté client. En cas
// d'utilisation simultanée depuis deux appareils, le dernier appel écrase
// silencieusement le mouvement de stock de l'autre (perte de stock).
// Utiliser adjustProductStock ci-dessous, qui applique une variation de
// façon atomique directement en base.
export async function updateProductStock(id, stock) {
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) throw error;
}

// Applique une variation de stock (positive ou négative) de façon atomique
// via la fonction Postgres adjust_product_stock (voir migration SQL) :
// "stock = stock + delta" est calculé en une seule opération en base, donc
// deux appareils qui distribuent/retournent du stock en même temps
// s'additionnent correctement au lieu de s'écraser l'un l'autre. Renvoie
// le nouveau stock réel (tel que calculé par la base, pas côté client).
export async function adjustProductStock(id, delta) {
  if (!delta) return null;
  const { data, error } = await supabase.rpc("adjust_product_stock", { p_id: id, p_delta: delta });
  if (error) throw error;
  return data;
}

export async function updateProductCategorie(id, categorie) {
  const { error } = await supabase.from("products").update({ categorie: (categorie || "").trim() || "Général" }).eq("id", id);
  if (error) throw error;
}

export async function updateProductPrix(id, prix) {
  const { error } = await supabase.from("products").update({ prix }).eq("id", id);
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
  return (data || []).map((v) => ({
    id: v.id, nom: v.nom, prenom: v.prenom,
    numeroCni: v.numero_cni, pieceNature: v.piece_nature, contractStatut: v.contract_statut || "actif", dateNaissance: v.date_naissance,
    telephone: v.telephone, photoUrl: v.photo_url,
    dateEnregistrement: v.date_enregistrement,
  }));
}

export async function addVendor({ nom, prenom, numeroCni, pieceNature, dateNaissance, telephone }) {
  const { data, error } = await supabase.from("vendors").insert({
    nom, prenom: prenom || null,
    numero_cni: numeroCni || null,
    piece_nature: pieceNature || null,
    date_naissance: dateNaissance || null,
    telephone: telephone || null,
  }).select().single();
  if (error) throw error;
  return {
    id: data.id, nom: data.nom, prenom: data.prenom,
    numeroCni: data.numero_cni, pieceNature: data.piece_nature, contractStatut: data.contract_statut || "actif", dateNaissance: data.date_naissance,
    telephone: data.telephone, photoUrl: data.photo_url,
    dateEnregistrement: data.date_enregistrement,
  };
}

export async function deleteVendor(id) {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
}

// statut : "actif" | "en_pause" | "cloture"
export async function setVendorContractStatut(vendorId, statut) {
  const { error } = await supabase.from("vendors").update({ contract_statut: statut }).eq("id", vendorId);
  if (error) throw error;
}

// Corrige la date d'enregistrement d'un vendeur — utile lors de la mise en
// place de l'application pour des vendeurs qui travaillaient déjà avant
// (sinon leur premier cycle de salaire serait compté à partir d'aujourd'hui
// au lieu de leur vraie date de début).
export async function setVendorRegistrationDate(vendorId, dateEnregistrement) {
  const { error } = await supabase.from("vendors").update({ date_enregistrement: dateEnregistrement }).eq("id", vendorId);
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

export async function getMessengerAccounts() {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "messenger");
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

// -----------------------------------------------------------------------------
// Photo de profil vendeur
// -----------------------------------------------------------------------------

export async function uploadVendorPhoto(vendorId, file) {
  const ext = (file.name && file.name.includes(".")) ? file.name.split(".").pop() : "jpg";
  const path = `${vendorId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("vendor_photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from("vendor_photos").getPublicUrl(path);
  const { error: updateError } = await supabase.from("vendors").update({ photo_url: pub.publicUrl }).eq("id", vendorId);
  if (updateError) throw updateError;
  return pub.publicUrl;
}

// -----------------------------------------------------------------------------
// Présences / absences (fiche vendeur)
// -----------------------------------------------------------------------------

export async function getAttendanceForDate(date) {
  const { data, error } = await supabase.from("vendor_attendance").select("*").eq("date", date);
  if (error) throw error;
  return (data || []).map((a) => ({ id: a.id, vendorId: a.vendor_id, date: a.date, statut: a.statut, notes: a.notes, heure: a.heure_arrivee }));
}

export async function getVendorAttendanceHistory(vendorId, limit = 60) {
  const { data, error } = await supabase
    .from("vendor_attendance").select("*").eq("vendor_id", vendorId)
    .order("date", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map((a) => ({
    id: a.id, date: a.date, statut: a.statut, notes: a.notes,
    heureArrivee: a.heure_arrivee, heureDepart: a.heure_depart,
  }));
}

// statut : "present" | "absent_autorise" | "absent_non_autorise"
export async function setVendorAttendance({ vendorId, date, statut, notes, heure, validatedBy }) {
  const { error } = await supabase.from("vendor_attendance").upsert(
    { vendor_id: vendorId, date, statut, notes: notes || null, heure_arrivee: heure || null, validated_by: validatedBy || null },
    { onConflict: "vendor_id,date" }
  );
  if (error) throw error;
}

// Enregistre le pointage de toute l'équipe pour une date donnée en un seul
// aller-retour (écran "Pointage du jour").
export async function setVendorAttendanceBulk(date, entries, validatedBy) {
  // entries: [{ vendorId, statut, notes, heure }]
  const rows = entries.map((e) => ({
    vendor_id: e.vendorId, date, statut: e.statut, notes: e.notes || null,
    heure_arrivee: e.heure || null, validated_by: validatedBy || null,
  }));
  const { error } = await supabase.from("vendor_attendance").upsert(rows, { onConflict: "vendor_id,date" });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Cycles de salaire — 26 jours de présence payable déclenchent un versement.
// Un cycle démarre au lendemain de la fin du cycle précédent (ou à la date
// d'enregistrement du vendeur s'il n'y a jamais eu de versement).
// -----------------------------------------------------------------------------

export async function getLatestSalaryCycle(vendorId) {
  const { data, error } = await supabase
    .from("salary_cycles").select("*").eq("vendor_id", vendorId)
    .order("cycle_end", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSalaryCycle(data);
}

export async function getSalaryCycleHistory(vendorId) {
  const { data, error } = await supabase
    .from("salary_cycles").select("*").eq("vendor_id", vendorId)
    .order("cycle_end", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSalaryCycle);
}

function mapSalaryCycle(c) {
  return {
    id: c.id, vendorId: c.vendor_id, cycleStart: c.cycle_start, cycleEnd: c.cycle_end,
    joursComptes: c.jours_comptes, montant: c.montant !== null && c.montant !== undefined ? Number(c.montant) : null,
    paidBy: c.paid_by, paidAt: c.paid_at,
  };
}

// Clôture le cycle en cours (enregistre le versement) — le prochain cycle
// démarrera automatiquement le lendemain de cycleEnd.
export async function markSalaryCyclePaid({ vendorId, cycleStart, cycleEnd, joursComptes, montant, paidBy }) {
  const { error } = await supabase.from("salary_cycles").insert({
    vendor_id: vendorId, cycle_start: cycleStart, cycle_end: cycleEnd,
    jours_comptes: joursComptes, montant: montant ?? null, paid_by: paidBy || null,
  });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Contestations de présence — un vendeur peut signaler un jour de sa fiche
// de présence qui lui semble mal renseigné ; l'administration répond et
// marque la contestation comme résolue.
// -----------------------------------------------------------------------------

export async function createAttendanceContestation({ vendorId, date, message }) {
  const { error } = await supabase.from("attendance_contestations").insert({ vendor_id: vendorId, date, message });
  if (error) throw error;
}

export async function getContestationsForVendor(vendorId) {
  const { data, error } = await supabase
    .from("attendance_contestations").select("*").eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContestation);
}

// Toutes les contestations, non résolues en premier — réservé à l'admin/manager.
export async function getAllContestations() {
  const { data, error } = await supabase
    .from("attendance_contestations").select("*")
    .order("resolved", { ascending: true }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContestation);
}

function mapContestation(c) {
  return {
    id: c.id, vendorId: c.vendor_id, date: c.date, message: c.message, createdAt: c.created_at,
    resolved: c.resolved, adminResponse: c.admin_response, resolvedBy: c.resolved_by, resolvedAt: c.resolved_at,
  };
}

export async function resolveContestation(id, { adminResponse, resolvedBy }) {
  const { error } = await supabase.from("attendance_contestations").update({
    resolved: true, admin_response: adminResponse || null, resolved_by: resolvedBy || null, resolved_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Anniversaires
// -----------------------------------------------------------------------------

export async function getTodaysBirthdays() {
  const { data, error } = await supabase.from("vendors_with_birthday_today").select("*");
  if (error) throw error;
  return (data || []).map((v) => ({ id: v.id, nom: v.nom, prenom: v.prenom, photoUrl: v.photo_url, age: v.age }));
}

// -----------------------------------------------------------------------------
// Liens d'invitation — un vendeur crée lui-même son compte à partir d'un lien
// généré par un admin/gestionnaire, sans que celui-ci ait à saisir un mot de
// passe à sa place.
// -----------------------------------------------------------------------------

async function callManageUser(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-user", {
    body, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

function inviteUrlFromToken(token) {
  return `${window.location.origin}${window.location.pathname}?invite=${token}`;
}

// Crée (ou réutilise, pour un vendeur) un lien d'invitation. Passe désormais
// par la fonction Edge manage-user, qui applique les mêmes règles de rôle que
// la création directe de compte (ex. seul l'admin principal peut inviter un
// autre admin) — plutôt que de dépendre des règles RLS de la table.
export async function createInviteLink({ vendorId, role = "vendor", expiresInDays = 7 }) {
  const data = await callManageUser({ action: "create_invite", role, vendorId: role === "vendor" ? vendorId : undefined, expiresInDays });
  return { id: data.id, token: data.token, role: data.role, vendorId: data.vendorId, expiresAt: data.expiresAt, url: inviteUrlFromToken(data.token) };
}

export async function getInviteLinkForVendor(vendorId) {
  const { invites } = await callManageUser({ action: "list_invites" });
  const found = (invites || []).find((inv) => inv.role === "vendor" && inv.vendor_id === vendorId);
  if (!found) return null;
  if (found.expires_at && new Date(found.expires_at) < new Date()) return null;
  return { id: found.id, token: found.token, role: found.role, vendorId: found.vendor_id, expiresAt: found.expires_at, url: inviteUrlFromToken(found.token) };
}

// Liste les invitations en attente (non utilisées, non expirées côté
// affichage) pour un rôle donné qui n'a pas d'entité préexistante à cibler
// (messagerie, gestionnaire, admin) — contrairement au vendeur qui existe
// déjà avant l'invitation.
export async function listPendingInvites(role) {
  const { invites } = await callManageUser({ action: "list_invites" });
  const now = new Date();
  return (invites || [])
    .filter((inv) => inv.role === role && (!inv.expires_at || new Date(inv.expires_at) >= now))
    .map((inv) => ({ id: inv.id, token: inv.token, role: inv.role, createdAt: inv.created_at, expiresAt: inv.expires_at, url: inviteUrlFromToken(inv.token) }));
}

export async function revokeInviteLink(id) {
  await callManageUser({ action: "revoke_invite", inviteId: id });
}

// Appelée depuis l'écran public de création de compte (pas de session requise) :
// passe par la fonction Edge claim-invite (verify_jwt désactivé exprès).
export async function claimInvite({ token, username, password }) {
  const { data, error } = await supabase.functions.invoke("claim-invite", {
    body: { token, username, password },
  });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return true;
}

// -----------------------------------------------------------------------------
// Objectifs de vente quotidiens (mêmes seuils pour tous les vendeurs) et
// paliers atteints (déclenche l'animation côté vendeur + la notification
// côté admin).
// -----------------------------------------------------------------------------

export async function getSalesObjectives() {
  const { data, error } = await supabase.from("sales_objectives").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return { minimal: 0, maximal: 0, extraordinaire: 0 };
  return { minimal: Number(data.objectif_minimal) || 0, maximal: Number(data.objectif_maximal) || 0, extraordinaire: Number(data.objectif_extraordinaire) || 0 };
}

export async function setSalesObjectives({ minimal, maximal, extraordinaire }, updatedBy) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error("Non authentifié.");
  const { data: profile, error: profileErr } = await supabase.from("profiles").select("entreprise_id").eq("id", auth.user.id).single();
  if (profileErr) throw profileErr;
  const { error } = await supabase.from("sales_objectives").upsert({
    entreprise_id: profile.entreprise_id,
    objectif_minimal: minimal, objectif_maximal: maximal, objectif_extraordinaire: extraordinaire,
    updated_by: updatedBy || null, updated_at: new Date().toISOString(),
  }, { onConflict: "entreprise_id" });
  if (error) throw error;
}

// Paliers déjà atteints par un vendeur, pour une date donnée
export async function getAchievementsForVendorDate(vendorId, date) {
  const { data, error } = await supabase.from("objective_achievements").select("*").eq("vendor_id", vendorId).eq("date", date);
  if (error) throw error;
  return (data || []).map((a) => a.palier);
}

// Historique complet des paliers atteints par un vendeur, toutes dates
// confondues — utilisé pour l'affichage "mes trophées" sur son tableau de
// bord (contrairement à getAchievementsForVendorDate, limité à un seul jour).
export async function getAchievementsForVendor(vendorId) {
  const { data, error } = await supabase
    .from("objective_achievements")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map((a) => ({ id: a.id, date: a.date, palier: a.palier, montant: Number(a.montant) || 0 }));
}

// Enregistre un palier atteint (idempotent : la contrainte unique côté base
// empêche les doublons si l'événement se déclenche deux fois).
export async function recordAchievement({ vendorId, vendorNom, date, palier, montant }) {
  const { error } = await supabase.from("objective_achievements").insert({
    vendor_id: vendorId, vendor_nom: vendorNom, date, palier, montant,
  });
  if (error && error.code !== "23505") throw error; // 23505 = doublon déjà enregistré, on ignore
  return !error;
}

// Notifications admin (paliers non encore vus par l'administration)
export async function getUnseenAchievements() {
  const { data, error } = await supabase.from("objective_achievements").select("*").eq("seen_by_admin", false).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((a) => ({
    id: a.id, vendorId: a.vendor_id, vendorNom: a.vendor_nom, date: a.date,
    palier: a.palier, montant: Number(a.montant) || 0, createdAt: a.created_at,
  }));
}

export async function markAchievementSeen(id) {
  const { error } = await supabase.from("objective_achievements").update({ seen_by_admin: true }).eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Inventaires physiques (comptage hebdomadaire, en principe chaque samedi) —
// une ligne par date, sur le même modèle que days/getDay/setDay : on compare
// le stock système au moment du comptage à la quantité réellement comptée,
// sans jamais toucher au stock système (l'écart est juste enregistré pour
// vérification, l'ajustement éventuel du stock reste une action manuelle
// séparée dans l'onglet Stock).
// -----------------------------------------------------------------------------

export async function getInventaires() {
  const { data, error } = await supabase.from("inventaires").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    date: r.date, lignes: r.data?.lignes || [], createdBy: r.data?.createdBy || null, updatedAt: r.updated_at,
  }));
}

export async function getInventaireForDate(date) {
  const { data, error } = await supabase.from("inventaires").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { date, lignes: data.data?.lignes || [], createdBy: data.data?.createdBy || null, updatedAt: data.updated_at };
}

// lignes : [{ productId, productNom, stockSysteme, stockPhysique, ecart }]
export async function saveInventaire({ date, lignes, createdBy }) {
  const { error } = await supabase.from("inventaires").upsert({
    date, data: { lignes, createdBy: createdBy || null }, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Fil d'actualité — passe par la fonction Edge news-feed, qui agrège paliers
// de vente, anniversaires du jour et annonces, et applique les droits (qui
// peut publier/supprimer une annonce).
// -----------------------------------------------------------------------------

async function callNewsFeed(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("news-feed", {
    body, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getNewsFeed() {
  const { items } = await callNewsFeed({ action: "list" });
  return items || [];
}

export async function postAnnouncement(content) {
  return callNewsFeed({ action: "post_announcement", content });
}

export async function deleteAnnouncement(id) {
  await callNewsFeed({ action: "delete_announcement", id });
}

export async function reactToNewsItem(itemType, itemKey, emoji) {
  const { myReaction } = await callNewsFeed({ action: "react", itemType, itemKey, emoji });
  return myReaction;
}

// -----------------------------------------------------------------------------
// Entreprises clientes de la plateforme — réservé au super-admin. La date de
// fin d'abonnement est calculée automatiquement à partir d'une durée en mois
// (renouvellement), jamais saisie à la main. date_fin = null signifie "sans
// expiration" (cas du compte historique créé avant la gestion multi-entreprises).
// -----------------------------------------------------------------------------

function mapEntreprise(e) {
  return {
    id: e.id, nom: e.nom,
    contactNom: e.contact_nom, contactTelephone: e.contact_telephone, contactEmail: e.contact_email,
    statut: e.statut, dureeMois: e.duree_mois, dateDebut: e.date_debut, dateFin: e.date_fin,
    montant: e.montant != null ? Number(e.montant) : null, notes: e.notes,
    createdAt: e.created_at, updatedAt: e.updated_at,
    features: e.features || { news_feed: true, sales_history: true, auto_carry_forward_stock: false },
  };
}

export async function setEntrepriseFeature(entrepriseId, key, enabled) {
  const { data: current, error: readErr } = await supabase.from("entreprises").select("features").eq("id", entrepriseId).single();
  if (readErr) throw readErr;
  const features = { ...(current.features || {}), [key]: enabled };
  const { error } = await supabase.from("entreprises").update({ features }).eq("id", entrepriseId);
  if (error) throw error;
  return features;
}

function addMoisISO(dateISO, mois) {
  const d = new Date(dateISO + "T00:00:00");
  d.setMonth(d.getMonth() + Number(mois));
  return d.toISOString().slice(0, 10);
}

export async function getEntreprises() {
  const { data, error } = await supabase.from("entreprises").select("*").order("nom");
  if (error) throw error;
  return (data || []).map(mapEntreprise);
}

// today : date du jour (ISO) fournie par l'appelant, pour rester cohérent
// avec le reste de l'appli plutôt que de recalculer la date ici.
export async function createEntreprise({ nom, contactNom, contactTelephone, contactEmail, dureeMois, montant, notes, createdBy, today }) {
  const dateDebut = today;
  const dateFin = dureeMois ? addMoisISO(dateDebut, dureeMois) : null;
  const { data, error } = await supabase.from("entreprises").insert({
    nom, contact_nom: contactNom || null, contact_telephone: contactTelephone || null, contact_email: contactEmail || null,
    statut: "actif", duree_mois: dureeMois || null, date_debut: dateDebut, date_fin: dateFin,
    montant: montant || null, notes: notes || null, created_by: createdBy || null,
  }).select().single();
  if (error) throw error;
  return mapEntreprise(data);
}

// Crée le tout premier compte admin d'une entreprise cliente — réservé au
// super-admin, passe par manage-user (même fonction Edge que la création des
// autres comptes) pour créer l'utilisateur Auth + son profil ensemble.
export async function createEntrepriseAdmin(entrepriseId, username, password) {
  return callManageUser({ action: "create_entreprise_admin", entrepriseId, username, password });
}

async function callEntrepriseOverview(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("entreprise-overview", {
    body, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

// Vue résumée de toutes les entreprises (nb vendeurs, produits, stock) —
// réservée au super-admin.
export async function getEntreprisesSummary() {
  const { entreprises } = await callEntrepriseOverview({ action: "summary" });
  return entreprises || [];
}

// Détail d'une entreprise précise ("zoom") — réservé au super-admin.
export async function getEntrepriseDetail(entrepriseId) {
  return callEntrepriseOverview({ action: "zoom", entrepriseId });
}

// Renouvelle l'abonnement pour une durée donnée : repart de la date de fin
// actuelle si elle n'est pas encore dépassée (renouvellement anticipé, on ne
// perd pas de jours déjà payés), sinon repart d'aujourd'hui. Réactive aussi
// l'accès si l'entreprise était désactivée.
export async function renewEntreprise(id, dureeMois, today) {
  const { data: current, error: getErr } = await supabase.from("entreprises").select("date_fin, statut").eq("id", id).single();
  if (getErr) throw getErr;
  const base = (current.date_fin && current.statut === "actif" && current.date_fin >= today) ? current.date_fin : today;
  const dateFin = addMoisISO(base, dureeMois);
  const { error } = await supabase.from("entreprises").update({
    duree_mois: dureeMois, date_fin: dateFin, statut: "actif", updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

// Active ou désactive manuellement l'accès (indépendamment de la date de fin).
export async function setEntrepriseStatut(id, statut) {
  const { error } = await supabase.from("entreprises").update({ statut, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function updateEntreprise(id, fields) {
  const patch = { updated_at: new Date().toISOString() };
  if (fields.nom !== undefined) patch.nom = fields.nom;
  if (fields.contactNom !== undefined) patch.contact_nom = fields.contactNom || null;
  if (fields.contactTelephone !== undefined) patch.contact_telephone = fields.contactTelephone || null;
  if (fields.contactEmail !== undefined) patch.contact_email = fields.contactEmail || null;
  if (fields.montant !== undefined) patch.montant = fields.montant || null;
  if (fields.notes !== undefined) patch.notes = fields.notes || null;
  const { error } = await supabase.from("entreprises").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteEntreprise(id) {
  const { error } = await supabase.from("entreprises").delete().eq("id", id);
  if (error) throw error;
}
