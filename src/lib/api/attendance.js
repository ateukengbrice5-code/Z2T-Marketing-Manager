import { supabase } from "../supabase.js";

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

export async function setVendorAttendance({ vendorId, date, statut, notes, heure, validatedBy }) {
  const { error } = await supabase.from("vendor_attendance").upsert(
    { vendor_id: vendorId, date, statut, notes: notes || null, heure_arrivee: heure || null, validated_by: validatedBy || null },
    { onConflict: "vendor_id,date" }
  );
  if (error) throw error;
}

export async function setVendorAttendanceBulk(date, entries, validatedBy) {
  const rows = entries.map((e) => ({
    vendor_id: e.vendorId, date, statut: e.statut, notes: e.notes || null,
    heure_arrivee: e.heure || null, validated_by: validatedBy || null,
  }));
  const { error } = await supabase.from("vendor_attendance").upsert(rows, { onConflict: "vendor_id,date" });
  if (error) throw error;
}

export async function createAttendanceContestation({ vendorId, date, message }) {
  const { error } = await supabase.from("attendance_contestations").insert({ vendor_id: vendorId, date, message });
  if (error) throw error;
}

function mapContestation(c) {
  return {
    id: c.id, vendorId: c.vendor_id, date: c.date, message: c.message, createdAt: c.created_at,
    resolved: c.resolved, adminResponse: c.admin_response, resolvedBy: c.resolved_by, resolvedAt: c.resolved_at,
  };
}

export async function getContestationsForVendor(vendorId) {
  const { data, error } = await supabase
    .from("attendance_contestations").select("*").eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContestation);
}

export async function getAllContestations() {
  const { data, error } = await supabase
    .from("attendance_contestations").select("*")
    .order("resolved", { ascending: true }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContestation);
}

export async function resolveContestation(id, { adminResponse, resolvedBy }) {
  const { error } = await supabase.from("attendance_contestations").update({
    resolved: true, admin_response: adminResponse || null, resolved_by: resolvedBy || null, resolved_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}
