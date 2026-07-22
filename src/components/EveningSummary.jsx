import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, Camera, TrendingUp, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function EveningSummary({ vendorId, date }) {
  const [vendor, setVendor] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchEveningSummary();
  }, [vendorId, date]);

  const fetchEveningSummary = async () => {
    try {
      setLoading(true);

      // Récupérer les infos du vendeur
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (vendorError) throw vendorError;
      setVendor(vendorData);

      // Récupérer la présence du jour
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('vendor_attendance')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('date', date)
        .single();

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }
      setAttendance(attendanceData || null);

      // Récupérer les données du jour (ventes, etc.)
      const { data: dayData, error: dayError } = await supabase
        .from('days')
        .select('*')
        .eq('date', date)
        .single();

      if (dayError && dayError.code !== 'PGRST116') {
        throw dayError;
      }

      if (dayData && dayData.data) {
        setDailyData(dayData.data);
        calculateStats(dayData.data, vendorId);
      }
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data, vId) => {
    if (!data.lines) return;

    const vendorLines = data.lines.filter(line => line.vendor_id === vId);
    const totalSales = vendorLines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const vendorCount = vendorLines.length;

    setStats({
      totalSales,
      vendorCount,
      averagePerSale: vendorCount > 0 ? (totalSales / vendorCount).toFixed(2) : 0
    });
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
        <p className="text-gray-500">Données introuvables</p>
      </div>
    );
  }

  const displayDate = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const getStatusColor = (status) => {
    if (!status) return 'gray';
    if (status === 'present') return 'green';
    if (status === 'absent_autorise') return 'yellow';
    return 'red';
  };

  const getStatusLabel = (status) => {
    if (!status) return 'Pas de données';
    if (status === 'present') return 'Présent';
    if (status === 'absent_autorise') return 'Absent autorisé';
    return 'Absent';
  };

  const statusColor = getStatusColor(attendance?.statut);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Résumé du soir</h1>
          <p className="text-lg text-gray-600">{displayDate}</p>
        </div>

        {/* Carte profil du vendeur */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-24"></div>
          
          <div className="px-8 pb-8 -mt-12">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Photo */}
              <div className="relative">
                {vendor.photo_url ? (
                  <img
                    src={vendor.photo_url}
                    alt={`${vendor.prenom} ${vendor.nom}`}
                    className="w-32 h-32 rounded-xl object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-gray-300 border-4 border-white shadow-lg flex items-center justify-center">
                    <Camera className="w-10 h-10 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Infos */}
              <div className="flex-1 mt-4">
                <h2 className="text-3xl font-bold text-gray-800">
                  {vendor.prenom} {vendor.nom}
                </h2>
                <p className="text-gray-600 mb-4">
                  CNI: <span className="font-semibold">{vendor.numero_cni}</span>
                </p>
                <p className="text-gray-600 mb-4">
                  Téléphone: <span className="font-semibold">{vendor.telephone || 'Non renseigné'}</span>
                </p>

                {/* Statut du jour */}
                <div className={`inline-block px-4 py-2 rounded-lg font-semibold text-white bg-${statusColor}-600`}>
                  {getStatusLabel(attendance?.statut)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grille de résumé */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Présence */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700 font-semibold">Présence</h3>
              {attendance?.statut === 'present' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : attendance?.statut === 'absent_autorise' ? (
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {getStatusLabel(attendance?.statut)}
            </p>
          </div>

          {/* Heure d'arrivée */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-gray-700 font-semibold">Arrivée</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {attendance?.heure_arrivee 
                ? new Date(`2000-01-01T${attendance.heure_arrivee}`).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : '-'
              }
            </p>
          </div>

          {/* Heure de départ */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-purple-600" />
              <h3 className="text-gray-700 font-semibold">Départ</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {attendance?.heure_depart
                ? new Date(`2000-01-01T${attendance.heure_depart}`).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : '-'
              }
            </p>
          </div>

          {/* Durée de travail */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              <h3 className="text-gray-700 font-semibold">Durée</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {attendance?.heure_arrivee && attendance?.heure_depart
                ? (() => {
                    const arrival = new Date(`2000-01-01T${attendance.heure_arrivee}`);
                    const departure = new Date(`2000-01-01T${attendance.heure_depart}`);
                    const diff = Math.round((departure - arrival) / (1000 * 60));
                    const hours = Math.floor(diff / 60);
                    const mins = diff % 60;
                    return `${hours}h${mins}m`;
                  })()
                : '-'
              }
            </p>
          </div>
        </div>

        {/* Statistiques de ventes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-green-600" />
              <h3 className="text-gray-700 font-semibold">Total ventes</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">
              ${stats.totalSales?.toFixed(2) || '0.00'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h3 className="text-gray-700 font-semibold">Nombre de ventes</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {stats.vendorCount || '0'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-purple-600" />
              <h3 className="text-gray-700 font-semibold">Moyenne par vente</h3>
            </div>
            <p className="text-3xl font-bold text-purple-600">
              ${stats.averagePerSale || '0.00'}
            </p>
          </div>
        </div>

        {/* Notes du jour */}
        {attendance?.notes && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Notes du jour</h3>
            <p className="text-gray-700 bg-blue-50 p-4 rounded-lg">
              {attendance.notes}
            </p>
          </div>
        )}

        {/* Informations supplémentaires */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mt-6">
          <h3 className="font-semibold text-indigo-900 mb-3">ℹ️ Informations</h3>
          <ul className="text-sm text-indigo-800 space-y-2">
            <li>✓ Cette fiche a été créée automatiquement lors du retour du soir</li>
            <li>✓ Les données de présence sont synchronisées en temps réel</li>
            <li>✓ Vous pouvez contacter ce vendeur via la messagerie intégrée</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
