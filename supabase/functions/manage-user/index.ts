// Fonction Supabase Edge : crée ou supprime un compte (vendeur ou gestionnaire)
// sans déconnecter la session de l'administrateur qui fait la demande.
// Déploiement : supabase functions deploy manage-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Vérifie si `callerProfile` a le droit de créer (ou d'inviter) un compte du
// rôle demandé. Centralisé ici pour que la création directe et la création
// de lien d'invitation appliquent exactement la même règle.
function roleCreationError(callerProfile, role) {
  if (!["vendor", "manager", "admin", "messenger"].includes(role)) return "Rôle invalide.";
  if (role === "manager" && callerProfile.role !== "admin") return "Seul un administrateur peut créer un compte gestionnaire.";
  if (role === "admin" && !callerProfile.is_primary) return "Seul l'administrateur principal peut créer un compte administrateur.";
  return null;
}

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
      .from("profiles").select("role, is_primary, username, entreprise_id").eq("id", authData.user.id).single();

    if (!callerProfile || !["admin", "manager"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 403, headers: cors });
    }

    const body = await req.json();
    const action = body.action || "create";
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "delete") {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: "Identifiant manquant." }), { status: 400, headers: cors });

      const { data: targetProfile } = await adminClient.from("profiles").select("role, is_primary, entreprise_id").eq("id", userId).single();
      if (targetProfile && targetProfile.entreprise_id !== callerProfile.entreprise_id) {
        return new Response(JSON.stringify({ error: "Ce compte n'appartient pas à ton entreprise." }), { status: 403, headers: cors });
      }
      if (targetProfile?.role === "manager" && callerProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Seul un administrateur peut supprimer un compte gestionnaire." }), { status: 403, headers: cors });
      }
      if (targetProfile?.role === "admin") {
        if (!callerProfile.is_primary) {
          return new Response(JSON.stringify({ error: "Seul l'administrateur principal peut supprimer un compte administrateur." }), { status: 403, headers: cors });
        }
        if (targetProfile.is_primary) {
          return new Response(JSON.stringify({ error: "Impossible de supprimer le compte administrateur principal." }), { status: 403, headers: cors });
        }
      }
      await adminClient.from("profiles").delete().eq("id", userId);
      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: cors });

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "convert") {
      const { userId, newRole } = body;
      if (!userId || !newRole) {
        return new Response(JSON.stringify({ error: "Champs manquants." }), { status: 400, headers: cors });
      }
      if (newRole !== "messenger") {
        return new Response(JSON.stringify({ error: "Conversion non prise en charge." }), { status: 400, headers: cors });
      }

      const { data: targetProfile } = await adminClient.from("profiles").select("role, entreprise_id").eq("id", userId).single();
      if (!targetProfile) {
        return new Response(JSON.stringify({ error: "Compte introuvable." }), { status: 404, headers: cors });
      }
      if (targetProfile.entreprise_id !== callerProfile.entreprise_id) {
        return new Response(JSON.stringify({ error: "Ce compte n'appartient pas à ton entreprise." }), { status: 403, headers: cors });
      }
      if (targetProfile.role !== "vendor") {
        return new Response(JSON.stringify({ error: "Seul un compte vendeur peut être converti en compte messagerie." }), { status: 400, headers: cors });
      }

      const { error: convErr } = await adminClient.from("profiles").update({ role: "messenger", vendor_id: null }).eq("id", userId);
      if (convErr) return new Response(JSON.stringify({ error: convErr.message }), { status: 400, headers: cors });

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "create_invite") {
      const { role, vendorId, expiresInDays } = body;
      if (!role) return new Response(JSON.stringify({ error: "Rôle manquant." }), { status: 400, headers: cors });
      const permErr = roleCreationError(callerProfile, role);
      if (permErr) return new Response(JSON.stringify({ error: permErr }), { status: 403, headers: cors });
      if (role === "vendor" && !vendorId) {
        return new Response(JSON.stringify({ error: "Un vendeur associé est requis." }), { status: 400, headers: cors });
      }

      // Pour un vendeur, on réutilise un lien actif existant plutôt que d'en
      // empiler un nouveau à chaque clic. Messagerie/gestionnaire/admin
      // n'ont pas d'entité préexistante à cibler : chaque invitation est
      // indépendante (plusieurs recrues potentielles en parallèle).
      if (role === "vendor") {
        const { data: existing } = await adminClient
          .from("invite_links").select("*").eq("vendor_id", vendorId).eq("role", "vendor")
          .is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (existing && (!existing.expires_at || new Date(existing.expires_at) >= new Date())) {
          return new Response(JSON.stringify({ id: existing.id, token: existing.token, role: existing.role, vendorId: existing.vendor_id, expiresAt: existing.expires_at, reused: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + (Number(expiresInDays) || 7) * 24 * 60 * 60 * 1000).toISOString();
      const { data: createdInvite, error: inviteErr } = await adminClient.from("invite_links").insert({
        token, role, vendor_id: role === "vendor" ? vendorId : null,
        created_by: callerProfile.username || null, expires_at: expiresAt,
        entreprise_id: callerProfile.entreprise_id,
      }).select("id, expires_at").single();
      if (inviteErr) return new Response(JSON.stringify({ error: inviteErr.message }), { status: 400, headers: cors });

      return new Response(JSON.stringify({ id: createdInvite.id, token, role, vendorId: vendorId || null, expiresAt: createdInvite.expires_at, reused: false }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "list_invites") {
      // Un gestionnaire ne voit jamais les invitations admin ; un admin
      // secondaire ne voit jamais les invitations admin non plus, seul le
      // principal les voit — même logique que pour la création.
      const query = adminClient.from("invite_links").select("*").eq("entreprise_id", callerProfile.entreprise_id).is("used_at", null).order("created_at", { ascending: false });
      const { data: invites, error: listErr } = await query;
      if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 400, headers: cors });
      const visible = (invites || []).filter((inv) => {
        if (inv.role === "admin") return !!callerProfile.is_primary;
        if (inv.role === "manager") return callerProfile.role === "admin";
        return true; // vendor / messenger : visibles par tout admin/gestionnaire
      });
      return new Response(JSON.stringify({ invites: visible }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "revoke_invite") {
      const { inviteId } = body;
      if (!inviteId) return new Response(JSON.stringify({ error: "Identifiant manquant." }), { status: 400, headers: cors });
      const { data: invite } = await adminClient.from("invite_links").select("role, entreprise_id").eq("id", inviteId).single();
      if (invite) {
        if (invite.entreprise_id !== callerProfile.entreprise_id) {
          return new Response(JSON.stringify({ error: "Ce lien n'appartient pas à ton entreprise." }), { status: 403, headers: cors });
        }
        const permErr = roleCreationError(callerProfile, invite.role);
        if (permErr) return new Response(JSON.stringify({ error: permErr }), { status: 403, headers: cors });
      }
      const { error: revokeErr } = await adminClient.from("invite_links").delete().eq("id", inviteId);
      if (revokeErr) return new Response(JSON.stringify({ error: revokeErr.message }), { status: 400, headers: cors });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // action === "create"
    const { username, password, role, vendorId } = body;
    if (!username || !password || !role) {
      return new Response(JSON.stringify({ error: "Champs manquants." }), { status: 400, headers: cors });
    }
    const permErr = roleCreationError(callerProfile, role);
    if (permErr) return new Response(JSON.stringify({ error: permErr }), { status: 403, headers: cors });
    if (role === "vendor" && !vendorId) {
      return new Response(JSON.stringify({ error: "Un vendeur associé est requis." }), { status: 400, headers: cors });
    }

    const authEmail = `${String(username).trim().toLowerCase()}@z2t.local`;

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: authEmail, password, email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: cors });
    }

    const { error: profileErr } = await adminClient.from("profiles").insert({
      id: created.user.id, username: String(username).trim(),
      role, vendor_id: role === "vendor" ? vendorId : null, is_primary: false,
      entreprise_id: callerProfile.entreprise_id,
    });
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});

