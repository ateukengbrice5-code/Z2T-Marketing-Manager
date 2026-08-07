import { supabase } from "../supabase.js";

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

export async function saveInventaire({ date, lignes, createdBy }) {
  const { error } = await supabase.from("inventaires").upsert({
    date, data: { lignes, createdBy: createdBy || null }, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
