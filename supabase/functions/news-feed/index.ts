// Fonction Supabase Edge : fil d'actualité partagé (paliers de vente atteints,
// anniversaires du jour, annonces admin) + réactions. Toute personne connectée
// (vendeur, gestionnaire, messagerie, admin) peut lire et réagir ; seuls les
// admins/gestionnaires peuvent publier une annonce.
// Déploiement : supabase functions deploy news-feed
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const REACTION_EMOJIS = ["👍", "❤️"];
const MAX_ANNOUNCEMENT_LENGTH = 2000;

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

    // Ici, contrairement à manage-user, TOUT rôle connecté (vendeur,
    // messagerie, gestionnaire, admin) est autorisé à lire/réagir — le fil
    // est fait pour toute l'équipe, pas seulement l'encadrement.
    const { data: callerProfile } = await callerClient
      .from("profiles").select("role, username, entreprise_id").eq("id", authData.user.id).single();
    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Profil introuvable." }), { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "list") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [achievementsRes, birthdaysRes, announcementsRes, reactionsRes] = await Promise.all([
        adminClient.from("objective_achievements").select("*").eq("entreprise_id", callerProfile.entreprise_id).gte("created_at", since).order("created_at", { ascending: false }),
        adminClient.from("vendors_with_birthday_today").select("*").eq("entreprise_id", callerProfile.entreprise_id),
        adminClient.from("news_announcements").select("*").eq("entreprise_id", callerProfile.entreprise_id).order("created_at", { ascending: false }).limit(50),
        adminClient.from("news_reactions").select("*").eq("entreprise_id", callerProfile.entreprise_id),
      ]);
      if (achievementsRes.error) return new Response(JSON.stringify({ error: achievementsRes.error.message }), { status: 400, headers: cors });
      if (birthdaysRes.error) return new Response(JSON.stringify({ error: birthdaysRes.error.message }), { status: 400, headers: cors });
      if (announcementsRes.error) return new Response(JSON.stringify({ error: announcementsRes.error.message }), { status: 400, headers: cors });
      if (reactionsRes.error) return new Response(JSON.stringify({ error: reactionsRes.error.message }), { status: 400, headers: cors });

      const todayISO = new Date().toISOString().slice(0, 10);
      const reactionsByKey = {};
      for (const r of reactionsRes.data || []) {
        const k = `${r.item_type}:${r.item_key}`;
        if (!reactionsByKey[k]) reactionsByKey[k] = [];
        reactionsByKey[k].push(r);
      }
      const attachReactions = (itemType, itemKey) => {
        const rows = reactionsByKey[`${itemType}:${itemKey}`] || [];
        const counts = {};
        for (const emoji of REACTION_EMOJIS) counts[emoji] = 0;
        let mine = null;
        for (const r of rows) {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          if (r.user_id === authData.user.id) mine = r.emoji;
        }
        return { reactions: counts, myReaction: mine };
      };

      const items = [];
      for (const a of achievementsRes.data || []) {
        const key = String(a.id);
        items.push({
          type: "achievement", key, createdAt: a.created_at,
          vendorId: a.vendor_id, vendorNom: a.vendor_nom, date: a.date,
          palier: a.palier, montant: Number(a.montant) || 0,
          ...attachReactions("achievement", key),
        });
      }
      for (const v of birthdaysRes.data || []) {
        const key = `${v.id}:${todayISO}`;
        items.push({
          type: "birthday", key, createdAt: `${todayISO}T00:00:00.000Z`,
          vendorId: v.id, vendorNom: v.nom, vendorPrenom: v.prenom, photoUrl: v.photo_url, age: v.age,
          ...attachReactions("birthday", key),
        });
      }
      for (const ann of announcementsRes.data || []) {
        const key = String(ann.id);
        items.push({
          type: "announcement", key, createdAt: ann.created_at,
          content: ann.content, createdBy: ann.created_by,
          canDelete: callerProfile.role === "admin" || ann.created_by_id === authData.user.id,
          ...attachReactions("announcement", key),
        });
      }
      items.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));

      return new Response(JSON.stringify({ items }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "post_announcement") {
      if (!["admin", "manager"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Seuls les administrateurs et gestionnaires peuvent publier une annonce." }), { status: 403, headers: cors });
      }
      const content = String(body.content || "").trim();
      if (!content) return new Response(JSON.stringify({ error: "Le message ne peut pas être vide." }), { status: 400, headers: cors });
      if (content.length > MAX_ANNOUNCEMENT_LENGTH) {
        return new Response(JSON.stringify({ error: `Le message est trop long (maximum ${MAX_ANNOUNCEMENT_LENGTH} caractères).` }), { status: 400, headers: cors });
      }
      const { data: created, error: insErr } = await adminClient.from("news_announcements").insert({
        content, created_by: callerProfile.username || null, created_by_id: authData.user.id,
        entreprise_id: callerProfile.entreprise_id,
      }).select("id, created_at").single();
      if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 400, headers: cors });
      return new Response(JSON.stringify({ id: created.id, createdAt: created.created_at }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "delete_announcement") {
      const { id } = body;
      if (!id) return new Response(JSON.stringify({ error: "Identifiant manquant." }), { status: 400, headers: cors });
      const { data: ann } = await adminClient.from("news_announcements").select("created_by_id, entreprise_id").eq("id", id).single();
      if (!ann) return new Response(JSON.stringify({ error: "Annonce introuvable." }), { status: 404, headers: cors });
      if (ann.entreprise_id !== callerProfile.entreprise_id) {
        return new Response(JSON.stringify({ error: "Cette annonce n'appartient pas à ton entreprise." }), { status: 403, headers: cors });
      }
      const canDelete = callerProfile.role === "admin" || ann.created_by_id === authData.user.id;
      if (!canDelete) {
        return new Response(JSON.stringify({ error: "Tu ne peux supprimer que tes propres annonces." }), { status: 403, headers: cors });
      }
      const { error: delErr } = await adminClient.from("news_announcements").delete().eq("id", id);
      if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: cors });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "react") {
      const { itemType, itemKey, emoji } = body;
      if (!["achievement", "birthday", "announcement"].includes(itemType)) {
        return new Response(JSON.stringify({ error: "Type d'élément invalide." }), { status: 400, headers: cors });
      }
      if (!itemKey) return new Response(JSON.stringify({ error: "Élément manquant." }), { status: 400, headers: cors });
      if (!REACTION_EMOJIS.includes(emoji)) {
        return new Response(JSON.stringify({ error: "Réaction non prise en charge." }), { status: 400, headers: cors });
      }
      const { data: existing } = await adminClient
        .from("news_reactions").select("id, emoji")
        .eq("item_type", itemType).eq("item_key", itemKey).eq("user_id", authData.user.id).maybeSingle();

      if (existing && existing.emoji === emoji) {
        // Cliquer à nouveau sur la même réaction la retire (bascule).
        await adminClient.from("news_reactions").delete().eq("id", existing.id);
        return new Response(JSON.stringify({ myReaction: null }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (existing) {
        await adminClient.from("news_reactions").update({ emoji }).eq("id", existing.id);
      } else {
        await adminClient.from("news_reactions").insert({
          item_type: itemType, item_key: itemKey, user_id: authData.user.id,
          username: callerProfile.username || null, emoji,
          entreprise_id: callerProfile.entreprise_id,
        });
      }
      return new Response(JSON.stringify({ myReaction: emoji }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Action inconnue." }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
