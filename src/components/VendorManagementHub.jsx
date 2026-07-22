import React, { useState, useEffect } from 'react';
import { Users, Plus, MessageSquare, Clock, Cake, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VendorSignUp from './VendorSignUp';
import VendorProfile from './VendorProfile';
import EveningSummary from './EveningSummary';
import EnhancedMessaging from './EnhancedMessaging';

/**
 * =============================================================================
 * EXEMPLE D'INTÉGRATION COMPLÈTE
 * =============================================================================
 * 
 * Ce fichier montre comment intégrer tous les nouveaux composants
 * dans une application réelle.
 * 
 * À adapter selon votre structure actuelle.
 */

export default function VendorManagementHub() {
  // État global
  const [currentView, setCurrentView] = useState('list'); // list, signup, profile, evening, messaging
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [todayBirthdays, setTodayBirthdays] = useState([]);

  // Initialisation
  useEffect(() => {
    fetchCurrentUser();
    fetchVendors();
    checkBirthdays();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('statut', 'actif')
        .order('nom', { ascending: true });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkBirthdays = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors_with_birthday_today')
        .select('*');

      if (error) throw error;
      setTodayBirthdays(data || []);
    } catch (error) {
      console.error('Erreur:', error.message);
    }
  };

  const handleVendorCreated = (newVendor) => {
    setVendors([...vendors, newVendor]);
    setCurrentView('list');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // ===========================
  // VUE 1 : Liste des vendeurs
  // ===========================
  if (currentView === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* En-tête */}
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800">📊 Gestion Vendeurs</h1>
                <p className="text-gray-600 mt-1">Z2T Marketing Manager</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  👤 {currentUser?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Alertes anniversaires */}
          {todayBirthdays.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8 rounded">
              <div className="flex items-start gap-4">
                <Cake className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-yellow-800 mb-2">🎂 Anniversaires aujourd'hui !</h3>
                  <div className="space-y-1">
                    {todayBirthdays.map(v => (
                      <p key={v.id} className="text-yellow-700">
                        ✨ <strong>{v.prenom} {v.nom}</strong> fête ses {v.age} ans !
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setCurrentView('signup')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              <Plus className="w-5 h-5" />
              Ajouter un vendeur
            </button>
            <button
              onClick={() => {
                setCurrentView('evening');
                setSelectedVendor(vendors[0]?.id);
              }}
              className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition font-semibold"
            >
              <Clock className="w-5 h-5" />
              Résumé du soir
            </button>
          </div>

          {/* Tableau des vendeurs */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6" />
                Vendeurs actifs ({vendors.length})
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : vendors.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p>Aucun vendeur pour le moment</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700">Photo</th>
                      <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700">Nom</th>
                      <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                      <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700">CNI</th>
                      <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700">Date d'enregistrement</th>
                      <th className="px-8 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendors.map(vendor => (
                      <tr key={vendor.id} className="hover:bg-gray-50 transition">
                        <td className="px-8 py-4">
                          {vendor.photo_url ? (
                            <img
                              src={vendor.photo_url}
                              alt={vendor.nom}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300"></div>
                          )}
                        </td>
                        <td className="px-8 py-4 font-semibold text-gray-800">
                          {vendor.prenom} {vendor.nom}
                        </td>
                        <td className="px-8 py-4 text-gray-600">
                          {vendor.telephone || '-'}
                        </td>
                        <td className="px-8 py-4 text-gray-600 font-mono">
                          {vendor.numero_cni}
                        </td>
                        <td className="px-8 py-4 text-gray-600 text-sm">
                          {new Date(vendor.date_enregistrement).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedVendor(vendor.id);
                                setCurrentView('profile');
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm"
                            >
                              👤 Profil
                            </button>
                            <button
                              onClick={() => {
                                setSelectedVendor(vendor.id);
                                setShowMessaging(true);
                              }}
                              className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Chat
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Messagerie modale */}
          {showMessaging && selectedVendor && (
            <EnhancedMessaging
              currentUserId={currentUser?.id}
              vendorId={selectedVendor}
              onClose={() => setShowMessaging(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // ===========================
  // VUE 2 : Inscription
  // ===========================
  if (currentView === 'signup') {
    return (
      <div>
        <button
          onClick={() => setCurrentView('list')}
          className="absolute top-6 left-6 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          ← Retour
        </button>
        <VendorSignUp onSuccess={handleVendorCreated} />
      </div>
    );
  }

  // ===========================
  // VUE 3 : Profil
  // ===========================
  if (currentView === 'profile' && selectedVendor) {
    return (
      <div>
        <button
          onClick={() => setCurrentView('list')}
          className="absolute top-6 left-6 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 z-10"
        >
          ← Retour
        </button>
        <VendorProfile vendorId={selectedVendor} />
      </div>
    );
  }

  // ===========================
  // VUE 4 : Résumé du soir
  // ===========================
  if (currentView === 'evening' && selectedVendor) {
    return (
      <div>
        <button
          onClick={() => setCurrentView('list')}
          className="absolute top-6 left-6 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 z-10"
        >
          ← Retour
        </button>
        <EveningSummary
          vendorId={selectedVendor}
          date={new Date().toISOString().split('T')[0]}
        />
      </div>
    );
  }

  return null;
}
