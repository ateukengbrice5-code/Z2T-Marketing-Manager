import React, { useState, useEffect } from 'react';
import { Camera, Calendar, Users, Clock, Cake, MapPin, Phone, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function VendorProfile({ vendorId }) {
  const [vendor, setVendor] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBirthday, setIsBirthday] = useState(false);
  const [balloons, setBalloons] = useState([]);

  useEffect(() => {
    fetchVendorData();
  }, [vendorId]);

  useEffect(() => {
    if (isBirthday) {
      createBalloons();
    }
  }, [isBirthday]);

  const fetchVendorData = async () => {
    try {
      // Récupérer les infos vendeur
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (vendorError) throw vendorError;
      setVendor(vendorData);

      // Vérifier si c'est son anniversaire
      if (vendorData.date_naissance) {
        const today = new Date();
        const birth = new Date(vendorData.date_naissance);
        const isBday = 
          today.getMonth() === birth.getMonth() && 
          today.getDate() === birth.getDate();
        setIsBirthday(isBday);
      }

      // Récupérer l'historique de présence (30 derniers jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('vendor_attendance')
        .select('*')
        .eq('vendor_id', vendorId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;
      setAttendance(attendanceData || []);
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const createBalloons = () => {
    const newBalloons = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 3 + Math.random() * 2
    }));
    setBalloons(newBalloons);
  };

  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getAttendanceStats = () => {
    const present = attendance.filter(a => a.statut === 'present').length;
    const absenceAutorisee = attendance.filter(a => a.statut === 'absent_autorise').length;
    const absenceNonAutorisee = attendance.filter(a => a.statut === 'absent_non_autorise').length;
    return { present, absenceAutorisee, absenceNonAutorisee };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Vendeur introuvable</p>
      </div>
    );
  }

  const stats = getAttendanceStats();
  const age = calculateAge(vendor.date_naissance);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {/* Ballons d'anniversaire */}
      {isBirthday && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {balloons.map(balloon => (
            <div
              key={balloon.id}
              className="absolute w-8 h-10 rounded-full animate-bounce"
              style={{
                left: `${balloon.left}%`,
                backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][Math.floor(Math.random() * 5)],
                top: '100%',
                animation: `float ${balloon.duration}s ease-in infinite`,
                animationDelay: `${balloon.delay}s`
              }}
            >
              <div className="absolute w-0.5 h-16 bg-gray-300" style={{ bottom: '-4rem', left: '50%', transform: 'translateX(-50%)' }} />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* En-tête avec photo */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-32"></div>
          
          <div className="relative px-8 pb-8">
            {/* Photo du profil */}
            <div className="flex flex-col sm:flex-row gap-6 -mt-20 items-start">
              <div className="relative">
                {vendor.photo_url ? (
                  <img
                    src={vendor.photo_url}
                    alt={`${vendor.prenom} ${vendor.nom}`}
                    className="w-40 h-40 rounded-2xl object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-2xl bg-gray-300 border-4 border-white shadow-lg flex items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-600" />
                  </div>
                )}
                {isBirthday && (
                  <div className="absolute -top-4 -right-4 bg-yellow-400 rounded-full p-2 animate-pulse">
                    <Cake className="w-8 h-8 text-orange-600" />
                  </div>
                )}
              </div>

              {/* Infos personnelles */}
              <div className="flex-1 mt-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  {vendor.prenom} {vendor.nom}
                  {isBirthday && <span className="ml-3 text-3xl">🎉</span>}
                </h1>
                <p className="text-indigo-600 font-semibold text-lg mb-4">
                  {isBirthday ? `Joyeux anniversaire ! ${age} ans aujourd'hui 🎂` : `${age} ans`}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-3">
                  <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                    {vendor.statut === 'actif' ? 'Actif' : 'Inactif'}
                  </div>
                  <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                    Vendeur depuis {new Date(vendor.date_enregistrement).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            </div>

            {/* Détails de contact */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10 pt-8 border-t border-gray-200">
              <div>
                <p className="text-gray-600 text-sm flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4" />
                  Téléphone
                </p>
                <p className="text-gray-800 font-semibold">{vendor.telephone || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4" />
                  Numéro CNI
                </p>
                <p className="text-gray-800 font-semibold">{vendor.numero_cni}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" />
                  Date de naissance
                </p>
                <p className="text-gray-800 font-semibold">{new Date(vendor.date_naissance).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques de présence */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-gray-700 font-semibold">Présences</h3>
            </div>
            <p className="text-4xl font-bold text-green-600">{stats.present}</p>
            <p className="text-sm text-gray-500 mt-2">derniers 30 jours</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-gray-700 font-semibold">Absences autorisées</h3>
            </div>
            <p className="text-4xl font-bold text-yellow-600">{stats.absenceAutorisee}</p>
            <p className="text-sm text-gray-500 mt-2">derniers 30 jours</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <MapPin className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-gray-700 font-semibold">Absences non autorisées</h3>
            </div>
            <p className="text-4xl font-bold text-red-600">{stats.absenceNonAutorisee}</p>
            <p className="text-sm text-gray-500 mt-2">derniers 30 jours</p>
          </div>
        </div>

        {/* Historique de présence */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
            <h2 className="text-2xl font-bold text-white">Historique de présence</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Heure d'arrivée</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Heure de départ</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      Aucun historique de présence
                    </td>
                  </tr>
                ) : (
                  attendance.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {new Date(record.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          record.statut === 'present' ? 'bg-green-100 text-green-800' :
                          record.statut === 'absent_autorise' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.statut === 'present' ? 'Présent' :
                           record.statut === 'absent_autorise' ? 'Absent autorisé' :
                           'Absent non autorisé'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {record.heure_arrivee ? new Date(`2000-01-01T${record.heure_arrivee}`).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {record.heure_depart ? new Date(`2000-01-01T${record.heure_depart}`).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(100px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
