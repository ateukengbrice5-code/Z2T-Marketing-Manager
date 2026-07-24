// Fonction Supabase Edge : permet à un vendeur de créer lui-même son compte
// de connexion à partir d'un lien d'invitation généré par un admin/gestionnaire.
// Contrairement à manage-user, cette fonction est PUBLIQUE (pas de session
// requise) puisque la personne n'est justement pas encore connectée.
// Déploiement : supabase functions deploy claim-invite
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { token, username, password } = await req.json();
    if (!token || !username || !password) {
      return new Response(JSON.stringify({ error: "Champs manquants." }), { status: 400, headers: cors });
    }
    if (String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères." }), { status: 400, headers: cors });
    }

    const { data: invite, error: inviteErr } = await adminClient
      .from("invite_links").select("*").eq("token", token).single();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Lien d'invitation invalide." }), { status: 404, headers: cors });
    }
    if (invite.used_at) {
      return new Response(JSON.stringify({ error: "Ce lien d'invitation a déjà été utilisé." }), { status: 400, headers: cors });
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Ce lien d'invitation a expiré. Demande à ton admin d'en générer un nouveau." }), { status: 400, headers: cors });
    }

    const authEmail = `${String(username).trim().toLowerCase()}@z2t.local`;
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: authEmail, password, email_confirm: true,
    });
    if (createErr) {
      const msg = createErr.message === "A user with this email address has already been registered"
        ? "Ce nom d'utilisateur est déjà pris, choisis-en un autre."
        : createErr.message;
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: cors });
    }

    const { error: profileErr } = await adminClient.from("profiles").insert({
      id: created.user.id, username: String(username).trim(),
      role: invite.role || "vendor",
      vendor_id: invite.vendor_id || null,
      is_primary: false,
    });
    if (profileErr) {
      // Nettoyage : on ne laisse pas un compte auth orphelin sans profil.
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: cors });
    }

    await adminClient.from("invite_links").update({
      used_at: new Date().toISOString(),
      used_by_username: String(username).trim(),
    }).eq("id", invite.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
