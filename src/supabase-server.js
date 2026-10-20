import { createClient } from "@supabase/supabase-js";

export function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function adminClient(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configuration Supabase serveur incomplète.");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export async function requireAdmin(request, env) {
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: json(401, { error: "Connexion requise." }) };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: json(500, { error: "Configuration Supabase manquante dans Cloudflare Pages > Settings > Variables and Secrets." }) };
  }

  const caller = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData?.user) return { error: json(401, { error: "Session invalide. Reconnecte-toi." }) };

  const admin = adminClient(env);
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profileError) return { error: json(500, { error: "Impossible de vérifier les permissions du compte." }) };
  if (profile?.role !== "admin") return { error: json(403, { error: "Action réservée aux administrateurs." }) };
  return { user: authData.user, admin };
}
