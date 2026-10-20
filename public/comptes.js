import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./assets/supabase-config.js";

let supabaseClient = null;

const setupWarning = document.querySelector("#setup-warning");
const statusMessage = document.querySelector("#status-message");
const loginPanel = document.querySelector("#login-panel");
const adminPanel = document.querySelector("#admin-panel");
const loginForm = document.querySelector("#login-form");
const createUserForm = document.querySelector("#create-user-form");
const usersBody = document.querySelector("#users-table-body");
const createButton = document.querySelector("#create-user-button");
const logoutButton = document.querySelector("#logout-button");
const refreshButton = document.querySelector("#refresh-users");
const adminIdentity = document.querySelector("#admin-identity");

const roleLabels = {
  admin: "Admin",
  crew: "Crew",
  federation: "Fédération",
  spectateur: "Spectateur"
};
const validConfig =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("VOTRE-PROJET") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("VOTRE_CLE");

function showMessage(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `accounts-notice ${type}`;
  statusMessage.hidden = false;
}
function clearMessage() {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function setButtonBusy(button, busy, busyText = "Patiente…") {
  if (busy) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }
}
async function currentAccessToken() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Session expirée. Reconnecte-toi.");
  return session.access_token;
}
async function callAdminFunction(name, payload) {
  const token = await currentAccessToken();
  const response = await fetch(`/api/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  let result = {};
  try { result = await response.json(); } catch { /* réponse non JSON */ }
  if (!response.ok) throw new Error(result.error || "La demande a échoué.");
  return result;
}
async function loadUsers() {
  usersBody.innerHTML = '<tr><td colspan="4" class="empty-state">Chargement des comptes…</td></tr>';
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id,email,display_name,discord,role,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  usersBody.innerHTML = "";
  if (!data || data.length === 0) {
    usersBody.innerHTML = '<tr><td colspan="4" class="empty-state">Aucun compte trouvé.</td></tr>';
    return;
  }
  for (const profile of data) {
    const row = document.createElement("tr");
    const created = profile.created_at
      ? new Date(profile.created_at).toLocaleDateString("fr-FR")
      : "—";
    const isSelf = profile.id === user.id;
    row.innerHTML = `
      <td><strong>${escapeHtml(profile.display_name || "Nom non renseigné")}</strong><small>${escapeHtml(profile.discord || "Discord non renseigné")}</small></td>
      <td>${escapeHtml(profile.email || "—")}</td>
      <td>
        <select class="role-select" aria-label="Rôle de ${escapeHtml(profile.display_name || profile.email || "ce compte")}" data-user-id="${escapeHtml(profile.id)}" ${isSelf ? "disabled title=\"Ton propre rôle ne peut pas être modifié ici\"" : ""}>
          ${Object.entries(roleLabels).map(([value, label]) =>
            `<option value="${value}" ${profile.role === value ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </td>
      <td>${created}</td>`;
    const select = row.querySelector("select");
    if (!isSelf) {
      select.addEventListener("change", async () => {
        const originalRole = profile.role;
        select.disabled = true;
        try {
          await callAdminFunction("admin-update-role", {
            userId: profile.id,
            role: select.value
          });
          profile.role = select.value;
          showMessage(`Rôle mis à jour : ${profile.display_name || profile.email} → ${roleLabels[profile.role]}.`, "success");
        } catch (error) {
          select.value = originalRole;
          showMessage(error.message || "Impossible de modifier le rôle.", "error");
        } finally {
          select.disabled = false;
        }
      });
    }
    usersBody.appendChild(row);
  }
}
async function displayForUser(user) {
  clearMessage();
  if (!user) {
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    return;
  }
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile || profile.role !== "admin") {
    await supabaseClient.auth.signOut();
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    showMessage("Accès refusé : cette page est réservée au rôle Admin.", "error");
    return;
  }
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  adminIdentity.textContent = `Connecté en tant que ${profile.display_name || profile.email} · Admin`;
  await loadUsers();
}

if (!validConfig) {
  setupWarning.hidden = false;
  loginForm.querySelectorAll("input,button").forEach(el => el.disabled = true);
} else {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();
    const button = loginForm.querySelector('button[type="submit"]');
    setButtonBusy(button, true, "Connexion…");
    try {
      const form = new FormData(loginForm);
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password"))
      });
      if (error) throw error;
      await displayForUser(data.user);
    } catch (error) {
      showMessage(error.message || "Connexion impossible.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  createUserForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();
    setButtonBusy(createButton, true, "Création du compte…");
    try {
      const form = new FormData(createUserForm);
      const payload = {
        displayName: String(form.get("displayName")).trim(),
        discord: String(form.get("discord")).trim(),
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password")),
        role: String(form.get("role"))
      };
      if (!payload.displayName || !payload.email || payload.password.length < 10) {
        throw new Error("Renseigne le nom, l’adresse e-mail et un mot de passe d’au moins 10 caractères.");
      }
      const result = await callAdminFunction("admin-create-user", payload);
      createUserForm.reset();
      showMessage(`Compte créé pour ${result.user?.email || payload.email}, rôle ${roleLabels[payload.role]}.`, "success");
      await loadUsers();
    } catch (error) {
      showMessage(error.message || "La création du compte a échoué.", "error");
    } finally {
      setButtonBusy(createButton, false);
    }
  });

  logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    showMessage("Déconnexion effectuée.", "success");
  });
  refreshButton.addEventListener("click", async () => {
    try { await loadUsers(); showMessage("Liste actualisée.", "success"); }
    catch (error) { showMessage(error.message, "error"); }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    // Defer the database query outside Supabase's auth callback to avoid locking the auth client.
    setTimeout(() => displayForUser(session?.user || null).catch(error => showMessage(error.message, "error")), 0);
  });
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    displayForUser(session?.user || null).catch(error => showMessage(error.message, "error"));
  });
}
