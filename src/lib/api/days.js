import { supabase } from "../supabase.js";

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
