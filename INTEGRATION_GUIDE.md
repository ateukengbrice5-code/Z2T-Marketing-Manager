# 🎯 Guide d'Intégration - Profil Vendeur Détaillé

Ce guide explique comment intégrer les nouveaux composants et fonctionnalités dans ton application Z2T Marketing Manager.

---

## 📦 Fichiers Créés

### 1. **Schéma Base de Données** (`supabase/schema_v4_vendors_profile.sql`)
Ajoute les tables et fonctions pour gérer les profils vendeurs détaillés.

**À faire :**
```bash
1. Va sur Supabase → SQL Editor → New Query
2. Copie tout le contenu de supabase/schema_v4_vendors_profile.sql
3. Clique "Run"
```

**Tables créées :**
- `vendor_attendance` : historique de présence/absence
- `birthdays` : suivi des anniversaires
- Colonnes ajoutées à `vendors` : CNI, date de naissance, photo, téléphone, etc.

---

### 2. **Composants React Créés**

#### `src/components/VendorSignUp.jsx` 📝
**Inscription simplifiée en 3 étapes :**
1. ☎️ Téléphone (vérification)
2. 👤 Détails personnels (nom, prénom, CNI, date de naissance)
3. 📷 Photo (caméra ou upload)

**Import :**
```jsx
import VendorSignUp from './components/VendorSignUp';

// Utilisation
<VendorSignUp onSuccess={(vendor) => {
  console.log('Vendeur créé:', vendor);
}} />
```

---

#### `src/components/VendorProfile.jsx` 👤
**Profil complet du vendeur avec :**
- 🎂 Célébration d'anniversaire (ballons, confettis)
- 📊 Statistiques de présence (30 derniers jours)
- 📸 Photo professionnelle
- 📅 Historique détaillé

**Import :**
```jsx
import VendorProfile from './components/VendorProfile';

// Utilisation
<VendorProfile vendorId={vendorId} />
```

---

#### `src/components/EveningSummary.jsx` 🌅
**Synthèse du retour du soir :**
- 📋 Récapitulatif du jour
- 👤 Profil du vendeur
- ⏰ Heures d'arrivée/départ
- 💰 Total ventes du jour
- 📝 Notes et absences

**Import :**
```jsx
import EveningSummary from './components/EveningSummary';

// Utilisation
<EveningSummary 
  vendorId={vendorId} 
  date={new Date().toISOString().split('T')[0]} 
/>
```

---

#### `src/components/EnhancedMessaging.jsx` 💬
**Messagerie avec profil intégré :**
- 👤 Sidebar avec profil du vendeur
- 📅 Historique de présence (7 derniers jours)
- 📱 Conversation en temps réel
- 🔒 Sécurité (RLS Supabase)

**Import :**
```jsx
import EnhancedMessaging from './components/EnhancedMessaging';

// Utilisation
<EnhancedMessaging 
  currentUserId={currentUserId}
  vendorId={vendorId}
  onClose={() => setShowMessaging(false)}
/>
```

---

## 🔧 Intégration dans App.jsx

Voici un exemple de comment intégrer ces composants dans ta navigation principale :

```jsx
import { useState } from 'react';
import VendorSignUp from './components/VendorSignUp';
import VendorProfile from './components/VendorProfile';
import EveningSummary from './components/EveningSummary';
import EnhancedMessaging from './components/EnhancedMessaging';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showMessaging, setShowMessaging] = useState(false);

  return (
    <div>
      {/* Navigation */}
      <nav className="bg-indigo-600 text-white p-4">
        <button onClick={() => setCurrentView('dashboard')}>Dashboard</button>
        <button onClick={() => setCurrentView('signup')}>Ajouter Vendeur</button>
        <button onClick={() => setCurrentView('vendors')}>Vendeurs</button>
      </nav>

      {/* Vues */}
      {currentView === 'signup' && (
        <VendorSignUp onSuccess={() => setCurrentView('vendors')} />
      )}

      {currentView === 'profile' && selectedVendor && (
        <VendorProfile vendorId={selectedVendor} />
      )}

      {currentView === 'evening' && selectedVendor && (
        <EveningSummary 
          vendorId={selectedVendor}
          date={new Date().toISOString().split('T')[0]}
        />
      )}

      {showMessaging && selectedVendor && (
        <EnhancedMessaging 
          currentUserId={currentUserId}
          vendorId={selectedVendor}
          onClose={() => setShowMessaging(false)}
        />
      )}
    </div>
  );
}
```

---

## 🎂 Fonctionnement Anniversaire

