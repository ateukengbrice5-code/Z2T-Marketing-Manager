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

### Comptes et e-mails — comment ça marche

- **Comptes administrateurs** : vraie adresse e-mail (nécessaire pour la récupération de mot de passe)
- **Comptes vendeur et gestionnaire** : simple nom d'utilisateur, aucun e-mail requis
  (une adresse technique invisible est générée en interne, aucun e-mail n'est jamais envoyé pour ces comptes)

### Désactiver la confirmation par e-mail (important)

- Dans Supabase : **Authentication** → **Providers** → **Email** → désactive
  **"Confirm email"** → Save

(Sans ça, la création de compte reste bloquée en attente d'un e-mail de confirmation —
qui n'arrivera jamais pour les comptes vendeur/gestionnaire, puisqu'ils n'ont pas de
vraie adresse.)

## 2. Exécuter le script SQL

1. Dans Supabase : **SQL Editor** → **New query**
2. Ouvre le fichier `supabase/schema.sql` de ce projet, copie tout son contenu, colle-le
3. **Run**
4. Fais la même chose avec `supabase/schema_v2_addendum.sql` (présence en ligne,
   traçabilité des retraits, journal d'activité enrichi, édition/suppression de
   messages, pièces jointes, conversations)
5. Fais la même chose avec `supabase/schema_v3_addendum.sql` (messagerie
   directe façon annuaire : n'importe qui peut écrire à n'importe qui)

Ça crée les tables (produits, vendeurs, journées, retraits, notifications, profils,
messages, conversations, journal d'activité) et toutes les règles de sécurité
(chacun ne peut voir/modifier que ce qui lui est autorisé).

## 3. Déployer les fonctions Edge

Deux fonctions serveur sont nécessaires. Elles utilisent l'outil en ligne de
commande Supabase.

```bash
npm install -g supabase
supabase login
cd z2t-web
supabase link --project-ref TON_ID_DE_PROJET

# Création/suppression de comptes (vendeur, gestionnaire, admin secondaire)
# sans déconnecter la session de l'administrateur
supabase functions deploy manage-user

# Journal d'activité : capture l'adresse IP et l'appareil côté serveur
# (impossible à obtenir de façon fiable depuis le navigateur)
supabase functions deploy log-activity
```

(Le "ID de projet" se trouve dans Supabase : **Project Settings** → **General** → **Reference ID**.)

## 3bis. Configurer l'envoi réel des e-mails (mot de passe oublié) avec Resend

Le service d'e-mail intégré à Supabase est très limité (quelques e-mails par
heure) — il ne convient pas pour un vrai usage. On branche donc
[Resend](https://resend.com) (gratuit jusqu'à 3000 e-mails/mois) :

1. Crée un compte sur [resend.com](https://resend.com)
2. **Domains** → ajoute ton propre nom de domaine et vérifie-le (suit les
   instructions DNS affichées) — *ou*, pour tester rapidement sans domaine à
   toi, utilise l'adresse d'essai fournie par Resend (envoie uniquement à ta
   propre adresse, pratique pour vérifier que tout marche avant d'aller plus loin)
3. **API Keys** → **Create API Key** → copie la clé (commence par `re_...`)
4. Dans Supabase : **Project Settings** → **Authentication** → **SMTP Settings**
   → active **"Enable Custom SMTP"** et renseigne :
   - Host : `smtp.resend.com`
   - Port : `465`
   - Username : `resend`
   - Password : ta clé API Resend (`re_...`)
   - Sender email : une adresse de ton domaine vérifié (ex. `noreply@tondomaine.com`)
   - Sender name : `Z2T Marketing Manager`
5. **Save**

### Vérifier les adresses de redirection

Toujours dans Supabase : **Authentication** → **URL Configuration** :
- **Site URL** : l'adresse de ton site une fois en ligne (ex. `https://z2t-marketing-manager.vercel.app`)
- **Redirect URLs** : ajoute aussi `http://localhost:5173` (pour tester en local)

Sans ça, le lien reçu par e-mail pour choisir un nouveau mot de passe risque de
rediriger vers la mauvaise adresse.


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

Le dossier `desktop/` est volontairement **séparé** du reste du projet (son
propre `package.json`), pour qu'Electron n'interfère jamais avec le
déploiement du site web (Vercel, etc.) — les deux sont totalement indépendants.

Assure-toi d'avoir déjà fait les étapes 1 à 4 (projet Supabase configuré,
fichier `.env` rempli) avant de continuer.

```bash
# 1. Construire le site web (à la racine du projet)
npm install
npm run build

# 2. Installer et lancer l'application de bureau (dans son propre dossier)
cd desktop
npm install
npm run electron:start
```

La dernière commande ouvre une fenêtre de bureau avec l'application — utile
pour vérifier que tout fonctionne avant de créer l'installateur.

### Créer l'installateur

Toujours depuis le dossier `desktop/` :

```bash
npm run electron:dist
```

Le fichier d'installation apparaît dans `desktop/release/` :
- **Windows** → un fichier `.exe`
- **Mac** → un fichier `.dmg`
- **Linux** → un fichier `.AppImage`

Construis ce fichier sur le système d'exploitation cible : un `.exe` doit être
construit sur Windows, un `.dmg` sur Mac (electron-builder ne fabrique pas de
`.dmg` depuis Windows).

Le fichier `.env` (à la racine du projet) est lu au moment de `npm run build`
— donc pense à toujours refaire l'étape 1 (`npm run build` à la racine) avant
`npm run electron:dist` si tu changes tes clés Supabase.

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
"Bienvenue" qui crée le compte **administrateur principal** (nom + vraie
adresse e-mail + mot de passe). Une fois créé, cet écran ne réapparaît plus.

Depuis l'onglet "Vendeurs & comptes", cet administrateur principal peut ensuite créer :
- des **vendeurs** (nom d'utilisateur simple, sans e-mail)
- des **gestionnaires** (nom d'utilisateur simple, sans e-mail)
- des **administrateurs secondaires** (vraie adresse e-mail, mêmes accès que
  l'admin principal) — leurs connexions et actions importantes sont
  enregistrées dans l'onglet **"Journal d'activité"**, visible uniquement par
  l'admin principal

## Mot de passe oublié

Réservé aux comptes administrateurs (principal et secondaires), puisqu'eux
seuls ont une vraie adresse e-mail. Depuis l'écran de connexion : "Mot de
passe oublié ?" → un e-mail est envoyé avec un lien pour choisir un nouveau
mot de passe (nécessite d'avoir configuré Resend, voir étape 3bis).

Les comptes vendeur/gestionnaire n'ont pas de récupération en libre-service :
l'admin supprime puis recrée leur compte en cas d'oubli.

## Limites connues / pistes d'amélioration

- Pas encore de mise à jour "en direct" entre plusieurs postes ouverts en même
  temps (il faut changer d'onglet ou recharger pour voir les dernières
  données saisies par quelqu'un d'autre). Supabase permet d'ajouter du
  temps réel facilement si besoin plus tard.
- Application mobile "native" (App Store / Play Store) : cette version PWA
  couvre déjà l'essentiel ; une vraie appli native demanderait un outil
  supplémentaire (Capacitor) — possible en évolution future.

## Structure du projet

```
z2t-web/
├── supabase/
│   ├── schema.sql                  → script à exécuter dans Supabase
│   └── functions/manage-user/      → fonction serveur (création/suppression de comptes)
├── desktop/                          → application de bureau, isolée du site web
│   ├── main.cjs                     → point d'entrée Electron
│   └── package.json                 → dépendances Electron (séparées du site)
├── src/
│   ├── lib/supabase.js             → connexion à Supabase
│   ├── lib/store.js                → toutes les requêtes base de données
│   ├── App.jsx                     → application complète
│   └── main.jsx
├── public/                          → icônes de l'application
├── .env.example
├── vite.config.js                   → configuration + PWA
└── package.json                     → dépendances du site web uniquement
```
