import { supabase } from "../supabase.js";

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

export async function createEntrepriseAdmin(entrepriseId, username, password) {
  const { data } = await supabase.functions.invoke("manage-user", { body: { action: "create_entreprise_admin", entrepriseId, username, password } });
  if (data?.error) throw new Error(data.error);
  return data;
}

async function callEntrepriseOverview(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("entreprise-overview", {
    body, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw new Error(error.message || "Erreur lors de l'appel entreprise-overview");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getEntreprisesSummary() {
  const { entreprises } = await callEntrepriseOverview({ action: "summary" });
  return entreprises || [];
}

export async function getEntrepriseDetail(entrepriseId) {
  return callEntrepriseOverview({ action: "zoom", entrepriseId });
}

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
