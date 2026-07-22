// Gestion du mode hors-ligne : file d'attente d'actions à synchroniser dès
// le retour du réseau, et cache local des dernières données connues (pour
// que l'appli reste utilisable, même en lecture, sans connexion).

const QUEUE_KEY = "z2t_offline_queue";
const CACHE_PREFIX = "z2t_cache_";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// -----------------------------------------------------------------------------
// Connectivité
// -----------------------------------------------------------------------------

export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function onConnectivityChange(cb) {
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
  };
}

// -----------------------------------------------------------------------------
// File d'attente des actions à rejouer une fois reconnecté
// -----------------------------------------------------------------------------

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (e) {
    console.error("Erreur d'écriture de la file hors-ligne", e);
  }
}

// action = { type, payload, description }
export function enqueue(action) {
  const q = getQueue();
  q.push({ id: uid(), createdAt: Date.now(), ...action });
  saveQueue(q);
  return q;
}

export function dequeue(id) {
  saveQueue(getQueue().filter((a) => a.id !== id));
}

export function queueLength() {
  return getQueue().length;
}

export function clearQueue() {
  saveQueue([]);
}

// -----------------------------------------------------------------------------
// Cache local (dernières données connues, pour un affichage hors-ligne)
// -----------------------------------------------------------------------------

export function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, at: Date.now() }));
  } catch (e) {
    // Le cache est un confort, pas une obligation — on ignore les erreurs de quota
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch {
    return null;
  }
}

export function cacheAge(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return Date.now() - JSON.parse(raw).at;
  } catch {
    return null;
  }
}
