// Fonction Supabase Edge : vue d'ensemble et zoom par entreprise, réservée
// au super-admin. Utilise la clé de service pour lire à travers toutes les
// entreprises — c'est le SEUL endroit de l'appli qui a cette capacité.
// Déploiement : supabase functions deploy entreprise-overview
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié." }), { status: 401, headers: cors });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData } = await callerClient.auth.getUser();
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié." }), { status: 401, headers: cors });
    }

    const { data: callerProfile } = await callerClient.from("profiles").select("is_super_admin").eq("id", authData.user.id).single();
    if (!callerProfile?.is_super_admin) {
      return new Response(JSON.stringify({ error: "Réservé au super-administrateur." }), { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "summary";
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "summary") {
      const { data: entreprises, error: entErr } = await adminClient.from("entreprises").select("*").order("nom");
      if (entErr) return new Response(JSON.stringify({ error: entErr.message }), { status: 400, headers: cors });

      const [vendorsRes, productsRes, adminsRes] = await Promise.all([
        adminClient.from("vendors").select("id, entreprise_id"),
        adminClient.from("products").select("id, stock, entreprise_id"),
        adminClient.from("profiles").select("id, entreprise_id, is_primary, role").eq("role", "admin"),
      ]);

      const summaries = (entreprises || []).map((e) => {
        const vendors = (vendorsRes.data || []).filter((v) => v.entreprise_id === e.id);
        const products = (productsRes.data || []).filter((p) => p.entreprise_id === e.id);
        const admin = (adminsRes.data || []).find((a) => a.entreprise_id === e.id && a.is_primary);
        return {
          id: e.id, nom: e.nom, statut: e.statut, dateFin: e.date_fin,
          nbVendeurs: vendors.length,
          nbProduits: products.length,
          stockTotal: products.reduce((s, p) => s + (Number(p.stock) || 0), 0),
          adminPrincipalId: admin?.id || null,
        };
      });

      return new Response(JSON.stringify({ entreprises: summaries }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "zoom") {
      const { entrepriseId } = body;
      if (!entrepriseId) return new Response(JSON.stringify({ error: "Identifiant manquant." }), { status: 400, headers: cors });

      const [entRes, vendorsRes, productsRes, adminsRes, daysRes] = await Promise.all([
        adminClient.from("entreprises").select("*").eq("id", entrepriseId).single(),
        adminClient.from("vendors").select("id, nom, prenom, contract_statut").eq("entreprise_id", entrepriseId).order("nom"),
        adminClient.from("products").select("id, nom, stock, prix").eq("entreprise_id", entrepriseId).order("nom"),
        adminClient.from("profiles").select("username, role, is_primary, is_online, last_seen_at").eq("entreprise_id", entrepriseId).in("role", ["admin", "manager"]),
        adminClient.from("days").select("date, data").eq("entreprise_id", entrepriseId).order("date", { ascending: false }).limit(30),
      ]);
      if (entRes.error) return new Response(JSON.stringify({ error: "Entreprise introuvable." }), { status: 404, headers: cors });

      const caTrenteJours = (daysRes.data || []).reduce((sum, d) => {
        const lignes = d.data?.lines || [];
        return sum + lignes.reduce((s, l) => s + (l.montantAttendu || 0), 0);
      }, 0);

      return new Response(JSON.stringify({
        entreprise: entRes.data,
        vendors: vendorsRes.data || [],
        products: productsRes.data || [],
        admins: adminsRes.data || [],
        caTrenteJours,
        nbJoursActifs: (daysRes.data || []).length,
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Action inconnue." }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
