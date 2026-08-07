import { supabase } from "../supabase.js";

function mapSalaryCycle(c) {
  return {
    id: c.id, vendorId: c.vendor_id, cycleStart: c.cycle_start, cycleEnd: c.cycle_end,
    joursComptes: c.jours_comptes, montant: c.montant !== null && c.montant !== undefined ? Number(c.montant) : null,
    paidBy: c.paid_by, paidAt: c.paid_at,
  };
}

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

export async function markSalaryCyclePaid({ vendorId, cycleStart, cycleEnd, joursComptes, montant, paidBy }) {
  const { error } = await supabase.from("salary_cycles").insert({
    vendor_id: vendorId, cycle_start: cycleStart, cycle_end: cycleEnd,
    jours_comptes: joursComptes, montant: montant ?? null, paid_by: paidBy || null,
  });
  if (error) throw error;
}
