import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function VendorSignUp({ onSuccess }) {
  const [step, setStep] = useState(1); // 1: phone, 2: details, 3: photo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    numero_cni: '',
    date_naissance: '',
    telephone: ''
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Étape 1 : Vérification du numéro de téléphone
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Veuillez entrer un numéro de téléphone');
      return;
    }
    setFormData(prev => ({ ...prev, telephone: phone }));
    setStep(2);
    setError('');
  };

  // Étape 2 : Remplissage des détails
  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    if (!formData.nom.trim() || !formData.prenom.trim() || !formData.numero_cni.trim() || !formData.date_naissance) {
      setError('Tous les champs sont obligatoires');
      return;
    }
    setStep(3);
    setError('');
  };

  // Étape 3 : Capture photo
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError('Impossible d\'accéder à la caméra. Utilisez le bouton "Télécharger une photo".');
    }
  };

  const capturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 400, 400);
      canvasRef.current.toBlob((blob) => {
        setPhoto(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      stopCamera();
    }
  };

  // Étape finale : Créer le compte vendeur
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Créer le profil vendeur
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .insert([
          {
            nom: formData.nom,
            prenom: formData.prenom,
            numero_cni: formData.numero_cni,
            date_naissance: formData.date_naissance,
            telephone: formData.telephone,
            date_enregistrement: new Date().toISOString().split('T')[0],
            statut: 'actif'
          }
        ])
        .select()
        .single();

      if (vendorError) throw vendorError;

      // 2. Upload la photo si disponible
      if (photo && vendor) {
        const fileName = `${vendor.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('vendor_photos')
          .upload(fileName, photo, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        // 3. Mettre à jour l'URL de la photo
        const { data: { publicUrl } } = supabase.storage
          .from('vendor_photos')
          .getPublicUrl(fileName);

        await supabase
          .from('vendors')
          .update({ photo_url: publicUrl })
          .eq('id', vendor.id);
      }

      // 4. Créer un compte utilisateur avec OTP
      const { error: authError } = await supabase.auth.signUp({
        email: `${formData.numero_cni}@vendor.local`,
        password: Math.random().toString(36).slice(-12),
        options: {
          data: {
            role: 'vendor',
            vendor_id: vendor.id,
            username: `${formData.prenom.toLowerCase()}_${formData.nom.toLowerCase()}`
          }
        }
      });

      if (authError) throw authError;

      // Succès !
      onSuccess && onSuccess(vendor);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Titre */}
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Z2T Marketing
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Créer un compte vendeur
        </p>

        {/* Barre de progression */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Étape 1 : Téléphone */}
        {step === 1 && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📱 Numéro de téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+243 123 456 789"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Continuer
            </button>
          </form>
        )}

        {/* Étape 2 : Détails personnels */}
        {step === 2 && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Prénom
              </label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleDetailsChange}
                placeholder="Jean"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Nom
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleDetailsChange}
                placeholder="Dupont"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🆔 Numéro CNI
              </label>
              <input
                type="text"
                name="numero_cni"
                value={formData.numero_cni}
                onChange={handleDetailsChange}
                placeholder="AB123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎂 Date de naissance
              </label>
              <input
                type="date"
                name="date_naissance"
                value={formData.date_naissance}
                onChange={handleDetailsChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                Continuer
              </button>
            </div>
          </form>
        )}

        {/* Étape 3 : Photo */}
        {step === 3 && (
          <div className="space-y-4">
            {!photoPreview ? (
              <>
                {!cameraActive ? (
                  <>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Prendre une photo
                    </button>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="block w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition text-center cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Upload className="w-5 h-5" />
                        Télécharger une photo
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      className="w-full h-80 bg-black rounded-lg object-cover"
                    />
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={400}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      ✓ Capturer
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="w-full bg-gray-400 text-white py-3 rounded-lg font-semibold hover:bg-gray-500 transition"
                    >
                      ✕ Annuler
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <img
                  src={photoPreview}
                  alt="Aperçu"
                  className="w-full h-80 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview('');
                  }}
                  className="w-full bg-gray-400 text-white py-3 rounded-lg font-semibold hover:bg-gray-500 transition"
                >
                  Changer la photo
                </button>
              </>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading || !photoPreview}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Création...' : '✓ Créer compte'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
