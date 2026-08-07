import { supabase } from "../supabase.js";

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

export async function setVendorContractStatut(vendorId, statut) {
  const { error } = await supabase.from("vendors").update({ contract_statut: statut }).eq("id", vendorId);
  if (error) throw error;
}

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

export async function getVendorPresence() {
  const { data, error } = await supabase.from("profiles").select("vendor_id, is_online, last_seen_at").eq("role", "vendor").not("vendor_id", "is", null);
  if (error) throw error;
  const map = {};
  (data || []).forEach((p) => { map[p.vendor_id] = { isOnline: !!p.is_online, lastSeenAt: p.last_seen_at }; });
  return map;
}

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
