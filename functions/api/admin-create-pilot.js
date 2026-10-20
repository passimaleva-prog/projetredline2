import { json, requireAdmin } from "../../src/supabase-server.js";

const ALLOWED_MIME = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]
]);
const MAX_BYTES = 4 * 1024 * 1024;
const BUCKET = "fde-pilots";

export async function onRequestPost({ request, env }) {
  let auth;
  try { auth = await requireAdmin(request, env); }
  catch (error) { return json(500, { error: error.message || "Erreur serveur." }); }
  if (auth.error) return auth.error;

  let body;
  try { body = await request.json(); }
  catch { return json(400, { error: "Données JSON invalides." }); }
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const dataUrl = String(body.photoDataUrl || "");
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
    return json(400, { error: "Renseigne un prénom et un nom (60 caractères maximum chacun)." });
  }
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return json(400, { error: "Photo invalide. Utilise un fichier JPG, PNG ou WebP." });

  const mime = match[1];
  const encoded = match[2];
  const binary = atob(encoded);
  if (!binary.length || binary.length > MAX_BYTES) return json(400, { error: "La photo dépasse la taille maximale de 4 Mo." });
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const extension = ALLOWED_MIME.get(mime);
  const storagePath = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await auth.admin.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: mime, cacheControl: "3600", upsert: false
  });
  if (uploadError) return json(500, { error: "Échec de l’envoi de la photo. Vérifie le bucket fde-pilots dans Supabase." });

  const { data: publicData } = auth.admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const { data: pilot, error: insertError } = await auth.admin.from("fde_pilots").insert({
    first_name: firstName,
    last_name: lastName,
    photo_url: publicData.publicUrl,
    photo_path: storagePath,
    created_by: auth.user.id
  }).select("id,first_name,last_name,photo_url,created_at").single();

  if (insertError) {
    await auth.admin.storage.from(BUCKET).remove([storagePath]);
    return json(500, { error: "La fiche pilote n’a pas pu être enregistrée." });
  }
  return json(201, { pilot });
}
