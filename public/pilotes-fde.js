import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./assets/supabase-config.js";

const configValid = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("VOTRE-PROJET") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("VOTRE_CLE");

const statusEl = document.querySelector("#pilots-status");
const gridEl = document.querySelector("#pilots-grid");
const countEl = document.querySelector("#pilot-count");
const searchEl = document.querySelector("#pilot-search");
const loginToggle = document.querySelector("#admin-login-toggle");
const loginPanel = document.querySelector("#pilot-login-panel");
const loginForm = document.querySelector("#pilot-login-form");
const adminPanel = document.querySelector("#pilot-admin-panel");
const adminIdentity = document.querySelector("#pilot-admin-identity");
const createForm = document.querySelector("#pilot-create-form");
const createButton = document.querySelector("#pilot-submit");
const logoutButton = document.querySelector("#pilot-logout");
const photoInput = document.querySelector("#pilot-photo");
const photoPreview = document.querySelector("#pilot-photo-preview");

let supabaseClient = null;
let allPilots = [];
let signedInAdmin = null;

function announce(message, kind = "info") {
  statusEl.textContent = message;
  statusEl.className = `pilot-notice ${kind}`;
  statusEl.hidden = false;
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
function setBusy(button, busy, text = "Patiente…") {
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}
function displayPilots(list) {
  gridEl.replaceChildren();
  countEl.textContent = `${list.length} ${list.length > 1 ? "PILOTES" : "PILOTE"}`;
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "pilots-empty";
    empty.innerHTML = "<span>FDE</span><h3>LA GRILLE EST EN ATTENTE.</h3><p>Aucun pilote n'est encore publié dans l'annuaire.</p>";
    gridEl.appendChild(empty);
    return;
  }
  for (const pilot of list) {
    const card = document.createElement("article");
    card.className = "pilot-card";
    const portrait = document.createElement("div");
    portrait.className = "pilot-card-photo";
    const image = document.createElement("img");
    image.src = pilot.photo_url;
    image.alt = `Photo de ${pilot.first_name} ${pilot.last_name}`;
    image.loading = "lazy";
    image.onerror = () => {
      portrait.classList.add("photo-unavailable");
      image.remove();
    };
    portrait.appendChild(image);
    const copy = document.createElement("div");
    copy.className = "pilot-card-copy";
    const tag = document.createElement("span");
    tag.className = "pilot-card-kicker";
    tag.textContent = "FDE / PILOTE";
    const name = document.createElement("h3");
    name.textContent = pilot.first_name;
    const surname = document.createElement("p");
    surname.className = "pilot-surname";
    surname.textContent = pilot.last_name;
    const line = document.createElement("div");
    line.className = "pilot-card-line";
    line.innerHTML = "<span>FÉDÉRATION DRIVE ELITE</span><b>↗</b>";
    copy.append(tag, name, surname, line);
    card.append(portrait, copy);
    gridEl.appendChild(card);
  }
}
function filterPilots() {
  const q = searchEl.value.trim().toLocaleLowerCase("fr");
  const filtered = allPilots.filter(p =>
    `${p.first_name} ${p.last_name}`.toLocaleLowerCase("fr").includes(q)
  );
  displayPilots(filtered);
}
async function loadPilots() {
  const { data, error } = await supabaseClient
    .from("fde_pilots")
    .select("id,first_name,last_name,photo_url,created_at")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;
  allPilots = data || [];
  announce(allPilots.length ? "Annuaire chargé." : "L'annuaire est prêt, aucun pilote n'a encore été ajouté.", allPilots.length ? "success" : "info");
  filterPilots();
}
async function tokenOrThrow() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Session expirée. Reconnecte-toi.");
  return session.access_token;
}
async function requireAdmin(user) {
  if (!user) {
    signedInAdmin = null;
    adminPanel.hidden = true;
    return false;
  }
  const { data: profile, error } = await supabaseClient
    .from("profiles").select("role,display_name,email").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!profile || profile.role !== "admin") {
    await supabaseClient.auth.signOut();
    signedInAdmin = null;
    adminPanel.hidden = true;
    announce("Accès réservé aux comptes ayant le rôle Admin.", "error");
    return false;
  }
  signedInAdmin = user;
  adminIdentity.textContent = `Connecté : ${profile.display_name || profile.email || user.email} · Admin`;
  adminPanel.hidden = false;
  loginPanel.hidden = true;
  loginToggle.setAttribute("aria-expanded", "true");
  return true;
}

if (!configValid) {
  announce("Configuration nécessaire : renseigne l'URL et la clé publique Supabase dans assets/supabase-config.js.", "error");
  loginToggle.hidden = true;
} else {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  loadPilots().catch(() => announce("Impossible de charger les pilotes. Vérifie la configuration Supabase et les règles SQL.", "error"));

  loginToggle.addEventListener("click", () => {
    const open = loginPanel.hidden;
    loginPanel.hidden = !open;
    loginToggle.setAttribute("aria-expanded", String(open));
  });
  searchEl.addEventListener("input", filterPilots);

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Connexion…");
    try {
      const form = new FormData(loginForm);
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password"))
      });
      if (error) throw error;
      const okay = await requireAdmin(data.user);
      if (okay) announce("Connexion administrateur réussie.", "success");
    } catch (error) {
      announce(error.message || "Connexion impossible.", "error");
    } finally {
      setBusy(button, false);
    }
  });

  createForm.addEventListener("submit", async event => {
    event.preventDefault();
    const file = photoInput.files?.[0];
    if (!file) return announce("Choisis une photo du pilote.", "error");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) return announce("Format accepté : JPG, PNG ou WebP.", "error");
    if (file.size > 4 * 1024 * 1024) return announce("La photo ne doit pas dépasser 4 Mo.", "error");

    const submitter = createForm.querySelector('button[type="submit"]');
    setBusy(submitter, true, "Ajout du pilote…");
    try {
      const form = new FormData(createForm);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Lecture de la photo impossible."));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const token = await tokenOrThrow();
      const response = await fetch("/api/admin-create-pilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName: String(form.get("firstName")).trim(),
          lastName: String(form.get("lastName")).trim(),
          photoDataUrl: dataUrl
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Impossible d'ajouter ce pilote.");
      createForm.reset();
      photoPreview.hidden = true;
      photoPreview.removeAttribute("src");
      await loadPilots();
      announce(`Pilote ajouté : ${result.pilot.first_name} ${result.pilot.last_name}.`, "success");
    } catch (error) {
      announce(error.message || "Impossible d'ajouter ce pilote.", "error");
    } finally {
      setBusy(submitter, false);
    }
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
      photoPreview.hidden = true;
      photoPreview.removeAttribute("src");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
      photoPreview.hidden = true;
      return announce("Choisis une image JPG, PNG ou WebP de 4 Mo maximum.", "error");
    }
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.hidden = false;
  });

  logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    signedInAdmin = null;
    adminPanel.hidden = true;
    loginPanel.hidden = true;
    loginToggle.setAttribute("aria-expanded", "false");
    announce("Déconnexion administrateur effectuée.", "success");
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    // Do not await API calls inside the auth callback.
    queueMicrotask(() => requireAdmin(session?.user || null).catch(err => announce(err.message, "error")));
  });
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) requireAdmin(session.user).catch(err => announce(err.message, "error"));
  });
}
