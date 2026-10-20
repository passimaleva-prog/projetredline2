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
  const userId = String(body.userId || "");
  const role = String(body.role || "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !allowedRoles.has(role)) {
    return json(400, { error: "Compte ou rôle invalide." });
  }
  if (userId === auth.user.id) return json(400, { error: "Tu ne peux pas modifier ton propre rôle depuis cette page." });

  const { data: target, error: targetError } = await auth.admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (targetError || !target) return json(404, { error: "Compte introuvable." });
  const { error } = await auth.admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return json(500, { error: "La mise à jour du rôle a échoué." });
  return json(200, { success: true, role });
}
