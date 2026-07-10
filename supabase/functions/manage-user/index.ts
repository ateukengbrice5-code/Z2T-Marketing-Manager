// Fonction Supabase Edge : crée ou supprime un compte (vendeur ou gestionnaire)
// sans déconnecter la session de l'administrateur qui fait la demande.
// Déploiement : supabase functions deploy manage-user
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

    const { data: callerProfile } = await callerClient
      .from("profiles").select("role").eq("id", authData.user.id).single();

    if (!callerProfile || !["admin", "manager"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 403, headers: cors });
    }

    const body = await req.json();
    const action = body.action || "create";
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "delete") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "Identifiant manquant." }), { status: 400, headers: cors });

      const { data: targetProfile } = await adminClient.from("profiles").select("role").eq("id", userId).single();
      if (targetProfile?.role === "manager" && callerProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Seul un administrateur peut supprimer un compte gestionnaire." }), { status: 403, headers: cors });
      }

      await adminClient.from("profiles").delete().eq("id", userId);
      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: cors });

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // action === "create"
    const { username, password, role, vendorId } = body;
    if (!username || !password || !role) {
      return new Response(JSON.stringify({ error: "Champs manquants." }), { status: 400, headers: cors });
    }
    if (!["vendor", "manager"].includes(role)) {
      return new Response(JSON.stringify({ error: "Rôle invalide." }), { status: 400, headers: cors });
    }
    if (role === "manager" && callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Seul un administrateur peut créer un compte gestionnaire." }), { status: 403, headers: cors });
    }
    if (role === "vendor" && !vendorId) {
      return new Response(JSON.stringify({ error: "Un vendeur associé est requis." }), { status: 400, headers: cors });
    }

    const email = `${String(username).trim().toLowerCase()}@z2t.local`;

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: cors });
    }

    const { error: profileErr } = await adminClient.from("profiles").insert({
      id: created.user.id, username: String(username).trim(), role, vendor_id: role === "vendor" ? vendorId : null,
    });
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});

