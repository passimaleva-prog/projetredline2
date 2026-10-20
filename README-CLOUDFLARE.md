# Project Redline — version Cloudflare Pages

Cette version héberge le site sur Cloudflare, sans que ton PC soit allumé. GitHub sert de dépôt source et Supabase reste la base/authentification.

## Déploiement Cloudflare Pages via GitHub
1. Envoie le contenu de ce dossier dans le dépôt GitHub `projetredline` (les fichiers `package.json`, `functions/`, `public/` et `supabase/` doivent se trouver à la racine du dépôt).
2. Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git.
3. Sélectionne le dépôt GitHub `projetredline`.
4. Build settings :
   - Framework preset : None
   - Root directory : vide
   - Build command : `npm install`
   - Build output directory : `public`
5. Dans le projet Pages, Settings > Variables and Secrets, ajoute pour Production :
   - `SUPABASE_URL` : l'URL du projet Supabase
   - `SUPABASE_ANON_KEY` : la clé publique `sb_publishable_...`
   - `SUPABASE_SERVICE_ROLE_KEY` : ta clé secrète Supabase `sb_secret_...` (enregistrer comme Secret chiffré)
6. Dans `public/assets/supabase-config.js`, remplace `VOTRE_CLE_PUBLIQUE_SUPABASE` par la clé publique réelle. L'URL Supabase issue de la capture précédente est déjà renseignée.
7. Exécute une seule fois les scripts SQL dans `supabase/` dans Supabase > SQL Editor si ce n'est pas déjà fait.
8. Déploie puis teste `/`, `/pilotes-fde.html` et `/comptes.html`.

## Routes API adaptées à Cloudflare Pages Functions
Les fonctions sont dans `functions/api/`, et leur helper partagé dans `src/supabase-server.js` :
- `/api/admin-create-user`
- `/api/admin-update-role`
- `/api/admin-create-pilot`

Les pages JS appellent ces routes Cloudflare, plus les anciennes routes `/.netlify/functions/...`.

## Sécurité
- Ne mets jamais `SUPABASE_SERVICE_ROLE_KEY` dans `public/`, HTML, JavaScript du navigateur ou GitHub.
- Le rôle Admin est vérifié côté fonction serveur avant toute création/modification.
- Les pages HTML sont publiques. Les rôles limitent ici les opérations admin; ils ne rendent pas automatiquement les autres pages privées.
- Supabase doit avoir les tables, politiques RLS et bucket `fde-pilots` créés avec les scripts SQL.
