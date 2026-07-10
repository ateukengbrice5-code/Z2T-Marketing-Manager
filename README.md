# Z2T Marketing Manager — version web déployable

Cette version est un vrai site web : base de données réelle (Supabase),
authentification sécurisée côté serveur, et hébergeable gratuitement pour
commencer. Elle fonctionne sur PC, mobile et tablette via le navigateur —
et peut être "installée" sur l'écran d'accueil du téléphone comme une
application (PWA).

## Vue d'ensemble des étapes

1. Créer un projet Supabase (base de données + authentification) — gratuit
2. Exécuter le script SQL fourni (crée toutes les tables et les règles de sécurité)
3. Déployer la fonction Edge (permet à l'admin de créer des comptes vendeurs/gestionnaires)
4. Configurer le projet avec tes clés Supabase
5. Déployer le site sur Vercel ou Netlify — gratuit
6. (Optionnel) Ajouter un nom de domaine personnalisé

Compte 30 à 45 minutes pour la première mise en ligne complète.

---

## 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → crée un compte gratuit → **New project**
2. Choisis un nom, un mot de passe de base de données (garde-le de côté), une région proche de toi
3. Attends 1-2 minutes que le projet soit prêt

### Désactiver la confirmation par e-mail (important)

Comme l'application utilise des noms d'utilisateur (pas de vraies adresses e-mail), il
faut désactiver la confirmation par e-mail :

- Dans Supabase : **Authentication** → **Providers** → **Email** → désactive
  **"Confirm email"** → Save

## 2. Exécuter le script SQL

1. Dans Supabase : **SQL Editor** → **New query**
2. Ouvre le fichier `supabase/schema.sql` de ce projet, copie tout son contenu, colle-le
3. **Run**

Ça crée les tables (produits, vendeurs, journées, retraits, notifications, profils)
et toutes les règles de sécurité (chacun ne peut voir/modifier que ce qui lui est autorisé).

## 3. Déployer la fonction Edge (création de comptes)

Cette fonction permet à l'admin de créer un compte vendeur ou gestionnaire sans
être déconnecté lui-même. Elle nécessite l'outil en ligne de commande Supabase.

```bash
npm install -g supabase
supabase login
cd z2t-web
supabase link --project-ref TON_ID_DE_PROJET
supabase functions deploy manage-user
```

(Le "ID de projet" se trouve dans Supabase : **Project Settings** → **General** → **Reference ID**.)

## 4. Configurer le projet localement

1. Dans Supabase : **Project Settings** → **API** → note l'**URL** et la clé **anon public**
2. Dans ce dossier, copie `.env.example` vers `.env` et renseigne les deux valeurs :

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ta-clé-anon
```

3. Installe les dépendances et teste en local :

```bash
npm install
npm run dev
```

4. Ouvre l'adresse affichée (ex. `http://localhost:5173`) → crée ton compte administrateur
   → teste l'application.

## 5. Déployer le site (Vercel — recommandé)

1. Mets ce dossier sur GitHub (crée un dépôt, pousse le code)
2. Va sur [vercel.com](https://vercel.com) → connecte-toi avec GitHub → **Add New Project**
   → sélectionne ton dépôt
3. Dans **Environment Variables**, ajoute les deux mêmes clés que dans `.env` :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**

Quelques minutes plus tard, ton site est en ligne à une adresse du type
`https://z2t-marketing-manager.vercel.app` — accessible depuis n'importe quel
navigateur, PC ou mobile.

*(Netlify fonctionne de façon presque identique si tu préfères.)*

## 6. Installer l'appli sur mobile (PWA)

Une fois le site en ligne, sur un téléphone :
- **Android (Chrome)** : menu ⋮ → "Ajouter à l'écran d'accueil"
- **iPhone (Safari)** : bouton Partager → "Sur l'écran d'accueil"

L'icône Z2T apparaît alors comme une vraie application, en plein écran, sans
barre de navigateur.

## 7. Créer une vraie application de bureau (.exe / .dmg)

Cette application de bureau utilise **exactement les mêmes données Supabase**
que la version web — les ventes saisies sur PC apparaissent aussitôt sur
mobile et web, et inversement.

Assure-toi d'avoir déjà fait les étapes 1 à 4 (projet Supabase configuré,
fichier `.env` rempli) avant de continuer.

```bash
npm install
npm run build
npm run electron:start
```

La dernière commande ouvre une fenêtre de bureau avec l'application — utile
pour vérifier que tout fonctionne avant de créer l'installateur.

### Créer l'installateur

```bash
npm run electron:dist
```

Le fichier d'installation apparaît dans le dossier `dist-electron/` (ou
`release/` selon la configuration) :
- **Windows** → un fichier `.exe`
- **Mac** → un fichier `.dmg`
- **Linux** → un fichier `.AppImage`

Construis ce fichier sur le système d'exploitation cible : un `.exe` doit être
construit sur Windows, un `.dmg` sur Mac (electron-builder ne fabrique pas de
`.dmg` depuis Windows).

Le fichier `.env` est lu au moment de `npm run build` — donc pense à toujours
faire `npm run build` avant `npm run electron:dist` si tu changes tes clés
Supabase.

---

## Comment ça fonctionne maintenant (sécurité réelle)

Contrairement à la toute première version (qui tournait uniquement dans
Claude), celle-ci a une vraie sécurité :

- Les mots de passe sont gérés par Supabase Auth (jamais stockés en clair, jamais vérifiés côté navigateur)
- Chaque table a des règles strictes : un vendeur ne peut ni lire ni modifier ce
  qui ne lui appartient pas, un gestionnaire est limité à ses sections autorisées
- La création de comptes vendeur/gestionnaire passe par une fonction serveur
  sécurisée (clé secrète jamais exposée au navigateur)

## Premier compte administrateur

Le tout premier lancement du site (`hasAccount` vide) affiche un écran
"Bienvenue" qui crée le compte administrateur. Une fois créé, cet écran ne
réapparaît plus — les comptes suivants (vendeurs, gestionnaires) se créent
depuis l'onglet "Vendeurs & comptes" une fois connecté en admin.

## Limites connues / pistes d'amélioration

- Pas encore de mise à jour "en direct" entre plusieurs postes ouverts en même
  temps (il faut changer d'onglet ou recharger pour voir les dernières
  données saisies par quelqu'un d'autre). Supabase permet d'ajouter du
  temps réel facilement si besoin plus tard.
- Pas de récupération de mot de passe oublié en libre-service pour l'instant
  (l'admin peut supprimer puis recréer un compte).
- Application mobile "native" (App Store / Play Store) : cette version PWA
  couvre déjà l'essentiel ; une vraie appli native demanderait un outil
  supplémentaire (Capacitor) — possible en évolution future.

## Structure du projet

```
z2t-web/
├── supabase/
│   ├── schema.sql                  → script à exécuter dans Supabase
│   └── functions/manage-user/      → fonction serveur (création/suppression de comptes)
├── electron/
│   └── main.cjs                     → point d'entrée de l'application de bureau
├── src/
│   ├── lib/supabase.js             → connexion à Supabase
│   ├── lib/store.js                → toutes les requêtes base de données
│   ├── App.jsx                     → application complète
│   └── main.jsx
├── public/                          → icônes de l'application
├── .env.example
├── vite.config.js                   → configuration + PWA
└── package.json
```
