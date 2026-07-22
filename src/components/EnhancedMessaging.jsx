import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Phone, Mail, Award, Calendar, Camera, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function EnhancedMessaging({ currentUserId, vendorId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchVendorAndMessages();
    setupRealtimeSubscription();
  }, [vendorId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchVendorAndMessages = async () => {
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

      // Récupérer les messages récents (conversation)
      const { data: dmConversations, error: convError } = await supabase
        .from('dm_conversations')
        .select('*')
        .or(`and(user_a.eq.${currentUserId},user_b.eq.${vendorId}),and(user_a.eq.${vendorId},user_b.eq.${currentUserId})`)
        .single();

      if (dmConversations) {
        const { data: msgData, error: msgError } = await supabase
          .from('dm_messages')
          .select('*')
          .eq('conversation_id', dmConversations.id)
          .order('created_at', { ascending: true })
          .limit(50);

        if (msgError) throw msgError;
        setMessages(msgData || []);
      }

      // Récupérer la présence récente (7 derniers jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('vendor_attendance')
        .select('*')
        .eq('vendor_id', vendorId)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(7);

      if (attendanceError) throw attendanceError;
      setRecentAttendance(attendanceData || []);
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('dm_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      // Créer ou obtenir la conversation
      let { data: conversation, error: convError } = await supabase
        .from('dm_conversations')
        .select('*')
        .or(`and(user_a.eq.${currentUserId},user_b.eq.${vendorId}),and(user_a.eq.${vendorId},user_b.eq.${currentUserId})`)
        .single();

      if (convError && convError.code === 'PGRST116') {
        // Créer une nouvelle conversation
        const { data: newConv, error: createError } = await supabase
          .from('dm_conversations')
          .insert([
            {
              user_a: currentUserId,
              user_b: vendorId
            }
          ])
          .select()
          .single();

        if (createError) throw createError;
        conversation = newConv;
      }

      // Envoyer le message
      const { error: msgError } = await supabase
        .from('dm_messages')
        .insert([
          {
            conversation_id: conversation.id,
            sender_id: currentUserId,
            sender_username: 'Admin', // À adapter
            content: newMessage
          }
        ]);

      if (msgError) throw msgError;
      setNewMessage('');
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setSending(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col h-screen md:h-[90vh] md:max-w-5xl w-full overflow-hidden">
        {/* En-tête avec bouton fermer */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Messagerie</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar avec profil vendeur */}
          <div className="w-full md:w-80 border-r border-gray-200 bg-gradient-to-b from-gray-50 to-white overflow-y-auto">
            {vendor && (
              <div className="p-6 space-y-6">
                {/* Photo et infos principales */}
                <div className="text-center">
                  {vendor.photo_url ? (
                    <img
                      src={vendor.photo_url}
                      alt={`${vendor.prenom} ${vendor.nom}`}
                      className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-indigo-200 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gray-300 flex items-center justify-center border-4 border-indigo-200 shadow-md">
                      <Camera className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-gray-800">
                    {vendor.prenom} {vendor.nom}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {calculateAge(vendor.date_naissance)} ans
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">📋 Détails</h4>
                  
                  {/* Numéro CNI */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-semibold">CNI</p>
                    </div>
                    <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                      {vendor.numero_cni}
                    </p>
                  </div>

                  {/* Téléphone */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-semibold">TÉLÉPHONE</p>
                    </div>
                    <p className="text-sm">
                      {vendor.telephone || 'Non renseigné'}
                    </p>
                  </div>

                  {/* Date d'enregistrement */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-semibold">DEPUIS</p>
                    </div>
                    <p className="text-sm">
                      {new Date(vendor.date_enregistrement).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  {/* Statut */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 font-semibold mb-2">STATUT</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      vendor.statut === 'actif'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {vendor.statut === 'actif' ? '🟢 Actif' : '⚪ Inactif'}
                    </span>
                  </div>
                </div>

                {/* Présence récente */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">📅 Présence (7 jours)</h4>
                  <div className="space-y-2">
                    {recentAttendance.length === 0 ? (
                      <p className="text-xs text-gray-500">Aucune donnée</p>
                    ) : (
                      recentAttendance.map((record) => (
                        <div
                          key={record.id}
                          className="p-2 rounded bg-gray-100 text-xs"
                        >
                          <p className="font-semibold text-gray-800">
                            {new Date(record.date).toLocaleDateString('fr-FR')}
                          </p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${
                            record.statut === 'present'
                              ? 'bg-green-100 text-green-800'
                              : record.statut === 'absent_autorise'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.statut === 'present' ? '✓ Présent' :
                             record.statut === 'absent_autorise' ? '⊙ Absent autorisé' :
                             '✕ Absent'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Zone de messages */}
          <div className="flex-1 flex flex-col md:flex-[2]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50 to-white">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun message pour le moment</p>
                  <p className="text-sm text-gray-400 mt-1">Commencez une conversation</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        msg.sender_id === currentUserId
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <p className={msg.sender_id === currentUserId ? 'text-sm opacity-75' : 'text-xs text-gray-600'}>
                        {msg.sender_username}
                      </p>
                      <p className="mt-1">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.sender_id === currentUserId ? 'text-indigo-200' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <div className="border-t border-gray-200 bg-white p-4">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Votre message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Envoyer</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
