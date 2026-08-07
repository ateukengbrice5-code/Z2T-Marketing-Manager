import { supabase } from "../supabase.js";

export async function getSalesObjectives() {
  const { data, error } = await supabase.from("sales_objectives").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) return { minimal: 0, maximal: 0, extraordinaire: 0 };
  return { minimal: Number(data.objectif_minimal) || 0, maximal: Number(data.objectif_maximal) || 0, extraordinaire: Number(data.objectif_extraordinaire) || 0 };
}

export async function setSalesObjectives({ minimal, maximal, extraordinaire }, updatedBy) {
  const { error } = await supabase.from("sales_objectives").update({
    objectif_minimal: minimal, objectif_maximal: maximal, objectif_extraordinaire: extraordinaire,
    updated_by: updatedBy || null, updated_at: new Date().toISOString(),
  }).eq("id", 1);
  if (error) throw error;
}

export async function getAchievementsForVendorDate(vendorId, date) {
  const { data, error } = await supabase.from("objective_achievements").select("*").eq("vendor_id", vendorId).eq("date", date);
  if (error) throw error;
  return (data || []).map((a) => a.palier);
}

export async function getAchievementsForVendor(vendorId) {
  const { data, error } = await supabase
    .from("objective_achievements")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map((a) => ({ id: a.id, date: a.date, palier: a.palier, montant: Number(a.montant) || 0 }));
}

export async function recordAchievement({ vendorId, vendorNom, date, palier, montant }) {
  const { error } = await supabase.from("objective_achievements").insert({
    vendor_id: vendorId, vendor_nom: vendorNom, date, palier, montant,
  });
  if (error && error.code !== "23505") throw error;
  return !error;
}

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
