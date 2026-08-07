import { supabase } from "../supabase.js";

// messaging-related methods extracted
export async function getOrCreateDMConversation(otherUserId) {
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user.id;
  const { data: existing, error: selErr } = await supabase
    .from("dm_conversations").select("id")
    .or(`and(user_a.eq.${myId},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${myId})`)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;
  const { data: created, error: insErr } = await supabase
    .from("dm_conversations").insert({ user_a: myId, user_b: otherUserId }).select("id").single();
  if (insErr) throw insErr;
  return created.id;
}

export async function getDMMessages(conversationId) {
  const { data, error } = await supabase.from("dm_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []);
}

export async function sendDMMessage({ conversationId, senderId, senderUsername, content, attachmentUrl, attachmentType }) {
  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: conversationId, sender_id: senderId, sender_username: senderUsername, content,
    attachment_url: attachmentUrl || null, attachment_type: attachmentType || null,
  });
  if (error) throw error;
  await supabase.from("dm_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function uploadDMAttachment(conversationId, file) {
  const ext = file.name.split(".").pop();
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data: signed, error: urlErr } = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (urlErr) throw urlErr;
  return { url: signed.signedUrl, type: file.type, path };
}
