// Fonction Supabase Edge : enregistre une action dans le journal d'activité
// en capturant l'adresse IP et l'appareil côté serveur (impossible à obtenir
// de façon fiable depuis le navigateur).
// Déploiement : supabase functions deploy log-activity
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData } = await callerClient.auth.getUser();
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié." }), { status: 401, headers: cors });
    }

    const { data: profile } = await callerClient.from("profiles").select("username, role, is_primary").eq("id", authData.user.id).single();

    // Ne journalise que les administrateurs secondaires (règle du produit)
    if (!profile || profile.role !== "admin" || profile.is_primary) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: cors });
    }

    const { eventType, description, metadata } = await req.json();
    if (!eventType || !description) {
      return new Response(JSON.stringify({ error: "Champs manquants." }), { status: 400, headers: cors });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error } = await adminClient.from("activity_log").insert({
      user_id: authData.user.id,
      username: profile.username,
      event_type: eventType,
      description,
      ip_address: ip,
      device: userAgent,
      metadata: metadata || {},
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
