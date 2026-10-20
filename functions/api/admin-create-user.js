import { json, requireAdmin } from "../../src/supabase-server.js";

const allowedRoles = new Set(["admin", "crew", "federation", "spectateur"]);

export async function onRequestPost({ request, env }) {
  let auth;
  try { auth = await requireAdmin(request, env); }
  catch (error) { return json(500, { error: error.message || "Erreur serveur." }); }
  if (auth.error) return auth.error;

  let body;
  try { body = await request.json(); }
  catch { return json(400, { error: "Données JSON invalides." }); }

  const displayName = String(body.displayName || "").trim().slice(0, 80);
  const discord = String(body.discord || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "");
  if (!displayName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 10 || password.length > 128 || !allowedRoles.has(role)) {
    return json(400, { error: "Vérifie le nom, l’adresse e-mail, le rôle et le mot de passe (10 caractères minimum)." });
  }

  const { data: created, error: createError } = await auth.admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: displayName, discord }
  });
  if (createError) {
    const message = /already registered|already been registered|already exists/i.test(createError.message)
      ? "Cette adresse e-mail possède déjà un compte."
      : createError.message;
    return json(400, { error: message });
  }
  const user = created?.user;
  if (!user) return json(500, { error: "Supabase n’a pas renvoyé le compte créé." });

  const { error: updateError } = await auth.admin
    .from("profiles").update({ email, display_name: displayName, discord, role }).eq("id", user.id);
  if (updateError) {
    await auth.admin.auth.admin.deleteUser(user.id);
    return json(500, { error: "Le profil n’a pas pu être enregistré. La création a été annulée." });
  }
  return json(201, { user: { id: user.id, email }, role });
}
