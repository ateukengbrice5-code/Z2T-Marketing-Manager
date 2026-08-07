import { supabase } from "../supabase.js";

// minimal extract from src/lib/store.js — auth & user management
export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@z2t.local`;
}

export async function readFunctionError(error) {
  if (!error) return null;
  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_) {}
  return error.message || "Erreur lors de l'appel à la fonction.";
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(username, password) {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Identifiant ou mot de passe incorrect.");
  // caller can call getMyProfile() (kept in store facade)
  return getSession();
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function createFirstAdmin(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("Création du compte impossible.");
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId, username: username.trim(), role: "admin", vendor_id: null, is_primary: true,
  });
  if (profileError) throw new Error(profileError.message);
  return true;
}

// Helper to call manage-user edge function with token
export async function callManageUser(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("manage-user", {
    body, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createAccount({ username, password, role, vendorId }) {
  await callManageUser({ action: "create", username, password, role, vendorId: vendorId || null });
  return true;
}

export async function deleteAccount(userId) {
  await callManageUser({ action: "delete", userId });
  return true;
}

export async function convertVendorToMessenger(userId) {
  await callManageUser({ action: "convert", userId, newRole: "messenger" });
  return true;
}

export async function createInviteLink(opts) {
  const data = await callManageUser({ action: "create_invite", role: opts.role || "vendor", vendorId: opts.vendorId, expiresInDays: opts.expiresInDays || 7 });
  return { id: data.id, token: data.token, role: data.role, vendorId: data.vendorId, expiresAt: data.expiresAt };
}

export async function claimInvite({ token, username, password }) {
  const { data, error } = await supabase.functions.invoke("claim-invite", { body: { token, username, password } });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return true;
}