**Automatique :**
- La table `birthdays` est créée automatiquement quand tu ajoutes un vendeur
- Chaque jour, le système détecte si c'est un anniversaire
- Sur VendorProfile.jsx, des **ballons animés** s'affichent

**Pour tester :**
```jsx
// Édite la date de naissance d'un vendeur à aujourd'hui
// Va sur VendorProfile → voir les ballons 🎈🎈🎈
```

---

## 📊 Tableau de Présence

**Données capturées :**
- `date` : date du jour
- `heure_arrivee` : heure d'arrivée (format 24h)
- `heure_depart` : heure de départ
- `statut` : present / absent_autorise / absent_non_autorise
- `notes` : observations (optionnel)
- `validated_by` : qui a validé (admin/manager)

**Exemple d'insertion :**
```jsx
const { error } = await supabase
  .from('vendor_attendance')
  .insert([
    {
      vendor_id: '123-456-789',
      date: '2024-07-22',
      heure_arrivee: '08:00',
      heure_depart: '17:00',
      statut: 'present',
      notes: 'Jour normal'
    }
  ]);
```

---

## 🌅 Afficher le Résumé du Soir

**Automatiquement à 18:00 :**
```jsx
// Dans App.jsx ou un effet useEffect
useEffect(() => {
  const checkEveningTime = setInterval(() => {
    const now = new Date();
    if (now.getHours() === 18 && now.getMinutes() === 0) {
      // Afficher EveningSummary pour chaque vendeur
      setCurrentView('evening');
    }
  }, 60000); // Vérifie chaque minute

  return () => clearInterval(checkEveningTime);
}, []);
```

---

## 💬 Ouvrir la Messagerie

**Depuis n'importe quelle page :**
```jsx
// Bouton dans une liste de vendeurs
<button onClick={() => {
  setSelectedVendor(vendorId);
  setShowMessaging(true);
}}>
  💬 Messagerie
</button>

{showMessaging && <EnhancedMessaging ... />}
```

---

## 🔐 Sécurité (RLS Supabase)

**Tous les composants utilisent Row Level Security :**

✅ Les vendeurs ne voient que leurs propres données
✅ Les admins/managers voient tout
✅ Les photos sont stockées de façon sécurisée
✅ Les messages sont chiffrés par conversation

**Aucun setup supplémentaire requis** — le schéma SQL gère tout.

---

## 📱 Stockage Photos

**Bucket Supabase :** `vendor_photos` (public en lecture)

**Upload automatique :**
```jsx
// VendorSignUp.jsx le fait déjà
const { data: { publicUrl } } = supabase.storage
  .from('vendor_photos')
  .getPublicUrl(fileName);
```

**Affichage :**
```jsx
<img src={vendor.photo_url} alt="Photo" />
```

---

## 🚀 Déploiement Vercel

**Les nouveaux fichiers sont prêts :**
```bash
git add .
git commit -m "Add vendor profiles, messaging, attendance tracking"
git push origin main
```

Vercel déploiera automatiquement. Aucune configuration supplémentaire.

---

## ✅ Checklist d'Intégration

- [ ] Exécuter `schema_v4_vendors_profile.sql` dans Supabase
- [ ] Importer les 4 nouveaux composants dans App.jsx
- [ ] Ajouter les routes de navigation
- [ ] Tester l'inscription vendeur
- [ ] Tester l'affichage du profil
- [ ] Tester la messagerie
- [ ] Tester le résumé du soir
- [ ] Vérifier les photos (téléchargement)
- [ ] Tester l'anniversaire (modifier une date à aujourd'hui)
- [ ] Déployer sur Vercel

---

## 🆘 Dépannage

### Erreur : "Table vendor_attendance n'existe pas"
→ Vérifie que tu as exécuté `schema_v4_vendors_profile.sql`

### Photos ne s'affichent pas
→ Vérifie que Supabase Storage → `vendor_photos` existe et est publique

### Messagerie vide
→ Vérifie que `dm_conversations` et `dm_messages` existent (schema_v3)

### Anniversaire ne s'affiche pas
→ Modifie la date de naissance à aujourd'hui et recharge la page

---

## 📞 Questions ?

Toutes les données sont stockées dans Supabase, documentées dans le schéma SQL. 

**Points clés :**
- Tables : `vendors`, `vendor_attendance`, `birthdays`, `dm_conversations`, `dm_messages`
- Sécurité : RLS activé sur toutes les tables
- Stockage : `vendor_photos` bucket public
- Real-time : WebSockets via Supabase pour la messagerie

**Prêt ? 🚀**

