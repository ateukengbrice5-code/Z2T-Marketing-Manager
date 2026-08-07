import { supabase } from "../supabase.js";

// product-related methods extracted
export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*").order("nom");
  if (error) throw error;
  return (data || []).map((p) => ({ id: p.id, nom: p.nom, prix: Number(p.prix), stock: p.stock, categorie: p.categorie || "Général" }));
}

export async function addProduct({ nom, prix, stock, categorie }) {
  const { error } = await supabase.from("products").insert({ nom, prix, stock, categorie: (categorie || "").trim() || "Général" });
  if (error) throw error;
}

export async function updateProductStock(id, stock) {
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) throw error;
}

export async function updateProductCategorie(id, categorie) {
  const { error } = await supabase.from("products").update({ categorie: (categorie || "").trim() || "Général" }).eq("id", id);
  if (error) throw error;
}

export async function updateProductPrix(id, prix) {
  const { error } = await supabase.from("products").update({ prix }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}
