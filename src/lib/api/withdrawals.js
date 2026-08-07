import { supabase } from "../supabase.js";

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
