import { supabase } from "./supabase.js";

// -----------------------------------------------------------------------------
// Authentification
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
  return { id: data.id, username: data.username, role: data.role, vendorId: data.vendor_id };
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
  if (!userId) throw new Error("Création du compte impossible (vérifie que la confirmation par e-mail est désactivée dans Supabase).");
  const { error: profileError } = await supabase.from("profiles").insert({ id: userId, username: username.trim(), role: "admin", vendor_id: null });
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

// Création d'un compte vendeur ou gestionnaire par un admin/manager déjà connecté.
// Passe par une fonction Supabase Edge (voir supabase/functions/manage-user) pour
// ne pas déconnecter la session de l'administrateur en cours.
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
  }));
}

export async function createWithdrawal({ vendorId, vendorNom, montant, methode, numeroMobile, date }) {
  const { error } = await supabase.from("withdrawals").insert({
    vendor_id: vendorId, vendor_nom: vendorNom, montant, methode, numero_mobile: numeroMobile || null, date, statut: "en_attente",
  });
  if (error) throw error;
}

export async function updateWithdrawalStatus(id, statut) {
  const { error } = await supabase.from("withdrawals").update({ statut }).eq("id", id);
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
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}
