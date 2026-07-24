import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Package, Boxes, Users, Truck, MoonStar, Wallet, History,
  Plus, Trash2, CheckCircle2, AlertTriangle, ChevronRight, ChevronDown,
  Store, LogOut, Smartphone, Trophy, TrendingUp, ArrowDownToLine, RotateCcw, Eye,
  MessageSquare, Send, X, Link2, Cake, Camera, FileText, Printer, Bell, PartyPopper,
  Menu as MenuIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from "recharts";
import * as store from "./lib/store.js";
import * as offline from "./lib/offline.js";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const NAV_ADMIN = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "produits", label: "Produits", icon: Package },
  { id: "stock", label: "Stock", icon: Boxes },
  { id: "vendeurs", label: "Vendeurs & comptes", icon: Users },
  { id: "distribution", label: "Distribution", icon: Truck },
  { id: "retour", label: "Retour du soir", icon: MoonStar },
  { id: "caisse", label: "Caisse", icon: Wallet },
  { id: "messagerie", label: "Messagerie", icon: MessageSquare },
  { id: "rapports", label: "Rapports", icon: FileText },
  { id: "historique", label: "Historique", icon: History },
];

const NAV_VENDOR = [
  { id: "dashboard", label: "Mon tableau de bord", icon: LayoutDashboard },
  { id: "retour", label: "Mon retour du soir", icon: MoonStar },
  { id: "messagerie", label: "Messages", icon: MessageSquare },
];

const NAV_MANAGER = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "caisse", label: "Finances", icon: Wallet },
  { id: "stock", label: "Stock", icon: Boxes },
  { id: "vendeurs", label: "Personnel", icon: Users },
  { id: "messagerie", label: "Messagerie", icon: MessageSquare },
  { id: "rapports", label: "Rapports", icon: FileText },
];

const NAV_MESSENGER = [
  { id: "messagerie", label: "Messagerie", icon: MessageSquare },
];

// ---------------------------------------------------------------------------
// Helpers de date / argent / identifiants
// ---------------------------------------------------------------------------

function isoFromDate(d) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function todayISO() {
  return isoFromDate(new Date());
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}

function getMonday(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return isoFromDate(d);
}

function getPreviousDayRange(iso) {
  const y = addDays(iso, -1);
  return [y, y];
}

function getPreviousWeekRange(iso) {
  const thisMonday = getMonday(iso);
  const prevMonday = addDays(thisMonday, -7);
  const prevSunday = addDays(thisMonday, -1);
  return [prevMonday, prevSunday];
}

function getPreviousMonthRange(iso) {
  const d = new Date(iso + "T00:00:00");
  const firstOfThisMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 86400000);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
  return [isoFromDate(firstOfPrevMonth), isoFromDate(lastOfPrevMonth)];
}

function getPreviousYearRange(iso) {
  const y = parseInt(iso.slice(0, 4), 10) - 1;
  return [`${y}-01-01`, `${y}-12-31`];
}

function getCurrentWeekRange(iso) {
  return [getMonday(iso), iso];
}

function getCurrentMonthRange(iso) {
  const d = new Date(iso + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return [isoFromDate(first), iso];
}

function inRange(dateIso, range) {
  return dateIso >= range[0] && dateIso <= range[1];
}

// Somme, pour UN vendeur, le chiffre d'affaires / vendu / distribué sur une période
function sumVendorOverRange(days, vendorId, range) {
  let ca = 0, vendu = 0, distribue = 0;
  days.forEach((day) => {
    if (!day || !inRange(day.date, range)) return;
    day.lines.forEach((l) => {
      if (l.vendorId !== vendorId) return;
      distribue += l.quantiteRemise || 0;
      if (l.quantiteVendue != null) {
        vendu += l.quantiteVendue;
        ca += l.montantAttendu || 0;
      }
    });
  });
  return { ca, vendu, distribue };
}

// Historique jour par jour (pour un graphique) sur les N derniers jours pour un vendeur
function buildVendorDailySeries(days, vendorId, today, numDays) {
  const byDate = {};
  days.forEach((d) => { if (d) byDate[d.date] = d; });
  const series = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const d = byDate[date];
    let ca = 0, vendu = 0, distribue = 0;
    if (d) {
      d.lines.forEach((l) => {
        if (l.vendorId !== vendorId) return;
        distribue += l.quantiteRemise || 0;
        if (l.quantiteVendue != null) { vendu += l.quantiteVendue; ca += l.montantAttendu || 0; }
      });
    }
    series.push({ date, label: date.slice(8, 10) + "/" + date.slice(5, 7), ca, vendu, distribue });
  }
  return series;
}

function sumExpensesOverRange(days, range) {
  let total = 0;
  days.forEach((d) => {
    if (!d || !inRange(d.date, range)) return;
    total += (d.expenses || []).reduce((s, e) => s + (Number(e.montant) || 0), 0);
  });
  return total;
}
function computeVendorBonusTotal(days, vendorId) {
  let total = 0;
  days.forEach((day) => {
    if (!day) return;
    const summary = computeVersementSummary(day, vendorId);
    if (summary.finalise && summary.statut === "exces") total += summary.ecart;
  });
  return total;
}

function formatDateFR(iso) {
  const [y, m, d] = iso.split("-");
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " F";
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function emptyDay(date) {
  return { date, lines: [], versements: {}, expenses: [] };
}

// ---------------------------------------------------------------------------
// Petits composants d'interface réutilisables
// ---------------------------------------------------------------------------

function Badge({ ok, okText = "Équilibré", warnText = "Écart" }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
        borderRadius: 999, fontSize: 12, fontWeight: 600,
        background: ok ? "#EAF4EE" : "#FBECEA", color: ok ? "#3F8361" : "#C1554A",
        border: `1px solid ${ok ? "#CDE7D6" : "#F0CFC9"}`,
      }}
    >
      {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
      {ok ? okText : warnText}
    </span>
  );
}

function lastSeenLabel(iso) {
  if (!iso) return "jamais connecté";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 2) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return `il y a ${Math.round(diffH / 24)} j`;
}

function PresenceDot({ isOnline, lastSeenAt, showLabel }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        title={isOnline ? "En ligne" : `Hors ligne — ${lastSeenLabel(lastSeenAt)}`}
        style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: isOnline ? "#3F8361" : "#C7CCD6",
          boxShadow: isOnline ? "0 0 0 3px rgba(63,131,97,0.15)" : "none",
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 11, color: isOnline ? "#3F8361" : "#9AA2B1" }}>
          {isOnline ? "En ligne" : lastSeenLabel(lastSeenAt)}
        </span>
      )}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={{ background: "#fff", border: "1px solid #E7E9EE", borderRadius: 14, padding: "18px 20px", flex: "1 1 200px", minWidth: 190 }}>
      <div style={{ fontSize: 12.5, color: "#5B6472", fontWeight: 600, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 28, fontWeight: 700, color: accent || "#1B2A4A", marginTop: 6, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#8A93A3", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="card" style={{ background: "#fff", border: "1px solid #E7E9EE", borderRadius: 14, padding: 22, marginBottom: 20 }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "Cambria, Georgia, serif", fontSize: 17, color: "#1B2A4A", fontWeight: 700 }}>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D8DCE3",
        fontSize: 14, fontFamily: "Calibri, Arial, sans-serif", color: "#1B2A4A",
        outline: "none", boxSizing: "border-box", ...props.style,
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D8DCE3",
        fontSize: 14, fontFamily: "Calibri, Arial, sans-serif", color: "#1B2A4A",
        outline: "none", background: "#fff", boxSizing: "border-box", ...props.style,
      }}
    >
      {props.children}
    </select>
  );
}

function Button({ children, variant = "primary", ...rest }) {
  const styles = {
    primary: { background: "#1B2A4A", color: "#fff", border: "1px solid #1B2A4A" },
    gold: { background: "#D9A441", color: "#1B2A4A", border: "1px solid #D9A441" },
    ghost: { background: "#fff", color: "#C1554A", border: "1px solid #F0CFC9" },
  };
  return (
    <button
      {...rest}
      style={{
        padding: "9px 16px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6, ...styles[variant], ...rest.style,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: "24px 10px", textAlign: "center", color: "#9AA2B1", fontSize: 13.5, fontStyle: "italic" }}>{text}</div>;
}

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: "left", padding: "8px 10px", color: "#8A93A3", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", borderBottom: "2px solid #EEF0F4" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 10px", borderBottom: "1px solid #F3F4F7", color: "#1B2A4A" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "#5B6472", marginBottom: 5 }}>{children}</div>;
}

function Toggle({ on, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!on)}>
      <div style={{ width: 40, height: 22, borderRadius: 999, background: on ? "#D9A441" : "#D8DCE3", position: "relative", transition: "background 0.15s" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: on ? 20 : 2, transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
      </div>
      {label && <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1B2A4A" }}>{label}</span>}
    </div>
  );
}

const iconBtnStyle = { background: "none", border: "none", color: "#C1554A", cursor: "pointer", padding: 4, display: "flex" };

function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="z2tGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8B95A" />
          <stop offset="100%" stopColor="#C98F2C" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#z2tGrad)" />
      <path d="M8 10h13l-9.5 12H21" stroke="#152039" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="9" r="2.6" fill="#152039" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Écrans d'authentification
// ---------------------------------------------------------------------------

function AuthIllustration() {
  return (
    <svg viewBox="0 0 520 640" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <defs>
        <linearGradient id="authBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#152039" />
          <stop offset="100%" stopColor="#1B2A4A" />
        </linearGradient>
        <linearGradient id="authGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0C878" />
          <stop offset="100%" stopColor="#D9A441" />
        </linearGradient>
      </defs>

      <rect width="520" height="640" fill="url(#authBg)" />

      {/* Grand monogramme Z */}
      <g opacity="0.95">
        <path d="M 150 190 L 350 190 L 190 400 L 370 400" fill="none" stroke="url(#authGold)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Pièces de monnaie flottantes (flux d'argent) */}
      <g fontFamily="Georgia, serif" fontWeight="700">
        <circle cx="110" cy="150" r="22" fill="url(#authGold)" />
        <text x="110" y="158" textAnchor="middle" fontSize="20" fill="#152039">€</text>

        <circle cx="410" cy="470" r="24" fill="url(#authGold)" />
        <text x="410" y="479" textAnchor="middle" fontSize="22" fill="#152039">$</text>

        <circle cx="90" cy="470" r="16" fill="#2A3B5C" stroke="#D9A441" strokeWidth="2" />
        <text x="90" y="476" textAnchor="middle" fontSize="14" fill="#D9A441">$</text>

        <circle cx="430" cy="170" r="15" fill="#2A3B5C" stroke="#D9A441" strokeWidth="2" />
        <text x="430" y="176" textAnchor="middle" fontSize="13" fill="#D9A441">€</text>
      </g>

      {/* Flèches de flux */}
      <g stroke="#D9A441" strokeWidth="3" fill="none" opacity="0.8">
        <path d="M 60 150 L 90 150" markerEnd="url(#arrow)" />
        <path d="M 380 470 L 405 470" markerEnd="url(#arrow)" />
      </g>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#D9A441" />
        </marker>
      </defs>

      <g fontFamily="Calibri, Arial, sans-serif" fontSize="12" fill="#8B95AC">
        <text x="60" y="140">125,00 € reçu</text>
        <text x="345" y="500">75 000 F envoyé</text>
      </g>

      {/* Tapis roulant / boîtes (logistique) */}
      <g transform="translate(60, 540)">
        <rect x="0" y="18" width="400" height="4" rx="2" fill="#2A3B5C" />
        {[0, 55, 110, 165, 220, 275, 330].map((x, i) => (
          <rect key={i} x={x} y={i % 2 === 0 ? -14 : -10} width={i % 2 === 0 ? 34 : 26} height={i % 2 === 0 ? 34 : 26} rx="3"
            fill={i % 3 === 0 ? "#D9A441" : "#2A3B5C"} stroke="#8B95AC" strokeWidth="1" />
        ))}
        {[10, 20, 30, 40].map((cx, i) => (
          <circle key={i} cx={cx * 12} cy="24" r="5" fill="#152039" stroke="#D9A441" strokeWidth="1.5" />
        ))}
      </g>

      <g fontFamily="Cambria, Georgia, serif" fontSize="15" fill="#C7CCDA" opacity="0.85">
        <text x="60" y="600">Ventes, stock et caisse — un seul endroit</text>
      </g>
    </svg>
  );
}

function AuthShell({ children }) {
  return (
    <div className="auth-shell" style={{ minHeight: 640, display: "flex", background: "#F7F8FA", borderRadius: 16, border: "1px solid #E7E9EE", overflow: "hidden" }}>
      <div className="auth-illustration" style={{ flex: "1 1 0", minWidth: 0, background: "#152039" }}>
        <AuthIllustration />
      </div>
      <div className="auth-card-wrap" style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="auth-card" style={{ background: "#fff", border: "1px solid #E7E9EE", borderRadius: 14, padding: "36px 40px", width: 360, maxWidth: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Logo size={38} />
            <div style={{ fontFamily: "Cambria, Georgia, serif", fontWeight: 700, fontSize: 15, color: "#1B2A4A", lineHeight: 1.15 }}>
              Z2T<br /><span style={{ fontSize: 11, fontWeight: 600, color: "#8A93A3", fontFamily: "Calibri, sans-serif" }}>Marketing Manager</span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function SetupScreen({ onCreated }) {
  const [username, setUsername] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !pass1) {
      setError("Indique un nom d'utilisateur et un mot de passe.");
      return;
    }
    if (pass1 !== pass2) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (pass1.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await store.createFirstAdmin(username.trim(), pass1);
      await onCreated();
    } catch (e) {
      setError(e.message || "Erreur lors de la création du compte.");
    }
    setBusy(false);
  };

  return (
    <AuthShell>
      <h2 style={{ margin: 0, fontFamily: "Cambria, Georgia, serif", color: "#1B2A4A", fontSize: 22 }}>Bienvenue</h2>
      <p style={{ color: "#5B6472", fontSize: 13.5, marginTop: 6, marginBottom: 20 }}>Crée le compte administrateur principal pour commencer.</p>
      <div style={{ marginBottom: 12 }}>
        <Label>Nom d'utilisateur</Label>
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex. admin" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Mot de passe</Label>
        <TextInput type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Label>Confirmer le mot de passe</Label>
        <TextInput type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
      </div>
      {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
      <Button variant="primary" onClick={submit} disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Création…" : "Créer le compte"}
      </Button>
    </AuthShell>
  );
}

function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const profile = await store.signIn(username.trim(), password);
      if (!profile) {
        setError("Ce compte n'a pas de profil valide. Contacte l'administrateur.");
        setBusy(false);
        return;
      }
      await onLoggedIn(profile);
    } catch (e) {
      setError(e.message || "Identifiant ou mot de passe incorrect.");
    }
    setBusy(false);
  };

  const onKeyDown = (e) => { if (e.key === "Enter") submit(); };

  return (
    <AuthShell>
      <p style={{ color: "#5B6472", fontSize: 13.5, marginTop: 0, marginBottom: 20 }}>Connecte-toi pour continuer.</p>
      <div style={{ marginBottom: 12 }}>
        <Label>Nom d'utilisateur</Label>
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKeyDown} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <Label>Mot de passe</Label>
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown} />
      </div>
      {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
      <Button variant="primary" onClick={submit} disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
        {busy ? "Connexion…" : "Se connecter"}
      </Button>
    </AuthShell>
  );
}

// Écran public (pas de session requise) permettant à un vendeur de créer
// lui-même son compte à partir d'un lien d'invitation généré par un admin.
function ClaimInviteScreen({ token, onClaimed }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) { setError("Choisis un nom d'utilisateur et un mot de passe."); return; }
    if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setBusy(true);
    setError("");
    try {
      await store.claimInvite({ token, username: username.trim(), password });
      setDone(true);
    } catch (e) {
      setError(e.message || "Ce lien d'invitation n'est plus valide.");
    }
    setBusy(false);
  };

  const onKeyDown = (e) => { if (e.key === "Enter") submit(); };

  if (done) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <CheckCircle2 size={40} color="#3F9C6D" style={{ marginBottom: 10 }} />
          <p style={{ color: "#233047", fontSize: 14.5, marginBottom: 18 }}>
            Ton compte est prêt ! Tu peux maintenant te connecter avec ton nom d'utilisateur et ton mot de passe.
          </p>
          <Button variant="primary" onClick={onClaimed} style={{ width: "100%", justifyContent: "center" }}>
            Aller à la connexion
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p style={{ color: "#5B6472", fontSize: 13.5, marginTop: 0, marginBottom: 20 }}>
        Bienvenue ! Choisis ton nom d'utilisateur et ton mot de passe pour activer ton compte.
      </p>
      <div style={{ marginBottom: 12 }}>
        <Label>Nom d'utilisateur</Label>
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKeyDown} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <Label>Mot de passe (6 caractères minimum)</Label>
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown} />
      </div>
      {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
      <Button variant="primary" onClick={submit} disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
        {busy ? "Création…" : "Activer mon compte"}
      </Button>
    </AuthShell>
  );
}



function aggregateRange(days, range) {
  const vendorTotals = {};
  const productTotals = {};
  days.forEach((day) => {
    if (!day || !inRange(day.date, range)) return;
    day.lines.forEach((l) => {
      if (l.quantiteVendue == null) return;
      if (!vendorTotals[l.vendorId]) vendorTotals[l.vendorId] = { nom: l.vendorNom, total: 0 };
      vendorTotals[l.vendorId].total += l.montantAttendu || 0;
      if (!productTotals[l.productId]) productTotals[l.productId] = { nom: l.productNom, qty: 0 };
      productTotals[l.productId].qty += l.quantiteVendue || 0;
    });
  });
  const bestVendor = Object.values(vendorTotals).sort((a, b) => b.total - a.total)[0] || null;
  const topProducts = Object.values(productTotals).sort((a, b) => b.qty - a.qty).slice(0, 4);
  return { bestVendor, topProducts };
}

// ---------------------------------------------------------------------------
// Objectifs de vente quotidiens — paliers minimal / maximal / extraordinaire
// ---------------------------------------------------------------------------

const PALIER_ORDER = ["minimal", "maximal", "extraordinaire"];
const PALIER_LABELS = { minimal: "Objectif minimal", maximal: "Objectif maximal", extraordinaire: "Objectif extraordinaire" };
const PALIER_COLORS = { minimal: "#C1554A", maximal: "#D9A441", extraordinaire: "#3F8361" };

// Calcule, pour un CA donné et des seuils donnés, la liste des paliers
// atteints (seuils > 0 uniquement — un seuil à 0 est considéré "non défini").
function reachedPaliers(ca, objectifs) {
  const out = [];
  if (objectifs.minimal > 0 && ca >= objectifs.minimal) out.push("minimal");
  if (objectifs.maximal > 0 && ca >= objectifs.maximal) out.push("maximal");
  if (objectifs.extraordinaire > 0 && ca >= objectifs.extraordinaire) out.push("extraordinaire");
  return out;
}

// Classement complet des vendeurs (CA + quantité) sur une période — utilisé
// par l'onglet Rapports.
function aggregateVendorRanking(days, range, vendors) {
  const totals = {};
  vendors.forEach((v) => { totals[v.id] = { nom: v.nom, ca: 0, vendu: 0 }; });
  days.forEach((day) => {
    if (!day || !inRange(day.date, range)) return;
    day.lines.forEach((l) => {
      if (l.quantiteVendue == null) return;
      if (!totals[l.vendorId]) totals[l.vendorId] = { nom: l.vendorNom, ca: 0, vendu: 0 };
      totals[l.vendorId].ca += l.montantAttendu || 0;
      totals[l.vendorId].vendu += l.quantiteVendue || 0;
    });
  });
  return Object.values(totals).sort((a, b) => b.ca - a.ca);
}

// Série jour par jour du chiffre d'affaires global sur une période — utilisé
// par le graphique d'évolution mensuelle de l'onglet Rapports.
function buildDailyTotalSeries(days, range) {
  const byDate = {};
  days.forEach((d) => { if (d) byDate[d.date] = d; });
  const series = [];
  let cur = range[0];
  while (cur <= range[1]) {
    const d = byDate[cur];
    const ca = d ? d.lines.reduce((s, l) => s + (l.quantiteVendue != null ? (l.montantAttendu || 0) : 0), 0) : 0;
    series.push({ date: cur, label: cur.slice(8, 10), ca });
    cur = addDays(cur, 1);
  }
  return series;
}

// Répartit le chiffre d'affaires / quantité vendue par catégorie de produit
// sur une période donnée (utilisé au Tableau de bord).
function aggregateRangeByCategory(days, range, productsById) {
  const totals = {};
  days.forEach((day) => {
    if (!day || !inRange(day.date, range)) return;
    day.lines.forEach((l) => {
      if (l.quantiteVendue == null) return;
      const categorie = productsById[l.productId]?.categorie || "Général";
      if (!totals[categorie]) totals[categorie] = { categorie, qty: 0, ca: 0 };
      totals[categorie].qty += l.quantiteVendue || 0;
      totals[categorie].ca += l.montantAttendu || 0;
    });
  });
  return Object.values(totals).sort((a, b) => b.ca - a.ca);
}

// Calcule le résumé de versement (espèces + mobile) d'un vendeur pour un jour donné
function computeVersementSummary(day, vendorId) {
  const lines = (day?.lines || []).filter((l) => l.vendorId === vendorId && l.quantiteRestante !== null);
  const montantAttendu = lines.reduce((s, l) => s + (l.montantAttendu || 0), 0);
  const versement = day?.versements?.[vendorId] || { mobilePayments: [], montantVerseEspeces: null };
  const totalMobile = (versement.mobilePayments || []).reduce((s, m) => s + (Number(m.montant) || 0), 0);
  const montantAVerserEspeces = montantAttendu - totalMobile;
  const finalise = versement.montantVerseEspeces !== null && versement.montantVerseEspeces !== undefined;
  const ecart = finalise ? versement.montantVerseEspeces - montantAVerserEspeces : null;
  let statut = null;
  if (finalise) statut = Math.abs(ecart) < 1 ? "equilibre" : ecart > 0 ? "exces" : "manque";
  return {
    lines, montantAttendu, mobilePayments: versement.mobilePayments || [], totalMobile,
    montantAVerserEspeces, montantVerseEspeces: finalise ? versement.montantVerseEspeces : null,
    finalise, ecart, statut,
  };
}

// ---------------------------------------------------------------------------
// Cloche de notifications — paliers d'objectif atteints par les vendeurs,
// visible uniquement par l'administration (admin / gestionnaire).
// ---------------------------------------------------------------------------

function AdminAchievementBell({ achievements, onMarkSeen, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen();
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        style={{
          position: "relative", background: "#fff", border: "1px solid #E7E9EE", borderRadius: 10,
          width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1B2A4A",
        }}
        title="Paliers d'objectif atteints"
      >
        <Bell size={17} />
        {achievements.length > 0 && (
          <span
            style={{
              position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 999,
              background: "#C1554A", color: "#fff", fontSize: 10.5, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            }}
          >
            {achievements.length}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: 42, right: 0, width: 320, maxHeight: 380, overflowY: "auto",
            background: "#fff", border: "1px solid #E7E9EE", borderRadius: 12, boxShadow: "0 10px 30px rgba(27,42,74,0.14)", zIndex: 30,
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F0F1F4", fontSize: 13, fontWeight: 700, color: "#1B2A4A" }}>
            Paliers atteints aujourd'hui
          </div>
          {achievements.length === 0 ? (
            <EmptyState text="Aucun palier atteint pour l'instant." />
          ) : (
            achievements.map((a) => (
              <div
                key={a.id}
                onClick={() => onMarkSeen(a.id)}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderBottom: "1px solid #F5F6F8", cursor: "pointer" }}
              >
                <Trophy size={15} color={PALIER_COLORS[a.palier]} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 600 }}>
                    {a.vendorNom} — {PALIER_LABELS[a.palier]}
                  </div>
                  <div style={{ fontSize: 12, color: "#8A93A3", marginTop: 2 }}>
                    {fmtMoney(a.montant)} · {formatDateFR(a.date)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState(null); // null = pas encore vérifié
  const [currentUser, setCurrentUser] = useState(null);
  const [currentVendor, setCurrentVendor] = useState(null);

  const [tab, setTab] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [daysList, setDaysList] = useState([]);
  const [day, setDay] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tick, setTick] = useState(0);
  const [online, setOnline] = useState(offline.isOnline());
  const [queueCount, setQueueCount] = useState(offline.queueLength());
  const [syncing, setSyncing] = useState(false);
  const [objectives, setObjectives] = useState({ minimal: 0, maximal: 0, extraordinaire: 0 });
  const [unseenAchievements, setUnseenAchievements] = useState([]);

  // Force un nouveau rendu toutes les minutes pour détecter le changement de jour à 00h
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Suit la connectivité et déclenche la synchronisation au retour du réseau
  useEffect(() => {
    const off = offline.onConnectivityChange((isNowOnline) => {
      setOnline(isNowOnline);
      if (isNowOnline) processQueue();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayISO();

  // Rejoue les actions mises de côté pendant la coupure réseau, dans l'ordre
  const processQueue = async () => {
    if (syncing) return;
    setSyncing(true);
    const queue = offline.getQueue();
    for (const action of queue) {
      try {
        if (action.type === "addProduct") await store.addProduct(action.payload);
        else if (action.type === "updateProductStock") await store.updateProductStock(action.payload.id, action.payload.stock);
        else if (action.type === "deleteProduct") await store.deleteProduct(action.payload.id);
        else if (action.type === "setDay") await store.setDay(action.payload);
        else if (action.type === "createWithdrawal") await store.createWithdrawal(action.payload);
        else if (action.type === "updateWithdrawalStatus") await store.updateWithdrawalStatus(action.payload.id, action.payload.statut, action.payload.extra);
        else if (action.type === "createNotification") await store.createNotification(action.payload);
        else if (action.type === "markNotificationRead") await store.markNotificationRead(action.payload.id);
        offline.dequeue(action.id);
      } catch (e) {
        console.error("Échec de synchronisation, nouvelle tentative plus tard", action, e);
        break; // on garde l'ordre : on retentera celle-ci (et les suivantes) au prochain passage
      }
    }
    setQueueCount(offline.queueLength());
    setSyncing(false);
    // Recharge les données fraîches une fois la synchronisation terminée
    if (currentUser) {
      const [p, v, dl, d, w, n] = await Promise.all([
        store.getProducts(), store.getVendors(), store.getDaysList(),
        store.getDay(today), store.getWithdrawals(), store.getNotifications(),
      ]);
      setProducts(p); setVendors(v); setDaysList(dl); setDay(d); setWithdrawals(w); setNotifications(n);
      offline.cacheSet("products", p); offline.cacheSet("vendors", v);
      offline.cacheSet("day:" + today, d); offline.cacheSet("withdrawals", w); offline.cacheSet("notifications", n);
    }
  };

  // Restaure la session si l'utilisateur est déjà connecté (rechargement de page)
  useEffect(() => {
    (async () => {
      try {
        const exists = await store.hasAnyAccount();
        setHasAccount(exists);
        const session = await store.getSession();
        if (session) {
          const profile = await store.getMyProfile();
          if (profile) {
            let vendor = null;
            if (profile.role === "vendor") {
              const allVendors = await store.getVendors();
              vendor = allVendors.find((v) => v.id === profile.vendorId) || null;
            }
            setCurrentUser(profile);
            setCurrentVendor(vendor);
            setTab(profile.role === "vendor" ? "retour" : profile.role === "messenger" ? "messagerie" : "dashboard");
          }
        }
      } catch (e) {
        console.error("Chargement de session impossible (probablement hors-ligne)", e);
      }
      setLoading(false);
    })();
  }, []);

  // Charge les données une fois connecté (avec repli sur le cache local si hors-ligne)
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      if (!offline.isOnline()) {
        setProducts(offline.cacheGet("products") || []);
        setVendors(offline.cacheGet("vendors") || []);
        setDaysList(offline.cacheGet("daysList") || []);
        setDay(offline.cacheGet("day:" + today) || emptyDay(today));
        setWithdrawals(offline.cacheGet("withdrawals") || []);
        setNotifications(offline.cacheGet("notifications") || []);
        return;
      }
      try {
        const [p, v, dl, d, w, n, obj] = await Promise.all([
          store.getProducts(), store.getVendors(), store.getDaysList(),
          store.getDay(today), store.getWithdrawals(), store.getNotifications(),
          store.getSalesObjectives(),
        ]);
        setProducts(p); setVendors(v); setDaysList(dl); setDay(d); setWithdrawals(w); setNotifications(n);
        setObjectives(obj);
        offline.cacheSet("products", p); offline.cacheSet("vendors", v); offline.cacheSet("daysList", dl);
        offline.cacheSet("day:" + today, d); offline.cacheSet("withdrawals", w); offline.cacheSet("notifications", n);
      } catch (e) {
        console.error("Chargement des données impossible, utilisation du cache local", e);
        setProducts(offline.cacheGet("products") || []);
        setVendors(offline.cacheGet("vendors") || []);
        setDaysList(offline.cacheGet("daysList") || []);
        setDay(offline.cacheGet("day:" + today) || emptyDay(today));
        setWithdrawals(offline.cacheGet("withdrawals") || []);
        setNotifications(offline.cacheGet("notifications") || []);
      }
    })();
  }, [currentUser]);

  // Passage à un nouveau jour (minuit) : la distribution du jour repart à zéro,
  // tout l'historique précédent reste intact dans la base de données.
  useEffect(() => {
    if (day && day.date !== today && online) {
      (async () => {
        const d = await store.getDay(today);
        setDay(d);
        offline.cacheSet("day:" + today, d);
      })();
    }
  }, [today, day, online]);

  const reloadProducts = useCallback(async () => { setProducts(await store.getProducts()); }, []);
  const reloadVendors = useCallback(async () => { setVendors(await store.getVendors()); }, []);

  // Notifications admin : un vendeur qui atteint un palier du jour apparaît
  // ici tant qu'un admin/gestionnaire ne l'a pas marqué comme vu.
  const canSeeAchievements = currentUser && (currentUser.role === "admin" || currentUser.role === "manager");
  const reloadUnseenAchievements = useCallback(async () => {
    try { setUnseenAchievements(await store.getUnseenAchievements()); } catch (e) { console.error("Chargement des paliers atteints impossible", e); }
  }, []);
  useEffect(() => {
    if (!canSeeAchievements || !online) return;
    reloadUnseenAchievements();
    const id = setInterval(reloadUnseenAchievements, 30000);
    return () => clearInterval(id);
  }, [canSeeAchievements, online, reloadUnseenAchievements]);

  const markAchievementSeen = async (id) => {
    setUnseenAchievements((prev) => prev.filter((a) => a.id !== id));
    try { await store.markAchievementSeen(id); } catch (e) { console.error("Impossible de marquer le palier comme vu", e); }
  };

  const persistObjectives = async (next) => {
    setObjectives(next);
    await store.setSalesObjectives(next, currentUser?.username);
  };

  // Ces fonctions gardent la même signature que dans la version précédente
  // (on passe le tableau "complet" attendu) mais traduisent le changement en
  // vraies écritures Supabase — ou, si hors-ligne, les mettent de côté pour
  // les rejouer automatiquement dès le retour du réseau.
  const persistProducts = async (next) => {
    const prevById = Object.fromEntries(products.map((p) => [p.id, p]));
    setProducts(next);
    offline.cacheSet("products", next);
    if (!offline.isOnline()) {
      for (const p of next) {
        if (!prevById[p.id]) offline.enqueue({ type: "addProduct", payload: { nom: p.nom, prix: p.prix, stock: p.stock, categorie: p.categorie } });
        else if (prevById[p.id].stock !== p.stock) offline.enqueue({ type: "updateProductStock", payload: { id: p.id, stock: p.stock } });
      }
      for (const p of products) {
        if (!next.find((x) => x.id === p.id)) offline.enqueue({ type: "deleteProduct", payload: { id: p.id } });
      }
      setQueueCount(offline.queueLength());
      return;
    }
    try {
      for (const p of next) {
        if (!prevById[p.id]) await store.addProduct({ nom: p.nom, prix: p.prix, stock: p.stock, categorie: p.categorie });
        else if (prevById[p.id].stock !== p.stock) await store.updateProductStock(p.id, p.stock);
      }
      for (const p of products) {
        if (!next.find((x) => x.id === p.id)) await store.deleteProduct(p.id);
      }
      const fresh = await store.getProducts();
      setProducts(fresh);
      offline.cacheSet("products", fresh);
    } catch (e) {
      console.error("Écriture impossible, mise en file d'attente", e);
      setQueueCount(offline.queueLength());
    }
  };

  const persistDay = async (next) => {
    setDay(next);
    setDaysList((prev) => (prev.includes(next.date) ? prev : [next.date, ...prev]));
    offline.cacheSet("day:" + next.date, next);
    if (!offline.isOnline()) {
      const q = offline.getQueue().filter((a) => !(a.type === "setDay" && a.payload?.date === next.date));
      q.push({ id: Math.random().toString(36).slice(2, 10), createdAt: Date.now(), type: "setDay", payload: next });
      localStorage.setItem("z2t_offline_queue", JSON.stringify(q));
      setQueueCount(offline.queueLength());
      return;
    }
    try {
      await store.setDay(next);
    } catch (e) {
      console.error("Écriture impossible, mise en file d'attente", e);
      offline.enqueue({ type: "setDay", payload: next });
      setQueueCount(offline.queueLength());
    }
  };

  const persistWithdrawals = async (next) => {
    const prevById = Object.fromEntries(withdrawals.map((w) => [w.id, w]));
    setWithdrawals(next);
    offline.cacheSet("withdrawals", next);
    const isNewOffline = !offline.isOnline();
    for (const w of next) {
      if (!prevById[w.id]) {
        const payload = { vendorId: w.vendorId, vendorNom: w.vendorNom, montant: w.montant, methode: w.methode, numeroMobile: w.numeroMobile, date: w.date };
        if (isNewOffline) offline.enqueue({ type: "createWithdrawal", payload });
        else { try { await store.createWithdrawal(payload); } catch { offline.enqueue({ type: "createWithdrawal", payload }); } }
      } else if (prevById[w.id].statut !== w.statut) {
        const payload = { id: w.id, statut: w.statut, extra: { approvedBy: w.approvedBy, refusalReason: w.refusalReason } };
        if (isNewOffline) offline.enqueue({ type: "updateWithdrawalStatus", payload });
        else { try { await store.updateWithdrawalStatus(w.id, w.statut, payload.extra); } catch { offline.enqueue({ type: "updateWithdrawalStatus", payload }); } }
      }
    }
    setQueueCount(offline.queueLength());
    if (!isNewOffline) {
      try { const fresh = await store.getWithdrawals(); setWithdrawals(fresh); offline.cacheSet("withdrawals", fresh); } catch {}
    }
  };

  const persistNotifications = async (next) => {
    const prevById = Object.fromEntries(notifications.map((n) => [n.id, n]));
    setNotifications(next);
    offline.cacheSet("notifications", next);
    const isNewOffline = !offline.isOnline();
    for (const n of next) {
      if (!prevById[n.id]) {
        const payload = { vendorId: n.vendorId, message: n.message };
        if (isNewOffline) offline.enqueue({ type: "createNotification", payload });
        else { try { await store.createNotification(payload); } catch { offline.enqueue({ type: "createNotification", payload }); } }
      } else if (!prevById[n.id].read && n.read) {
        const payload = { id: n.id };
        if (isNewOffline) offline.enqueue({ type: "markNotificationRead", payload });
        else { try { await store.markNotificationRead(n.id); } catch { offline.enqueue({ type: "markNotificationRead", payload }); } }
      }
    }
    setQueueCount(offline.queueLength());
    if (!isNewOffline) {
      try { const fresh = await store.getNotifications(); setNotifications(fresh); offline.cacheSet("notifications", fresh); } catch {}
    }
  };

  const handleSetupCreated = async () => {
    setHasAccount(true);
    const profile = await store.getMyProfile();
    if (profile) {
      setCurrentUser(profile);
      setCurrentVendor(null);
      setTab("dashboard");
    }
  };

  const handleLoggedIn = async (profile) => {
    let vendor = null;
    if (profile.role === "vendor") {
      const allVendors = await store.getVendors();
      vendor = allVendors.find((v) => v.id === profile.vendorId) || null;
    }
    setCurrentUser(profile);
    setCurrentVendor(vendor);
    setTab(profile.role === "vendor" ? "retour" : profile.role === "messenger" ? "messagerie" : "dashboard");
    store.logActivity(profile, "login", `${profile.username} s'est connecté.`);
    store.setPresence(profile.id, true);
  };

  const handleLogout = async () => {
    if (currentUser) {
      store.logActivity(currentUser, "logout", `${currentUser.username} s'est déconnecté.`);
      await store.setPresence(currentUser.id, false);
    }
    await store.signOut();
    setCurrentUser(null);
    setCurrentVendor(null);
  };

  // Présence : "battement de cœur" pendant que la session est ouverte, et
  // passage hors-ligne au mieux à la fermeture de l'onglet/fenêtre.
  useEffect(() => {
    if (!currentUser) return;
    store.setPresence(currentUser.id, true);
    const interval = setInterval(() => store.setPresence(currentUser.id, true), 45000);
    const handleUnload = () => { store.setPresence(currentUser.id, false); };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [currentUser?.id]);

  // Lien d'invitation (?invite=TOKEN) : prioritaire sur tout le reste, y
  // compris pendant le chargement — un vendeur qui clique ce lien ne doit
  // jamais voir l'écran de connexion classique avant d'avoir activé son compte.
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  if (inviteToken && !currentUser) {
    return (
      <ClaimInviteScreen
        token={inviteToken}
        onClaimed={() => { window.location.href = window.location.pathname; }}
      />
    );
  }

  if (loading || hasAccount === null) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#5B6472", fontFamily: "Calibri, sans-serif" }}>
        Chargement des données du magasin…
      </div>
    );
  }

  if (!hasAccount) {
    return <SetupScreen onCreated={handleSetupCreated} />;
  }

  if (!currentUser || day === null) {
    if (!currentUser) return <LoginScreen onLoggedIn={handleLoggedIn} />;
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#5B6472", fontFamily: "Calibri, sans-serif" }}>
        Chargement des données du magasin…
      </div>
    );
  }

  const isAdmin = currentUser.role === "admin";
  const isManager = currentUser.role === "manager";
  const isMessenger = currentUser.role === "messenger";
  const canManage = isAdmin || isManager; // accès Tableau de bord / Finances / Stock / Personnel
  const nav = isAdmin
    ? (currentUser.isPrimary
        ? [...NAV_ADMIN,
           { id: "journal", label: "Journal d'activité", icon: History },
           { id: "supervision", label: "Toutes les conversations", icon: Eye }]
        : NAV_ADMIN)
    : isManager ? NAV_MANAGER : isMessenger ? NAV_MESSENGER : NAV_VENDOR;
  const roleLabel = isAdmin ? (currentUser.isPrimary ? "admin principal" : "admin") : isManager ? "gestionnaire" : isMessenger ? "agent messagerie" : "vendeur";
  const activeVendor = currentUser.role === "vendor" ? currentVendor : null;

  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", minHeight: 640, fontFamily: "Calibri, Arial, sans-serif", background: "#F7F8FA", borderRadius: 16, overflow: "hidden", border: "1px solid #E7E9EE" }}>
      <style>{`
        /* Bureau / PC : la barre latérale ne bouge jamais, quel que soit le défilement du contenu */
        .app-sidebar { position: relative; z-index: 50; }
        .app-main { overflow-y: auto; }
        .mobile-nav-toggle { display: none; }
        .mobile-nav-overlay { display: none; }
        .sidebar-close-btn { display: none; }

        /* Mobile / tablette : la barre latérale devient un tiroir escamotable */
        @media (max-width: 880px) {
          .app-shell { border-radius: 0; height: 100vh; }
          .app-sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            width: 250px !important;
            max-width: 82vw;
            height: 100vh !important;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            z-index: 300;
            box-shadow: 2px 0 24px rgba(0,0,0,0.28);
          }
          .app-sidebar.open { transform: translateX(0); }
          .mobile-nav-toggle {
            display: inline-flex; align-items: center; justify-content: center;
            width: 36px; height: 36px; border-radius: 8px; border: 1px solid #E7E9EE;
            background: #fff; cursor: pointer; color: #1B2A4A; flex-shrink: 0;
          }
          .sidebar-close-btn {
            display: inline-flex; align-items: center; justify-content: center;
            position: absolute; top: 14px; right: 14px; width: 30px; height: 30px;
            border-radius: 8px; border: none; background: rgba(255,255,255,0.08);
            color: #C7CCDA; cursor: pointer;
          }
          .mobile-nav-overlay.open {
            display: block; position: fixed; inset: 0; background: rgba(21,32,57,0.5); z-index: 250;
          }
        }
      `}</style>

      {/* Rideau derrière le tiroir mobile, pour fermer au clic à l'extérieur */}
      <div
        className={`mobile-nav-overlay${mobileNavOpen ? " open" : ""}`}
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Barre latérale */}
      <div className={`app-sidebar${mobileNavOpen ? " open" : ""}`} style={{ width: 220, background: "#152039", color: "#fff", padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le menu">
          <X size={16} />
        </button>
        <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px 4px 8px" }}>
          <Logo size={32} />
          <div style={{ fontFamily: "Cambria, Georgia, serif", fontWeight: 700, fontSize: 14, lineHeight: 1.15 }}>
            Z2T<br /><span style={{ fontSize: 10, fontWeight: 500, color: "#9AA6C2" }}>Marketing Manager</span>
          </div>
        </div>
        <div className="sidebar-role" style={{ fontSize: 11, color: "#8B95AC", padding: "0 8px 16px 8px" }}>
          {currentUser.username} · {roleLabel}
        </div>

        {nav.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              className="nav-btn"
              onClick={() => { setTab(n.id); setMobileNavOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                padding: "10px 12px", marginBottom: 3, borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? "rgba(217,164,65,0.16)" : "transparent", color: active ? "#D9A441" : "#C7CCDA",
                fontSize: 13.5, fontWeight: active ? 700 : 500,
              }}
            >
              <Icon size={16} />
              {n.label}
            </button>
          );
        })}

        <button
          className="logout-btn"
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "10px 12px", marginTop: "auto", borderRadius: 8, border: "none", cursor: "pointer",
            background: "transparent", color: "#E28A80", fontSize: 13.5, fontWeight: 600,
          }}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
        <div className="sidebar-footer" style={{ padding: "10px 8px 0 8px", fontSize: 11, color: "#6B7690" }}>Données partagées entre tous les postes</div>
      </div>

      {/* Contenu principal */}
      <div className="app-main" style={{ flex: 1, padding: "0 30px 26px 30px", overflowY: "auto", minWidth: 0 }}>
        <div
          className="app-header"
          style={{
            position: "sticky", top: 0, zIndex: 20, background: "#F7F8FA",
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            flexWrap: "wrap", gap: 8, padding: "26px 0 16px 0", marginBottom: 6,
            borderBottom: "1px solid #E7E9EE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="mobile-nav-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <MenuIcon size={18} />
            </button>
            <h1 style={{ margin: 0, fontFamily: "Cambria, Georgia, serif", fontSize: 24, color: "#1B2A4A" }}>
              {nav.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {canManage && (
              <AdminAchievementBell
                achievements={unseenAchievements}
                onMarkSeen={markAchievementSeen}
                onOpen={reloadUnseenAchievements}
              />
            )}
            <div className="app-date" style={{ fontSize: 13, color: "#8A93A3", textTransform: "capitalize" }}>{formatDateFR(today)}</div>
          </div>
        </div>
        <div style={{ paddingTop: 16 }}>

        {(!online || queueCount > 0) && (
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              padding: "10px 16px", borderRadius: 10, marginBottom: 18,
              background: !online ? "#FBECEA" : "#FFF7E6",
              border: `1px solid ${!online ? "#F0CFC9" : "#F0E0B0"}`,
            }}
          >
            <span style={{ fontSize: 13, color: !online ? "#C1554A" : "#8A6D1F", fontWeight: 600 }}>
              {!online
                ? `Hors ligne — tes actions sont enregistrées et seront envoyées automatiquement dès le retour du réseau${queueCount > 0 ? ` (${queueCount} en attente)` : ""}.`
                : syncing
                  ? `Synchronisation en cours… (${queueCount} restante${queueCount > 1 ? "s" : ""})`
                  : `${queueCount} action${queueCount > 1 ? "s" : ""} en attente de synchronisation.`}
            </span>
            {online && !syncing && queueCount > 0 && (
              <Button variant="ghost" onClick={processQueue} style={{ borderColor: "#F0E0B0", color: "#8A6D1F" }}>
                Réessayer maintenant
              </Button>
            )}
          </div>
        )}

        {tab === "dashboard" && canManage && (
          <Dashboard products={products} vendors={vendors} day={day} daysList={daysList} today={today} objectives={objectives} setObjectives={persistObjectives} />
        )}
        {tab === "dashboard" && !canManage && (
          <VendorDashboard vendor={activeVendor} daysList={daysList} today={today} day={day} withdrawals={withdrawals} setWithdrawals={persistWithdrawals} notifications={notifications} setNotifications={persistNotifications} objectives={objectives} />
        )}
        {tab === "produits" && isAdmin && <Produits products={products} setProducts={persistProducts} reloadProducts={reloadProducts} />}
        {tab === "stock" && canManage && <Stock products={products} setProducts={persistProducts} />}
        {tab === "vendeurs" && canManage && (
          <Vendeurs vendors={vendors} reloadVendors={reloadVendors} isAdmin={isAdmin} currentUser={currentUser} />
        )}
        {tab === "distribution" && isAdmin && (
          <Distribution products={products} setProducts={persistProducts} vendors={vendors} day={day} setDay={persistDay} />
        )}
        {tab === "retour" && (
          <RetourDuSoir
            isAdmin={isAdmin}
            vendors={vendors}
            products={products}
            setProducts={persistProducts}
            day={day}
            setDay={persistDay}
            activeVendor={activeVendor}
          />
        )}
        {tab === "caisse" && canManage && (
          <Caisse vendors={vendors} day={day} setDay={persistDay} withdrawals={withdrawals} setWithdrawals={persistWithdrawals} notifications={notifications} setNotifications={persistNotifications} daysList={daysList} today={today} currentUser={currentUser} />
        )}
        {tab === "messagerie" && (
          <Messagerie currentUser={currentUser} vendors={vendors} />
        )}
        {tab === "rapports" && canManage && (
          <Rapports vendors={vendors} products={products} daysList={daysList} today={today} />
        )}
        {tab === "historique" && isAdmin && <Historique daysList={daysList} vendors={vendors} today={today} />}
        {tab === "journal" && isAdmin && currentUser.isPrimary && <JournalActivite />}
        {tab === "supervision" && isAdmin && currentUser.isPrimary && <Supervision currentUser={currentUser} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

function Dashboard({ products, vendors, day, daysList, today, objectives, setObjectives }) {
  const [period, setPeriod] = useState("month"); // "day" | "week" | "month"
  const [history, setHistory] = useState({ day: null, week: null, month: null });
  const [categoryHistory, setCategoryHistory] = useState({ day: [], week: [], month: [] });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expensesToday, setExpensesToday] = useState(0);
  const [objDraft, setObjDraft] = useState(objectives);
  const [objSaving, setObjSaving] = useState(false);
  const [objSaved, setObjSaved] = useState(false);

  useEffect(() => { setObjDraft(objectives); }, [objectives]);

  const totalVendu = day.lines.reduce((s, l) => s + (l.quantiteVendue || 0), 0);
  const totalAttendu = day.lines.reduce((s, l) => s + (l.montantAttendu || 0), 0);

  // Totaux espèces / mobile du jour (issus des versements par vendeur)
  let totalEspeces = 0;
  let totalMobile = 0;
  vendors.forEach((v) => {
    const summary = computeVersementSummary(day, v.id);
    totalMobile += summary.totalMobile;
    if (summary.finalise) totalEspeces += summary.montantVerseEspeces;
  });
  const totalDepenses = (day.expenses || []).reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const totalEncaisse = totalEspeces + totalMobile;
  const ecart = totalEncaisse - totalDepenses - totalAttendu;
  const balanced = Math.abs(ecart) < 1;

  const lowStock = products.filter((p) => Number(p.stock) <= 5);
  const stockValue = products.reduce((s, p) => s + Number(p.stock || 0) * Number(p.prix || 0), 0);

  useEffect(() => {
    (async () => {
      const dayPrev = getPreviousDayRange(today);
      const weekPrev = getPreviousWeekRange(today);
      const monthPrev = getPreviousMonthRange(today);
      const ranges = [dayPrev, weekPrev, monthPrev];
      const relevantDates = daysList.filter((date) => ranges.some((r) => inRange(date, r)));
      const loaded = await store.getDaysInRange(relevantDates);
      setHistory({
        day: aggregateRange(loaded, dayPrev),
        week: aggregateRange(loaded, weekPrev),
        month: aggregateRange(loaded, monthPrev),
      });
      const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
      setCategoryHistory({
        day: aggregateRangeByCategory(loaded, dayPrev, productsById),
        week: aggregateRangeByCategory(loaded, weekPrev, productsById),
        month: aggregateRangeByCategory(loaded, monthPrev, productsById),
      });
      setLoadingHistory(false);
    })();
  }, [daysList, today, products]);

  const periodLabels = { day: "Hier", week: "Semaine dernière", month: "Mois dernier" };
  const current = history[period];
  const currentByCategory = categoryHistory[period] || [];

  const saveObjectives = async () => {
    setObjSaving(true); setObjSaved(false);
    const next = {
      minimal: Number(objDraft.minimal) || 0,
      maximal: Number(objDraft.maximal) || 0,
      extraordinaire: Number(objDraft.extraordinaire) || 0,
    };
    await setObjectives(next);
    setObjSaving(false); setObjSaved(true);
    setTimeout(() => setObjSaved(false), 2500);
  };

  return (
    <div>
      <BirthdayBalloons />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard label="ARTICLES VENDUS AUJOURD'HUI" value={totalVendu} sub={`${day.lines.length} distribution(s) en cours`} />
        <StatCard label="MONTANT ATTENDU" value={fmtMoney(totalAttendu)} />
        <StatCard label="TOTAL ESPÈCES ENCAISSÉ" value={fmtMoney(totalEspeces)} />
        <StatCard label="TOTAL PAIEMENT MOBILE" value={fmtMoney(totalMobile)} />
        <StatCard
          label="ÉCART GLOBAL (après dépenses)"
          value={fmtMoney(ecart)}
          accent={balanced ? "#3F8361" : "#C1554A"}
          sub={balanced ? "Caisse équilibrée" : ecart > 0 ? "Excédent" : "Manquant"}
        />
        <StatCard label="VENDEURS DANS L'ÉQUIPE" value={vendors.length} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div className="dash-col-main" style={{ flex: "2 1 380px" }}>
          <Card title="Ventes du jour par vendeur">
            {vendors.length === 0 ? (
              <EmptyState text="Ajoute des vendeurs pour voir apparaître les ventes ici." />
            ) : (
              <VendorBars vendors={vendors} day={day} />
            )}
          </Card>

          <Card
            title="Performances passées"
            right={
              <div style={{ display: "flex", gap: 6 }}>
                {["day", "week", "month"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: period === p ? "1px solid #1B2A4A" : "1px solid #E7E9EE",
                      background: period === p ? "#1B2A4A" : "#fff", color: period === p ? "#fff" : "#5B6472",
                    }}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>
            }
          >
            {loadingHistory ? (
              <EmptyState text="Chargement de l'historique…" />
            ) : (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Trophy size={16} color="#D9A441" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A" }}>Meilleur vendeur — {periodLabels[period]}</span>
                  </div>
                  {current?.bestVendor ? (
                    <div>
                      <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1B2A4A" }}>
                        {current.bestVendor.nom}
                      </div>
                      <div style={{ fontSize: 13, color: "#8A93A3" }}>{fmtMoney(current.bestVendor.total)} de ventes</div>
                    </div>
                  ) : (
                    <EmptyState text="Aucune donnée pour cette période." />
                  )}
                </div>

                <div style={{ flex: "2 1 300px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A", marginBottom: 10 }}>
                    Top produits — {periodLabels[period]}
                  </div>
                  {current?.topProducts?.length ? (
                    <div style={{ height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={current.topProducts} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="nom" width={110} tick={{ fontSize: 12, fill: "#1B2A4A" }} />
                          <Tooltip formatter={(v) => `${v} unités`} />
                          <Bar dataKey="qty" fill="#D9A441" radius={[0, 6, 6, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState text="Aucune donnée pour cette période." />
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card title={`Performance par type de produit — ${periodLabels[period]}`}>
            {loadingHistory ? (
              <EmptyState text="Chargement de l'historique…" />
            ) : currentByCategory.length === 0 ? (
              <EmptyState text="Aucune vente sur cette période." />
            ) : (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px", height: Math.max(140, currentByCategory.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentByCategory} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="categorie" width={110} tick={{ fontSize: 12, fill: "#1B2A4A" }} />
                      <Tooltip formatter={(v) => fmtMoney(v)} />
                      <Bar dataKey="ca" fill="#1B2A4A" radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <Table
                    headers={["Catégorie", "Qté vendue", "Chiffre d'affaires"]}
                    rows={currentByCategory.map((c) => [c.categorie, c.qty, fmtMoney(c.ca)])}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="dash-col-side" style={{ flex: "1 1 260px" }}>
          <Card title="Objectifs quotidiens des vendeurs">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PALIER_ORDER.map((p) => (
                <div key={p}>
                  <Label>{PALIER_LABELS[p]} (F)</Label>
                  <TextInput
                    type="number"
                    value={objDraft[p] ?? 0}
                    onChange={(e) => setObjDraft((d) => ({ ...d, [p]: e.target.value }))}
                    style={{ borderColor: PALIER_COLORS[p] }}
                  />
                </div>
              ))}
              <Button variant="gold" onClick={saveObjectives} disabled={objSaving} style={{ justifyContent: "center", marginTop: 4 }}>
                {objSaving ? "Enregistrement…" : "Enregistrer les objectifs"}
              </Button>
              {objSaved && <div style={{ color: "#3F8361", fontSize: 12.5 }}>Objectifs mis à jour pour tous les vendeurs.</div>}
              <div style={{ fontSize: 11.5, color: "#8A93A3" }}>
                Ces seuils s'appliquent au chiffre d'affaires du jour de chaque vendeur et déclenchent une animation côté vendeur ainsi qu'une notification ici-même dès qu'un palier est atteint.
              </div>
            </div>
          </Card>

          <Card title="Alertes stock">
            {lowStock.length === 0 ? (
              <EmptyState text="Aucun produit en stock faible." />
            ) : (
              lowStock.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F0F1F4", fontSize: 13.5 }}>
                  <span style={{ color: "#1B2A4A", fontWeight: 600 }}>{p.nom}</span>
                  <Badge ok={false} warnText={`${p.stock} restant(s)`} />
                </div>
              ))
            )}
          </Card>

          <Card title="Valeur du stock">
            <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 24, fontWeight: 700, color: "#1B2A4A" }}>{fmtMoney(stockValue)}</div>
            <div style={{ fontSize: 12.5, color: "#8A93A3", marginTop: 4 }}>Sur la base du stock actuel et des prix unitaires</div>
          </Card>

          {totalDepenses > 0 && (
            <Card title="Dépenses du jour">
              <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 22, fontWeight: 700, color: "#C1554A" }}>{fmtMoney(totalDepenses)}</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function VendorBars({ vendors, day }) {
  const data = vendors.map((v) => {
    const lines = day.lines.filter((l) => l.vendorId === v.id);
    const montant = lines.reduce((s, l) => s + (l.montantAttendu || 0), 0);
    return { nom: v.nom, montant };
  });
  const max = Math.max(1, ...data.map((d) => d.montant));

  return (
    <div>
      {data.map((d, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "#1B2A4A", fontWeight: 600 }}>{d.nom}</span>
            <span style={{ color: "#5B6472" }}>{fmtMoney(d.montant)}</span>
          </div>
          <div style={{ height: 8, background: "#EEF0F4", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.montant / max) * 100}%`, background: "#D9A441", borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Barre de progression à 3 paliers (minimal / maximal / extraordinaire) pour
// le chiffre d'affaires du jour d'un vendeur, avec animation de célébration.
function ObjectiveProgressBar({ ca, objectifs, celebrate }) {
  const seuils = PALIER_ORDER.map((p) => objectifs[p] || 0);
  const scaleMax = Math.max(ca, ...seuils, 1) * 1.08;
  const pct = Math.min(100, (ca / scaleMax) * 100);
  const reached = reachedPaliers(ca, objectifs);
  const highestReached = reached[reached.length - 1] || null;

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes z2t-pop-in { 0% { transform: scale(0.4) translateY(10px); opacity: 0; } 60% { transform: scale(1.08) translateY(-2px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes z2t-confetti-fall { 0% { transform: translateY(-14px) rotate(0deg); opacity: 1; } 100% { transform: translateY(90px) rotate(280deg); opacity: 0; } }
        .z2t-celebrate-badge { animation: z2t-pop-in 0.45s ease-out; }
        .z2t-confetti { position: absolute; top: 0; animation: z2t-confetti-fall 1.1s ease-in forwards; }
      `}</style>

      {celebrate && (
        <div
          className="z2t-celebrate-badge"
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, marginBottom: 16,
            background: `${PALIER_COLORS[celebrate]}1A`, border: `1px solid ${PALIER_COLORS[celebrate]}55`, position: "relative", overflow: "hidden",
          }}
        >
          <PartyPopper size={20} color={PALIER_COLORS[celebrate]} />
          <span style={{ fontSize: 14, fontWeight: 700, color: PALIER_COLORS[celebrate] }}>
            Bravo ! Tu viens d'atteindre l'objectif {PALIER_LABELS[celebrate].toLowerCase()} 🎉
          </span>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="z2t-confetti"
              style={{
                left: `${8 + i * 9}%`, fontSize: 13, animationDelay: `${i * 0.05}s`,
                color: [PALIER_COLORS.minimal, PALIER_COLORS.maximal, PALIER_COLORS.extraordinaire][i % 3],
              }}
            >
              ●
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 700, color: "#1B2A4A" }}>{fmtMoney(ca)} aujourd'hui</span>
        {highestReached && (
          <span style={{ fontWeight: 700, color: PALIER_COLORS[highestReached] }}>{PALIER_LABELS[highestReached]} atteint</span>
        )}
      </div>

      <div style={{ position: "relative", height: 14, background: "#EEF0F4", borderRadius: 999, overflow: "visible" }}>
        <div
          style={{
            height: "100%", width: `${pct}%`, borderRadius: 999, transition: "width 0.6s ease",
            background: `linear-gradient(90deg, ${PALIER_COLORS.minimal}, ${PALIER_COLORS.maximal}, ${PALIER_COLORS.extraordinaire})`,
          }}
        />
        {PALIER_ORDER.map((p) => {
          const seuil = objectifs[p] || 0;
          if (seuil <= 0) return null;
          const left = Math.min(100, (seuil / scaleMax) * 100);
          const done = reached.includes(p);
          return (
            <div key={p} style={{ position: "absolute", top: -4, left: `${left}%`, transform: "translateX(-50%)" }} title={`${PALIER_LABELS[p]} — ${fmtMoney(seuil)}`}>
              <div style={{ width: 3, height: 22, background: done ? "#fff" : PALIER_COLORS[p], borderRadius: 2, boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        {PALIER_ORDER.filter((p) => (objectifs[p] || 0) > 0).map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <CheckCircle2 size={13} color={reached.includes(p) ? PALIER_COLORS[p] : "#C7CCD6"} />
            <span style={{ color: reached.includes(p) ? "#1B2A4A" : "#8A93A3", fontWeight: reached.includes(p) ? 700 : 500 }}>
              {PALIER_LABELS[p]} — {fmtMoney(objectifs[p])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tableau de bord du vendeur (lecture seule + demande de retrait d'excédent)
// ---------------------------------------------------------------------------

function VendorDashboard({ vendor, daysList, today, day, withdrawals, setWithdrawals, notifications, setNotifications, objectives }) {
  const [allDays, setAllDays] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("especes"); // "especes" | "mobile"
  const [withdrawNumero, setWithdrawNumero] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestOk, setRequestOk] = useState(false);
  const [achievedToday, setAchievedToday] = useState(null); // paliers déjà enregistrés côté serveur pour aujourd'hui
  const [celebrate, setCelebrate] = useState(null); // palier en cours d'animation

  useEffect(() => {
    (async () => {
      const loaded = await store.getDaysInRange(daysList);
      setAllDays(loaded);
    })();
  }, [daysList]);

  // Charge les paliers déjà atteints aujourd'hui pour éviter de rejouer
  // l'animation à chaque rechargement de page.
  useEffect(() => {
    if (!vendor) return;
    (async () => {
      try { setAchievedToday(await store.getAchievementsForVendorDate(vendor.id, today)); }
      catch (e) { console.error("Chargement des paliers atteints impossible", e); setAchievedToday([]); }
    })();
  }, [vendor?.id, today]);

  // Détecte un nouveau palier atteint aujourd'hui : déclenche l'animation
  // côté vendeur et enregistre l'événement (la contrainte unique côté base
  // empêche tout doublon même si l'effet se rejoue).
  useEffect(() => {
    if (!vendor || allDays === null || achievedToday === null || !objectives) return;
    const daysToday = allDays.some((d) => d.date === today) ? allDays : [...allDays, day];
    const caAujourdhui = sumVendorOverRange(daysToday, vendor.id, [today, today]).ca;
    const reached = reachedPaliers(caAujourdhui, objectives);
    const nouveaux = reached.filter((p) => !achievedToday.includes(p));
    if (nouveaux.length === 0) return;
    (async () => {
      for (const palier of nouveaux) {
        await store.recordAchievement({ vendorId: vendor.id, vendorNom: vendor.nom, date: today, palier, montant: caAujourdhui });
      }
      setAchievedToday((prev) => [...(prev || []), ...nouveaux]);
      setCelebrate(nouveaux[nouveaux.length - 1]);
      setTimeout(() => setCelebrate(null), 3200);
    })();
  }, [vendor, allDays, day, today, objectives, achievedToday]);

  if (!vendor) return <EmptyState text="Compte non lié à un vendeur." />;

  if (allDays === null) {
    return <EmptyState text="Chargement de tes statistiques…" />;
  }

  // Inclut le jour courant (peut ne pas encore être dans daysList/allDays)
  const daysWithToday = allDays.some((d) => d.date === today) ? allDays : [...allDays, day];

  const caJour = sumVendorOverRange(daysWithToday, vendor.id, [today, today]);
  const caSemaine = sumVendorOverRange(daysWithToday, vendor.id, getCurrentWeekRange(today));
  const caMois = sumVendorOverRange(daysWithToday, vendor.id, getCurrentMonthRange(today));
  const caTotal = daysWithToday.reduce((s, d) => {
    const r = sumVendorOverRange([d], vendor.id, [d.date, d.date]);
    return s + r.ca;
  }, 0);

  const serie15j = buildVendorDailySeries(daysWithToday, vendor.id, today, 15);

  const bonusTotal = computeVendorBonusTotal(daysWithToday, vendor.id);
  const dejaDemande = (withdrawals || [])
    .filter((w) => w.vendorId === vendor.id && (w.statut === "en_attente" || w.statut === "approuve"))
    .reduce((s, w) => s + w.montant, 0);
  const soldeDisponible = Math.max(0, bonusTotal - dejaDemande);

  const mesRetraits = (withdrawals || []).filter((w) => w.vendorId === vendor.id).slice().reverse();
  const mesNotifications = (notifications || []).filter((n) => n.vendorId === vendor.id).slice().reverse();
  const nonLues = mesNotifications.filter((n) => !n.read);

  const demanderRetrait = async () => {
    const m = Number(withdrawAmount);
    setRequestError(""); setRequestOk(false);
    if (!m || m <= 0) { setRequestError("Indique un montant valide."); return; }
    if (m > soldeDisponible) { setRequestError("Ce montant dépasse ton solde disponible."); return; }
    if (withdrawMethod === "mobile" && !withdrawNumero.trim()) { setRequestError("Indique le numéro mobile qui recevra le paiement."); return; }
    const next = [...(withdrawals || []), {
      id: uid(), vendorId: vendor.id, vendorNom: vendor.nom, montant: m, date: today, statut: "en_attente",
      methode: withdrawMethod, numeroMobile: withdrawMethod === "mobile" ? withdrawNumero.trim() : null,
    }];
    await setWithdrawals(next);
    setWithdrawAmount(""); setWithdrawNumero("");
    setRequestOk(true);
  };

  const marquerLue = async (id) => {
    await setNotifications((notifications || []).map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div>
      <BirthdayBalloons />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#8A93A3", fontSize: 12.5 }}>
        <Eye size={14} /> Espace de consultation — tes ventes sont saisies par l'administration.
      </div>

      {mesNotifications.length > 0 && (
        <Card title={`Notifications${nonLues.length > 0 ? ` (${nonLues.length} nouvelle${nonLues.length > 1 ? "s" : ""})` : ""}`}>
          {mesNotifications.slice(0, 8).map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && marquerLue(n.id)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                padding: "10px 4px", borderBottom: "1px solid #F0F1F4", cursor: n.read ? "default" : "pointer",
                background: n.read ? "transparent" : "#FBF6EA",
              }}
            >
              <span style={{ fontSize: 13, color: "#1B2A4A", fontWeight: n.read ? 400 : 600 }}>{n.message}</span>
              {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D9A441", flexShrink: 0 }} />}
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="CHIFFRE D'AFFAIRES — AUJOURD'HUI" value={fmtMoney(caJour.ca)} sub={`${caJour.vendu} article(s) vendu(s)`} />
        <StatCard label="CHIFFRE D'AFFAIRES — CETTE SEMAINE" value={fmtMoney(caSemaine.ca)} />
        <StatCard label="CHIFFRE D'AFFAIRES — CE MOIS" value={fmtMoney(caMois.ca)} />
        <StatCard label="CHIFFRE D'AFFAIRES TOTAL CUMULÉ" value={fmtMoney(caTotal)} accent="#D9A441" />
      </div>

      {objectives && (objectives.minimal > 0 || objectives.maximal > 0 || objectives.extraordinaire > 0) && (
        <Card title="Objectif du jour">
          <ObjectiveProgressBar ca={caJour.ca} objectifs={objectives} celebrate={celebrate} />
        </Card>
      )}

      <Card title="Évolution sur les 15 derniers jours">
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie15j} margin={{ left: 0, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A93A3" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A93A3" }} />
              <Tooltip formatter={(v, n) => [n === "ca" ? fmtMoney(v) : v, n === "ca" ? "Chiffre d'affaires" : n === "vendu" ? "Vendu" : "Distribué"]} />
              <Line type="monotone" dataKey="ca" stroke="#D9A441" strokeWidth={2} dot={false} name="ca" />
              <Line type="monotone" dataKey="distribue" stroke="#1B2A4A" strokeWidth={1.5} dot={false} name="distribue" strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#5B6472" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#D9A441", borderRadius: 2, marginRight: 5 }} />Chiffre d'affaires</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1B2A4A", borderRadius: 2, marginRight: 5 }} />Quantité distribuée</span>
        </div>
      </Card>

      <Card title="Solde et retrait d'excédent">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: "#5B6472" }}>Solde d'excédent disponible</span>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Cambria, Georgia, serif", color: "#3F8361" }}>{fmtMoney(soldeDisponible)}</span>
        </div>
        {soldeDisponible > 0 ? (
          <div>
            <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={withdrawMethod === "especes"} onChange={() => setWithdrawMethod("especes")} />
                Recevoir en espèces
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={withdrawMethod === "mobile"} onChange={() => setWithdrawMethod("mobile")} />
                Recevoir par paiement mobile
              </label>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 140px" }}>
                <Label>Montant à retirer</Label>
                <TextInput type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0" />
              </div>
              {withdrawMethod === "mobile" && (
                <div style={{ flex: "1 1 160px" }}>
                  <Label>Numéro mobile de réception</Label>
                  <TextInput value={withdrawNumero} onChange={(e) => setWithdrawNumero(e.target.value)} placeholder="Ex. 6XX XX XX XX" />
                </div>
              )}
              <Button variant="gold" onClick={demanderRetrait}><ArrowDownToLine size={15} /> Demander un retrait</Button>
            </div>
          </div>
        ) : (
          <EmptyState text="Aucun excédent disponible pour le moment." />
        )}
        {requestError && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 10 }}>{requestError}</div>}
        {requestOk && <div style={{ color: "#3F8361", fontSize: 12.5, marginTop: 10 }}>Demande envoyée à l'administration. Tu recevras une notification une fois traitée.</div>}

        {mesRetraits.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <Table
              headers={["Date", "Montant", "Mode de paiement", "Statut"]}
              rows={mesRetraits.map((w) => [
                formatDateFR(w.date), fmtMoney(w.montant),
                w.methode === "mobile" ? `Mobile — ${w.numeroMobile}` : "Espèces",
                w.statut === "en_attente" ? (
                  <Badge key="b" ok={false} warnText="En attente" />
                ) : (
                  <Badge key="b" ok={w.statut === "approuve"} okText="Approuvé" warnText="Refusé" />
                ),
              ])}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

function Produits({ products, setProducts, reloadProducts }) {
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [stock, setStock] = useState("");
  const [categorie, setCategorie] = useState("");
  const [catEdits, setCatEdits] = useState({});

  const categoriesExistantes = Array.from(new Set(products.map((p) => p.categorie).filter(Boolean)));

  const add = async () => {
    if (!nom.trim() || !prix) return;
    const next = [...products, { id: uid(), nom: nom.trim(), prix: Number(prix), stock: Number(stock) || 0, categorie: categorie.trim() || "Général" }];
    await setProducts(next);
    setNom(""); setPrix(""); setStock(""); setCategorie("");
  };

  const remove = async (id) => { await setProducts(products.filter((p) => p.id !== id)); };

  const saveCategorie = async (id) => {
    const value = catEdits[id];
    if (value === undefined) return;
    await store.updateProductCategorie(id, value);
    setCatEdits((c) => { const n = { ...c }; delete n[id]; return n; });
    if (reloadProducts) await reloadProducts();
  };

  return (
    <div>
      <Card title="Ajouter un produit">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 200px" }}>
            <Label>Nom du produit</Label>
            <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Savon parfumé" />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <Label>Prix unitaire (F)</Label>
            <TextInput type="number" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="500" />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <Label>Stock initial</Label>
            <TextInput type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <Label>Catégorie / type</Label>
            <TextInput list="categories-existantes" value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Ex. Cosmétique" />
            <datalist id="categories-existantes">
              {categoriesExistantes.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <Button variant="primary" onClick={add}><Plus size={15} /> Ajouter</Button>
        </div>
      </Card>

      <Card title={`Catalogue (${products.length})`}>
        {products.length === 0 ? (
          <EmptyState text="Aucun produit pour le moment. Ajoute ton premier produit ci-dessus." />
        ) : (
          <Table
            headers={["Produit", "Catégorie", "Prix unitaire", "Stock actuel", ""]}
            rows={products.map((p) => [
              p.nom,
              <div key="c" style={{ display: "flex", gap: 6 }}>
                <TextInput
                  list="categories-existantes"
                  value={catEdits[p.id] !== undefined ? catEdits[p.id] : (p.categorie || "Général")}
                  onChange={(e) => setCatEdits((c) => ({ ...c, [p.id]: e.target.value }))}
                  onBlur={() => saveCategorie(p.id)}
                  style={{ minWidth: 130 }}
                />
              </div>,
              fmtMoney(p.prix), p.stock,
              <button key="del" onClick={() => remove(p.id)} style={iconBtnStyle}><Trash2 size={15} /></button>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

function Stock({ products, setProducts }) {
  const [adjust, setAdjust] = useState({});

  const reappro = async (id) => {
    const qty = Number(adjust[id]);
    if (!qty) return;
    const next = products.map((p) => (p.id === id ? { ...p, stock: Number(p.stock) + qty } : p));
    await setProducts(next);
    setAdjust((a) => ({ ...a, [id]: "" }));
  };

  if (products.length === 0) {
    return (
      <Card title="Niveaux de stock">
        <EmptyState text="Ajoute des produits dans l'onglet Produits pour gérer le stock." />
      </Card>
    );
  }

  const stockData = products.map((p) => ({ nom: p.nom, stock: Number(p.stock) || 0 }));

  const valueByCategory = {};
  products.forEach((p) => {
    const cat = p.categorie || "Général";
    valueByCategory[cat] = (valueByCategory[cat] || 0) + (Number(p.stock) || 0) * (Number(p.prix) || 0);
  });
  const categoryData = Object.entries(valueByCategory)
    .map(([categorie, valeur]) => ({ categorie, valeur }))
    .sort((a, b) => b.valeur - a.valeur);

  return (
    <div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: "1 1 340px" }}>
          <Card title="Niveau de stock par produit">
            <div style={{ height: Math.max(160, stockData.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nom" width={110} tick={{ fontSize: 12, fill: "#1B2A4A" }} />
                  <Tooltip formatter={(v) => `${v} unité(s)`} />
                  <Bar dataKey="stock" radius={[0, 6, 6, 0]} barSize={14}>
                    {stockData.map((d, i) => (
                      <Cell key={i} fill={d.stock <= 5 ? "#C1554A" : "#D9A441"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div style={{ flex: "1 1 280px" }}>
          <Card title="Valeur du stock par catégorie">
            <div style={{ height: Math.max(160, categoryData.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="categorie" width={110} tick={{ fontSize: 12, fill: "#1B2A4A" }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Bar dataKey="valeur" fill="#1B2A4A" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Niveaux de stock">
        <Table
          headers={["Produit", "Catégorie", "Stock actuel", "Statut", "Réapprovisionner"]}
          rows={products.map((p) => [
            p.nom, p.categorie || "Général", p.stock,
            <Badge key="b" ok={Number(p.stock) > 5} okText="OK" warnText="Faible" />,
            <div key="r" style={{ display: "flex", gap: 8 }}>
              <TextInput type="number" placeholder="Qté" style={{ width: 80 }} value={adjust[p.id] || ""} onChange={(e) => setAdjust((a) => ({ ...a, [p.id]: e.target.value }))} />
              <Button variant="gold" onClick={() => reappro(p.id)}>Ajouter</Button>
            </div>,
          ])}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendeurs & comptes
// ---------------------------------------------------------------------------

function Vendeurs({ vendors, reloadVendors, isAdmin, currentUser }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [numeroCni, setNumeroCni] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [telephone, setTelephone] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const addPhotoRef = useRef(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const [msgUsername, setMsgUsername] = useState("");
  const [msgPassword, setMsgPassword] = useState("");
  const [msgError, setMsgError] = useState("");
  const [msgBusy, setMsgBusy] = useState(false);

  const [vendorAccounts, setVendorAccounts] = useState([]);
  const [managers, setManagers] = useState([]);
  const [secondaryAdmins, setSecondaryAdmins] = useState([]);
  const [messengers, setMessengers] = useState([]);
  const [presence, setPresence] = useState({});

  const [ficheVendorId, setFicheVendorId] = useState(null);
  const [inviteUrls, setInviteUrls] = useState({}); // vendorId -> url
  const [inviteBusy, setInviteBusy] = useState(null);

  const generateInvite = async (vendorId) => {
    setInviteBusy(vendorId);
    try {
      const { url } = await store.createInviteLink({ vendorId, role: "vendor", createdBy: currentUser?.username });
      setInviteUrls((m) => ({ ...m, [vendorId]: url }));
    } catch (e) {
      setError(e.message || "Erreur lors de la création du lien.");
    }
    setInviteBusy(null);
  };

  const copyInvite = (url) => {
    navigator.clipboard?.writeText(url);
  };

  const reloadAccounts = async () => {
    const [va, ma, sa, ms, pr] = await Promise.all([
      store.getVendorAccounts(), store.getManagerAccounts(), store.getSecondaryAdmins(),
      store.getMessengerAccounts(), store.getVendorPresence(),
    ]);
    setVendorAccounts(va);
    setManagers(ma);
    setSecondaryAdmins(sa);
    setMessengers(ms);
    setPresence(pr);
  };

  useEffect(() => { reloadAccounts(); }, [vendors]);

  const addMessenger = async () => {
    if (!msgUsername.trim() || !msgPassword) { setMsgError("Indique un nom d'utilisateur et un mot de passe."); return; }
    if (msgPassword.length < 6) { setMsgError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setMsgError("");
    setMsgBusy(true);
    try {
      await store.createAccount({ username: msgUsername.trim(), password: msgPassword, role: "messenger" });
      await reloadAccounts();
      setMsgUsername(""); setMsgPassword("");
    } catch (e) {
      setMsgError(e.message || "Erreur lors de la création.");
    }
    setMsgBusy(false);
  };

  const removeMessenger = async (id) => {
    try {
      await store.deleteAccount(id);
      await reloadAccounts();
    } catch (e) {
      setMsgError(e.message || "Erreur lors de la suppression.");
    }
  };

  const add = async () => {
    if (!nom.trim()) { setError("Indique un nom de vendeur."); return; }
    if (username.trim() && !password) { setError("Indique un mot de passe pour ce compte."); return; }
    if (password && password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setError("");
    setBusy(true);
    try {
      const vendor = await store.addVendor({
        nom: nom.trim(),
        prenom: prenom.trim(),
        numeroCni: numeroCni.trim(),
        dateNaissance: dateNaissance || null,
        telephone: telephone.trim(),
      });
      if (photoFile) {
        try {
          await store.uploadVendorPhoto(vendor.id, photoFile);
        } catch (photoErr) {
          setError(`Vendeur créé, mais la photo n'a pas pu être envoyée : ${photoErr.message || photoErr}`);
        }
      }
      if (username.trim()) {
        await store.createAccount({ username: username.trim(), password, role: "vendor", vendorId: vendor.id });
      }
      await reloadVendors();
      await reloadAccounts();
      store.logActivity(currentUser, "add_vendor", `Vendeur ajouté : ${nom.trim()}.`);
      setNom(""); setPrenom(""); setNumeroCni(""); setDateNaissance(""); setTelephone(""); setUsername(""); setPassword("");
      setPhotoFile(null); setPhotoPreview("");
    } catch (e) {
      setError(e.message || "Erreur lors de la création.");
    }
    setBusy(false);
  };

  const remove = async (id, nomVendeur) => {
    const linkedAccount = vendorAccounts.find((u) => u.vendorId === id);
    try {
      if (linkedAccount) await store.deleteAccount(linkedAccount.id);
      await store.deleteVendor(id);
      await reloadVendors();
      await reloadAccounts();
      store.logActivity(currentUser, "delete_vendor", `Vendeur supprimé : ${nomVendeur}.`);
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression.");
    }
  };

  const convertToMessenger = async (accountId, nomVendeur) => {
    const ok = window.confirm(
      `Convertir ce compte (${nomVendeur}) en compte messagerie uniquement ?\n\n` +
      `Il perdra son accès au retour du soir et à toutes les autres données, et ne verra plus que la Messagerie. ` +
      `Le vendeur lui-même reste dans la liste (historique conservé), simplement sans compte de connexion lié.`
    );
    if (!ok) return;
    try {
      await store.convertVendorToMessenger(accountId);
      await reloadVendors();
      await reloadAccounts();
      store.logActivity(currentUser, "convert_to_messenger", `Compte converti en messagerie uniquement : ${nomVendeur}.`);
    } catch (e) {
      setError(e.message || "Erreur lors de la conversion.");
    }
  };

  // La création de comptes gestionnaire n'est plus proposée dans l'interface ;
  // cette fonction ne fait plus que permettre de retirer un compte existant.
  const removeManager = async (id, name) => {
    try {
      await store.deleteAccount(id);
      await reloadAccounts();
      store.logActivity(currentUser, "delete_manager", `Compte gestionnaire supprimé : ${name}.`);
    } catch (e) {
      setError(e.message || "Erreur lors de la suppression.");
    }
  };

  const addAdmin = async () => {
    if (!adminName.trim() || !adminPassword) { setAdminError("Remplis tous les champs."); return; }
    if (adminPassword.length < 6) { setAdminError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setAdminError("");
    setAdminBusy(true);
    try {
      await store.createAccount({ username: adminName.trim(), password: adminPassword, role: "admin" });
      await reloadAccounts();
      setAdminName(""); setAdminPassword("");
    } catch (e) {
      setAdminError(e.message || "Erreur lors de la création.");
    }
    setAdminBusy(false);
  };

  const removeAdmin = async (id) => {
    try {
      await store.deleteAccount(id);
      await reloadAccounts();
    } catch (e) {
      setAdminError(e.message || "Erreur lors de la suppression.");
    }
  };

  return (
    <div>
      <AttendanceBoard vendors={vendors} currentUser={currentUser} />

      <Card title="Ajouter un vendeur">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 180px" }}>
            <Label>Nom du vendeur</Label>
            <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Awa" />
          </div>
          <Button onClick={add} disabled={busy}><Plus size={15} /> {busy ? "Ajout…" : "Ajouter"}</Button>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0F1F4" }}>
          <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
            Informations complémentaires (facultatif)
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Prénom</Label>
              <TextInput value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Numéro CNI</Label>
              <TextInput value={numeroCni} onChange={(e) => setNumeroCni(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Date de naissance</Label>
              <TextInput type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Téléphone</Label>
              <TextInput value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex. 6XX XX XX XX" />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <Label>Photo</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: "#EEF0F4", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #D8DCE3",
                }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Users size={16} color="#B7BECB" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addPhotoRef.current?.click()}
                  style={{ ...iconBtnStyle, color: "#5B6472", border: "1px solid #D8DCE3", borderRadius: 8, padding: "8px 10px" }}
                >
                  <Camera size={15} />
                </button>
                <input
                  ref={addPhotoRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setPhotoFile(f);
                    setPhotoPreview(URL.createObjectURL(f));
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0F1F4" }}>
          <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
            Accès de connexion (facultatif) — laisse vide si ce vendeur n'a pas besoin de se connecter
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Nom d'utilisateur</Label>
              <TextInput value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Mot de passe</Label>
              <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        </div>
        {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </Card>

      <Card title={`Équipe (${vendors.length})`}>
        {vendors.length === 0 ? (
          <EmptyState text="Aucun vendeur enregistré." />
        ) : (
          <Table
            headers={["Nom", "CNI", "Téléphone", "Compte de connexion", "Présence", "", "", ""]}
            rows={vendors.map((v) => {
              const u = vendorAccounts.find((u) => u.vendorId === v.id);
              const p = presence[v.id];
              const invite = inviteUrls[v.id];
              return [
                v.nom, v.numeroCni || "—", v.telephone || "—",
                u ? u.username : "— aucun —",
                u ? <PresenceDot key="p" isOnline={p?.isOnline} lastSeenAt={p?.lastSeenAt} showLabel /> : "—",
                <button key="fiche" onClick={() => setFicheVendorId(v.id)} title="Voir la fiche détaillée" style={{ ...iconBtnStyle, color: "#5B6472" }}>
                  <Eye size={15} />
                </button>,
                u ? (
                  <button key="conv" onClick={() => convertToMessenger(u.id, v.nom)} title="Passer en compte messagerie uniquement" style={{ ...iconBtnStyle, color: "#5B6472" }}>
                    <MessageSquare size={15} />
                  </button>
                ) : invite ? (
                  <button key="copy" onClick={() => copyInvite(invite)} title="Copier le lien d'invitation" style={{ ...iconBtnStyle, color: "#3F9C6D" }}>
                    <Link2 size={15} />
                  </button>
                ) : (
                  <button key="invite" onClick={() => generateInvite(v.id)} disabled={inviteBusy === v.id} title="Générer un lien d'invitation pour ce vendeur" style={{ ...iconBtnStyle, color: "#C79A3A" }}>
                    <Send size={15} />
                  </button>
                ),
                <button key="del" onClick={() => remove(v.id, v.nom)} style={iconBtnStyle}><Trash2 size={15} /></button>,
              ];
            })}
          />
        )}
        {Object.keys(inviteUrls).length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: "#8A93A3" }}>
            Clique l'icône <Link2 size={11} style={{ verticalAlign: "middle" }} /> pour copier le lien d'un vendeur et le lui envoyer (WhatsApp, SMS…) : il choisira lui-même son nom d'utilisateur et son mot de passe.
          </div>
        )}
      </Card>

      {ficheVendorId && (
        <VendorFiche
          vendor={vendors.find((v) => v.id === ficheVendorId)}
          onClose={() => setFicheVendorId(null)}
          currentUser={currentUser}
        />
      )}

      {isAdmin && (
        <>
        {managers.length > 0 && (
          <Card title="Comptes gestionnaires (Finances / Manager)">
            <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
              Un gestionnaire a accès au Tableau de bord, aux Finances (Caisse), au Stock et au Personnel — rien d'autre.
              La création de nouveaux comptes gestionnaire n'est plus proposée ici.
            </div>
            <Table
              headers={["Nom d'utilisateur", ""]}
              rows={managers.map((m) => [
                m.username,
                <button key="del" onClick={() => removeManager(m.id, m.username)} style={iconBtnStyle}><Trash2 size={15} /></button>,
              ])}
            />
          </Card>
        )}

        <Card title="Comptes agent messagerie">
          <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
            Un accès strictement limité à la Messagerie — aucune autre donnée n'est visible ni modifiable.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Nom d'utilisateur</Label>
              <TextInput value={msgUsername} onChange={(e) => setMsgUsername(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Mot de passe</Label>
              <TextInput type="password" value={msgPassword} onChange={(e) => setMsgPassword(e.target.value)} />
            </div>
            <Button onClick={addMessenger} disabled={msgBusy}><Plus size={15} /> {msgBusy ? "Création…" : "Créer le compte"}</Button>
          </div>
          {msgError && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 10 }}>{msgError}</div>}

          {messengers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Table
                headers={["Nom d'utilisateur", ""]}
                rows={messengers.map((m) => [
                  m.username,
                  <button key="del" onClick={() => removeMessenger(m.id)} style={iconBtnStyle}><Trash2 size={15} /></button>,
                ])}
              />
            </div>
          )}
        </Card>
        </>
      )}

      {currentUser?.isPrimary && (
        <Card title="Comptes administrateurs secondaires">
          <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
            Un administrateur secondaire a exactement les mêmes accès que toi. Ses connexions et ses
            actions importantes sont enregistrées dans le Journal d'activité, visible seulement par toi.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Nom d'utilisateur</Label>
              <TextInput value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Mot de passe</Label>
              <TextInput type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            </div>
            <Button onClick={addAdmin} disabled={adminBusy}><Plus size={15} /> {adminBusy ? "Création…" : "Créer le compte"}</Button>
          </div>
          {adminError && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 10 }}>{adminError}</div>}

          {secondaryAdmins.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Table
                headers={["Nom d'utilisateur", ""]}
                rows={secondaryAdmins.map((a) => [
                  a.username,
                  <button key="del" onClick={() => removeAdmin(a.id)} style={iconBtnStyle}><Trash2 size={15} /></button>,
                ])}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pointage du jour — toute l'équipe d'un coup, avec possibilité de corriger
// une date passée.
// ---------------------------------------------------------------------------

function AttendanceBoard({ vendors, currentUser }) {
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState({}); // vendorId -> { statut, notes }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const rows = await store.getAttendanceForDate(date);
      const map = {};
      rows.forEach((r) => { map[r.vendorId] = { statut: r.statut, notes: r.notes || "" }; });
      setEntries(map);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement.");
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [date, open]);

  const setStatut = (vendorId, statut) => {
    setEntries((m) => ({ ...m, [vendorId]: { ...(m[vendorId] || { notes: "" }), statut } }));
  };
  const setNotes = (vendorId, notes) => {
    setEntries((m) => ({ ...m, [vendorId]: { ...(m[vendorId] || { statut: "present" }), notes } }));
  };
  const markAllPresent = () => {
    const map = {};
    vendors.forEach((v) => { map[v.id] = { statut: "present", notes: entries[v.id]?.notes || "" }; });
    setEntries(map);
  };

  const save = async () => {
    const toSave = vendors
      .filter((v) => entries[v.id]?.statut)
      .map((v) => ({ vendorId: v.id, statut: entries[v.id].statut, notes: entries[v.id].notes }));
    if (toSave.length === 0) { setError("Marque au moins un vendeur avant d'enregistrer."); return; }
    setSaving(true);
    setError("");
    try {
      await store.setVendorAttendanceBulk(date, toSave);
      setSaved(true);
      store.logActivity(currentUser, "set_attendance_bulk", `Pointage du ${fmtDateFr(date)} enregistré pour ${toSave.length} vendeur(s).`);
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement.");
    }
    setSaving(false);
  };

  return (
    <Card
      title="Pointage du jour"
      right={<button onClick={() => setOpen((o) => !o)} style={{ ...iconBtnStyle, color: "#5B6472" }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}
    >
      {!open ? (
        <div style={{ fontSize: 12.5, color: "#8A93A3", fontStyle: "italic" }}>Ouvrir pour pointer présence/absence de toute l'équipe.</div>
      ) : vendors.length === 0 ? (
        <EmptyState text="Ajoute d'abord un vendeur." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: "0 1 180px" }}>
              <Label>Date</Label>
              <TextInput type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button variant="gold" onClick={markAllPresent}>Marquer tous présents</Button>
          </div>

          {loading ? (
            <div style={{ fontSize: 12.5, color: "#9AA2B1" }}>Chargement…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vendors.map((v) => {
                const e = entries[v.id] || { statut: null, notes: "" };
                return (
                  <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingBottom: 10, borderBottom: "1px solid #F3F4F7" }}>
                    <div style={{ width: 140, fontWeight: 600, fontSize: 13.5, color: "#1B2A4A" }}>{v.nom}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {Object.entries(STATUT_LABELS).map(([key, { label, color }]) => (
                        <button
                          key={key}
                          onClick={() => setStatut(v.id, key)}
                          style={{
                            padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${e.statut === key ? color : "#D8DCE3"}`,
                            background: e.statut === key ? color : "#fff",
                            color: e.statut === key ? "#fff" : "#5B6472",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <TextInput placeholder="Note (facultatif)" value={e.notes} onChange={(ev) => setNotes(v.id, ev.target.value)} style={{ flex: "1 1 160px", maxWidth: 220 }} />
                  </div>
                );
              })}
            </div>
          )}

          {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
          {saved && <div style={{ color: "#3F9C6D", fontSize: 12.5, marginTop: 12 }}>Pointage enregistré.</div>}
          <Button variant="primary" onClick={save} disabled={saving} style={{ marginTop: 14 }}>
            {saving ? "Enregistrement…" : `Enregistrer le pointage du ${fmtDateFr(date)}`}
          </Button>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fiche vendeur détaillée (photo, infos, pointage, présences/absences)
// ---------------------------------------------------------------------------

function fmtDateFr(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUT_LABELS = {
  present: { label: "Présent", color: "#3F9C6D" },
  absent_autorise: { label: "Absence autorisée", color: "#C79A3A" },
  absent_non_autorise: { label: "Absence non autorisée", color: "#C1554A" },
};

function VendorFiche({ vendor, onClose, currentUser }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(vendor?.photoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [statut, setStatut] = useState("present");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const today = todayISO();

  const load = async () => {
    setLoading(true);
    const h = await store.getVendorAttendanceHistory(vendor.id);
    setHistory(h);
    const t = h.find((a) => a.date === today);
    if (t) { setStatut(t.statut); setNotes(t.notes || ""); }
    setLoading(false);
  };

  useEffect(() => { if (vendor) load(); }, [vendor?.id]);

  if (!vendor) return null;

  const presentCount = history.filter((a) => a.statut === "present").length;
  const absAutorise = history.filter((a) => a.statut === "absent_autorise").length;
  const absNonAutorise = history.filter((a) => a.statut === "absent_non_autorise").length;

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await store.uploadVendorPhoto(vendor.id, file);
      setPhotoUrl(url);
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi de la photo.");
    }
    setUploading(false);
  };

  const saveAttendance = async () => {
    setSaving(true);
    setError("");
    try {
      await store.setVendorAttendance({ vendorId: vendor.id, date: today, statut, notes });
      await load();
      store.logActivity(currentUser, "set_attendance", `Présence du ${fmtDateFr(today)} pour ${vendor.nom} : ${STATUT_LABELS[statut].label}.`);
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement.");
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(27,42,74,0.55)", zIndex: 200,
      display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px",
    }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 640, width: "100%", padding: 24, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "#8A93A3" }}>
          <X size={20} />
        </button>

        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 20 }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 84, height: 84, borderRadius: "50%", background: "#EEF0F4", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #D9A441",
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt={vendor.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Users size={32} color="#B7BECB" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Changer la photo"
              style={{
                position: "absolute", bottom: -2, right: -2, background: "#1B2A4A", borderRadius: "50%",
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff", cursor: "pointer",
              }}
            >
              <Camera size={13} color="#fff" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} style={{ display: "none" }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontFamily: "Cambria, Georgia, serif", fontSize: 21, color: "#1B2A4A" }}>{vendor.nom}</h2>
            <div style={{ fontSize: 12.5, color: "#8A93A3", marginTop: 4 }}>
              {vendor.numeroCni ? `CNI ${vendor.numeroCni}` : "CNI non renseigné"} · {vendor.telephone || "téléphone non renseigné"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: "1 1 140px" }}>
            <Label>Date de naissance</Label>
            <div style={{ fontSize: 13.5, color: "#1B2A4A" }}>{fmtDateFr(vendor.dateNaissance)}</div>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <Label>Date d'enregistrement</Label>
            <div style={{ fontSize: 13.5, color: "#1B2A4A" }}>
              {fmtDateFr(vendor.dateEnregistrement)}
              <span style={{ display: "block", fontSize: 11, color: "#9AA2B1", fontStyle: "italic" }}>sert de repère informatif — n'affecte pas les calculs de bonus</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, textAlign: "center", background: "#F3FAF6", borderRadius: 10, padding: "10px 6px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#3F9C6D" }}>{presentCount}</div>
            <div style={{ fontSize: 11, color: "#5B6472" }}>jours présents</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: "#FBF6EA", borderRadius: 10, padding: "10px 6px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#C79A3A" }}>{absAutorise}</div>
            <div style={{ fontSize: 11, color: "#5B6472" }}>absences autorisées</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: "#FBF0EE", borderRadius: 10, padding: "10px 6px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#C1554A" }}>{absNonAutorise}</div>
            <div style={{ fontSize: 11, color: "#5B6472" }}>absences non autorisées</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginBottom: 16 }}>
          <Label>Pointage d'aujourd'hui ({fmtDateFr(today)})</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.entries(STATUT_LABELS).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => setStatut(key)}
                style={{
                  padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${statut === key ? color : "#D8DCE3"}`,
                  background: statut === key ? color : "#fff",
                  color: statut === key ? "#fff" : "#5B6472",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <TextInput placeholder="Note (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 10 }} />
          <Button variant="primary" onClick={saveAttendance} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le pointage"}</Button>
        </div>

        {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16 }}>
          <Label>Historique récent</Label>
          {loading ? (
            <div style={{ fontSize: 12.5, color: "#9AA2B1" }}>Chargement…</div>
          ) : history.length === 0 ? (
            <EmptyState text="Aucun pointage enregistré pour l'instant." />
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              <Table
                headers={["Date", "Statut", "Note"]}
                rows={history.map((a) => [
                  fmtDateFr(a.date),
                  <span key="s" style={{ color: STATUT_LABELS[a.statut]?.color, fontWeight: 600 }}>{STATUT_LABELS[a.statut]?.label || a.statut}</span>,
                  a.notes || "—",
                ])}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Petite en-tête réutilisable (photo + nom + CNI/téléphone) affichée partout
// où un admin voit un vendeur en contexte : retour du soir, messagerie.
function VendorMiniHeader({ vendor }) {
  if (!vendor) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%", background: "#EEF0F4", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid #D9A441",
      }}>
        {vendor.photoUrl ? (
          <img src={vendor.photoUrl} alt={vendor.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Users size={16} color="#B7BECB" />
        )}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A" }}>{vendor.nom}</div>
        <div style={{ fontSize: 11, color: "#8A93A3" }}>
          {vendor.numeroCni ? `CNI ${vendor.numeroCni}` : ""}{vendor.numeroCni && vendor.telephone ? " · " : ""}{vendor.telephone || ""}
        </div>
      </div>
    </div>
  );
}

// Petite fête de ballons pour les anniversaires du jour — visible sur le
// tableau de bord de tout le monde (admin, gestionnaire, vendeurs).
function BirthdayBalloons() {
  const [birthdays, setBirthdays] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    store.getTodaysBirthdays().then(setBirthdays).catch(() => setBirthdays([]));
  }, []);

  if (dismissed || birthdays.length === 0) return null;

  const colors = ["#D9A441", "#C1554A", "#3F9C6D", "#4A7FC7", "#B564C1"];

  return (
    <div style={{
      position: "relative", borderRadius: 14, padding: "18px 22px", marginBottom: 20, overflow: "hidden",
      background: "linear-gradient(135deg, #1B2A4A, #2E3F66)", color: "#fff",
    }}>
      <button onClick={() => setDismissed(true)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#fff", opacity: 0.7, cursor: "pointer" }}>
        <X size={16} />
      </button>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", bottom: -40, left: `${(i * 53) % 100}%`,
            width: 22, height: 28, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: colors[i % colors.length], opacity: 0.85,
            animation: `z2t-balloon-rise ${5 + (i % 5)}s linear ${i * 0.35}s infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes z2t-balloon-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0.9; }
          100% { transform: translateY(-420px) translateX(${Math.random() > 0.5 ? "" : "-"}30px); opacity: 0; }
        }
      `}</style>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        <Cake size={26} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15.5, fontFamily: "Cambria, Georgia, serif" }}>
            🎉 Joyeux anniversaire {birthdays.map((b) => b.nom).join(", ")} !
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Toute l'équipe Z2T te souhaite une merveilleuse journée.</div>
        </div>
      </div>
    </div>
  );
}



function Distribution({ products, setProducts, vendors, day, setDay }) {
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [quantities, setQuantities] = useState({}); // productId -> qté à ajouter (string)
  const [editValues, setEditValues] = useState({}); // ligneId -> nouvelle quantité totale (string)
  const [error, setError] = useState("");

  useEffect(() => { setQuantities({}); setEditValues({}); setError(""); }, [selectedVendorId]);

  const vendor = vendors.find((v) => v.id === selectedVendorId) || null;

  // Lignes de ce vendeur pas encore retournées ce soir : c'est "ce qu'il a déjà en main"
  const vendorPendingLines = vendor
    ? day.lines.filter((l) => l.vendorId === vendor.id && l.quantiteRestante === null)
    : [];

  const dejaRemisPourProduit = (productId) =>
    vendorPendingLines.filter((l) => l.productId === productId).reduce((s, l) => s + (l.quantiteRemise || 0), 0);

  const setQty = (productId, val) => setQuantities((q) => ({ ...q, [productId]: val }));

  // Remettre de nouveaux produits : si le vendeur a déjà une remise en attente pour ce
  // produit, on l'incrémente au lieu de créer une deuxième ligne en double.
  const remettreTout = async () => {
    if (!vendor) return;
    setError("");
    const aRemettre = products
      .map((p) => ({ product: p, qty: Number(quantities[p.id]) }))
      .filter(({ qty }) => qty > 0);
    if (aRemettre.length === 0) return;

    const manque = aRemettre.find(({ product, qty }) => qty > product.stock);
    if (manque) { setError(`Stock insuffisant pour ${manque.product.nom} (disponible : ${manque.product.stock}).`); return; }

    const nextLines = [...day.lines];
    const decrements = {};
    aRemettre.forEach(({ product, qty }) => {
      decrements[product.id] = (decrements[product.id] || 0) + qty;
      const idx = nextLines.findIndex((l) => l.vendorId === vendor.id && l.productId === product.id && l.quantiteRestante === null);
      if (idx >= 0) {
        nextLines[idx] = { ...nextLines[idx], quantiteRemise: nextLines[idx].quantiteRemise + qty };
      } else {
        nextLines.push({
          id: uid(), vendorId: vendor.id, vendorNom: vendor.nom, productId: product.id, productNom: product.nom, prix: product.prix,
          quantiteRemise: qty, quantiteRestante: null, quantiteVendue: null, montantAttendu: null,
        });
      }
    });

    await setDay({ ...day, lines: nextLines });
    await setProducts(products.map((p) => (decrements[p.id] ? { ...p, stock: p.stock - decrements[p.id] } : p)));
    setQuantities({});
  };

  // Modifier directement une ligne déjà remise (correction d'erreur de saisie)
  const modifierLigne = async (line) => {
    const raw = editValues[line.id];
    if (raw === undefined || raw === "") return;
    const newQty = Number(raw);
    if (Number.isNaN(newQty) || newQty < 0) return;
    const delta = newQty - line.quantiteRemise; // >0 : on prend plus de stock ; <0 : on en rend
    const product = products.find((p) => p.id === line.productId);
    if (delta > 0 && product && delta > product.stock) { setError(`Stock insuffisant pour ${line.productNom}.`); return; }
    setError("");
    const nextLines = day.lines.map((l) => (l.id === line.id ? { ...l, quantiteRemise: newQty } : l));
    await setDay({ ...day, lines: nextLines });
    if (product) await setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: p.stock - delta } : p)));
    setEditValues((s) => { const c = { ...s }; delete c[line.id]; return c; });
  };

  // Annuler une distribution (remet le stock au produit)
  const supprimerLigne = async (line) => {
    const nextLines = day.lines.filter((l) => l.id !== line.id);
    await setDay({ ...day, lines: nextLines });
    const product = products.find((p) => p.id === line.productId);
    if (product) await setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: p.stock + line.quantiteRemise } : p)));
  };

  return (
    <div>
      <Card title="Choisir un vendeur">
        {vendors.length === 0 ? (
          <EmptyState text="Ajoute d'abord un vendeur dans l'onglet Vendeurs & comptes." />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {vendors.map((v) => {
              const active = v.id === selectedVendorId;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVendorId(v.id)}
                  style={{
                    padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                    border: `1.5px solid ${active ? "#D9A441" : "#D8DCE3"}`,
                    background: active ? "rgba(217,164,65,0.12)" : "#fff",
                    color: active ? "#8A6D1F" : "#1B2A4A",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                  }}
                >
                  {v.nom}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {vendor && (
        <Card title={`Produits à remettre à ${vendor.nom}`}>
          {products.length === 0 ? (
            <EmptyState text="Ajoute d'abord un produit dans l'onglet Produits." />
          ) : (
            <>
              <Table
                headers={["Produit", "Stock disponible", "Déjà remis aujourd'hui", "Quantité à ajouter"]}
                rows={products.map((p) => [
                  p.nom, p.stock, dejaRemisPourProduit(p.id) || "—",
                  <TextInput
                    key="q" type="number" min="0" max={p.stock} style={{ width: 100 }}
                    placeholder="0" value={quantities[p.id] || ""}
                    onChange={(e) => setQty(p.id, e.target.value)}
                  />,
                ])}
              />
              {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
              <Button variant="primary" onClick={remettreTout} style={{ marginTop: 14 }}>
                <Truck size={15} /> Valider la distribution
              </Button>
            </>
          )}
        </Card>
      )}

      {vendor && vendorPendingLines.length > 0 && (
        <Card title={`Produits déjà remis à ${vendor.nom} (en attente de retour)`}>
          <Table
            headers={["Produit", "Quantité remise", "Nouvelle quantité", ""]}
            rows={vendorPendingLines.map((l) => [
              l.productNom,
              l.quantiteRemise,
              <TextInput
                key="e" type="number" min="0" style={{ width: 90 }}
                placeholder={String(l.quantiteRemise)}
                value={editValues[l.id] ?? ""}
                onChange={(e) => setEditValues((s) => ({ ...s, [l.id]: e.target.value }))}
              />,
              <div key="actions" style={{ display: "flex", gap: 6 }}>
                <Button variant="ghost" onClick={() => modifierLigne(l)} style={{ padding: "6px 10px", fontSize: 12.5 }}>Enregistrer</Button>
                <button onClick={() => supprimerLigne(l)} title="Annuler cette distribution" style={iconBtnStyle}><Trash2 size={14} /></button>
              </div>,
            ])}
          />
        </Card>
      )}

      <Card title="Distributions du jour">
        {day.lines.length === 0 ? (
          <EmptyState text="Aucune distribution enregistrée aujourd'hui." />
        ) : (
          <Table
            headers={["Vendeur", "Produit", "Qté remise", "Statut"]}
            rows={day.lines.map((l) => [
              l.vendorNom, l.productNom, l.quantiteRemise,
              <Badge key="b" ok={l.quantiteRestante !== null} okText="Retour fait" warnText="En cours" />,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retour du soir — tous les produits d'un vendeur d'un coup, + versement
// ---------------------------------------------------------------------------

function RetourDuSoir({ isAdmin, vendors, products, setProducts, day, setDay, activeVendor }) {
  const [selectedVendorId, setSelectedVendorId] = useState(isAdmin ? "" : (activeVendor?.id || ""));
  const [pendingInputs, setPendingInputs] = useState({});
  const [mobileOn, setMobileOn] = useState(false);
  const [mobileNumero, setMobileNumero] = useState("");
  const [mobileMontant, setMobileMontant] = useState("");
  const [montantVerseInput, setMontantVerseInput] = useState("");

  const vendor = isAdmin ? vendors.find((v) => v.id === selectedVendorId) : activeVendor;

  useEffect(() => {
    setPendingInputs({});
    setMobileNumero("");
    setMobileMontant("");
    if (vendor) {
      const summary = computeVersementSummary(day, vendor.id);
      setMobileOn(summary.mobilePayments.length > 0);
      setMontantVerseInput(summary.montantVerseEspeces !== null ? String(summary.montantVerseEspeces) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id]);

  if (isAdmin && vendors.length === 0) {
    return <Card title="Retour du soir"><EmptyState text="Ajoute d'abord un vendeur dans l'onglet Vendeurs & comptes." /></Card>;
  }
  if (!isAdmin && !vendor) {
    return <Card title="Retour du soir"><EmptyState text="Aucun vendeur sélectionné." /></Card>;
  }

  const lines = vendor ? day.lines.filter((l) => l.vendorId === vendor.id) : [];
  const pending = lines.filter((l) => l.quantiteRestante === null);
  const done = lines.filter((l) => l.quantiteRestante !== null);
  const summary = vendor ? computeVersementSummary(day, vendor.id) : null;

  const validerTout = async () => {
    if (!isAdmin) return;
    let changed = false;
    const stockIncrements = {};
    const nextLines = day.lines.map((l) => {
      if (l.vendorId !== vendor.id || l.quantiteRestante !== null) return l;
      const val = pendingInputs[l.id];
      if (val === undefined || val === "") return l;
      const restante = Number(val);
      if (Number.isNaN(restante)) return l;
      changed = true;
      const vendue = Math.max(0, l.quantiteRemise - restante);
      if (restante > 0) stockIncrements[l.productId] = (stockIncrements[l.productId] || 0) + restante;
      return { ...l, quantiteRestante: restante, quantiteVendue: vendue, montantAttendu: vendue * l.prix };
    });
    if (!changed) return;
    await setDay({ ...day, lines: nextLines });
    if (Object.keys(stockIncrements).length > 0) {
      const nextProducts = products.map((p) => (stockIncrements[p.id] ? { ...p, stock: p.stock + stockIncrements[p.id] } : p));
      await setProducts(nextProducts);
    }
    setPendingInputs({});
  };

  const addMobilePayment = async () => {
    if (!isAdmin) return;
    const montant = Number(mobileMontant);
    if (!mobileNumero.trim() || !montant) return;
    const versements = { ...(day.versements || {}) };
    const current = versements[vendor.id] || { mobilePayments: [], montantVerseEspeces: null };
    versements[vendor.id] = { ...current, mobilePayments: [...(current.mobilePayments || []), { id: uid(), numero: mobileNumero.trim(), montant }] };
    await setDay({ ...day, versements });
    setMobileNumero(""); setMobileMontant("");
  };

  const removeMobilePayment = async (id) => {
    if (!isAdmin) return;
    const versements = { ...(day.versements || {}) };
    const current = versements[vendor.id] || { mobilePayments: [], montantVerseEspeces: null };
    versements[vendor.id] = { ...current, mobilePayments: (current.mobilePayments || []).filter((m) => m.id !== id) };
    await setDay({ ...day, versements });
  };

  const enregistrerVersement = async () => {
    if (!isAdmin) return;
    const montant = Number(montantVerseInput);
    if (Number.isNaN(montant) || montantVerseInput === "") return;
    const versements = { ...(day.versements || {}) };
    const current = versements[vendor.id] || { mobilePayments: [], montantVerseEspeces: null };
    versements[vendor.id] = { ...current, montantVerseEspeces: montant };
    await setDay({ ...day, versements });
  };

  return (
    <div>
      {!isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#8A93A3", fontSize: 12.5 }}>
          <Eye size={14} /> Espace de consultation — seul l'administrateur peut saisir ou modifier ces informations.
        </div>
      )}

      <Card title="Retour du soir">
        {isAdmin ? (
          <div>
            <Label>Choisir un vendeur</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {vendors.map((v) => {
                const active = v.id === selectedVendorId;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendorId(v.id)}
                    style={{
                      padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                      border: `1.5px solid ${active ? "#D9A441" : "#D8DCE3"}`,
                      background: active ? "rgba(217,164,65,0.12)" : "#fff",
                      color: active ? "#8A6D1F" : "#1B2A4A",
                      fontSize: 13, fontWeight: active ? 700 : 500,
                    }}
                  >
                    {v.nom}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A" }}>Vendeur : {vendor.nom}</div>
        )}
        {isAdmin && vendor && <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0F1F4" }}><VendorMiniHeader vendor={vendor} /></div>}
      </Card>

      {!vendor ? (
        <Card title="Produits distribués aujourd'hui">
          <EmptyState text="Choisis un vendeur ci-dessus pour voir ses produits à retourner." />
        </Card>
      ) : (
        <Card title={`Produits distribués à ${vendor.nom} aujourd'hui`}>
          {pending.length === 0 ? (
            <EmptyState text="Aucun retour en attente pour ce vendeur." />
          ) : isAdmin ? (
            <>
              <Table
                headers={["Produit", "Remis le matin", "Restant ce soir"]}
                rows={pending.map((l) => [
                  l.productNom, l.quantiteRemise,
                  <TextInput key="i" type="number" style={{ width: 100 }} placeholder="Qté" value={pendingInputs[l.id] || ""} onChange={(e) => setPendingInputs((s) => ({ ...s, [l.id]: e.target.value }))} />,
                ])}
              />
              <Button variant="gold" onClick={validerTout} style={{ marginTop: 14 }}>Valider tous les retours saisis</Button>
            </>
          ) : (
            <>
              <Table headers={["Produit", "Remis le matin"]} rows={pending.map((l) => [l.productNom, l.quantiteRemise])} />
              <div style={{ marginTop: 12, fontSize: 12.5, color: "#8A93A3", fontStyle: "italic" }}>En attente de traitement par l'administration.</div>
            </>
          )}
        </Card>
      )}

      {done.length > 0 && (
        <Card title={`Retours déjà enregistrés pour ${vendor.nom}`}>
          <Table
            headers={["Produit", "Remis", "Restant", "Vendu", "Montant attendu", "Stock"]}
            rows={done.map((l) => [
              l.productNom, l.quantiteRemise, l.quantiteRestante, l.quantiteVendue, fmtMoney(l.montantAttendu),
              l.quantiteRestante > 0 ? (
                <span key="s" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#3F8361" }}>
                  <RotateCcw size={12} /> {l.quantiteRestante} retour au stock
                </span>
              ) : "—",
            ])}
          />
        </Card>
      )}

      {done.length > 0 && (
        <Card title="Versement">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 13.5, color: "#5B6472" }}>Total attendu (ventes du jour)</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1B2A4A" }}>{fmtMoney(summary.montantAttendu)}</span>
          </div>

          {isAdmin ? (
            <Toggle on={mobileOn} onChange={setMobileOn} label="Paiement mobile reçu sur le terrain ?" />
          ) : (
            <div style={{ fontSize: 13.5, color: "#5B6472" }}>
              Paiement mobile reçu : <strong style={{ color: "#1B2A4A" }}>{summary.mobilePayments.length > 0 ? "Oui" : "Non"}</strong>
            </div>
          )}

          {(isAdmin ? mobileOn : summary.mobilePayments.length > 0) && (
            <div style={{ marginTop: 14 }}>
              {summary.mobilePayments.length > 0 && (
                <Table
                  headers={isAdmin ? ["Numéro mobile", "Montant", ""] : ["Numéro mobile", "Montant"]}
                  rows={summary.mobilePayments.map((m) => (
                    isAdmin
                      ? [m.numero, fmtMoney(m.montant), <button key="del" onClick={() => removeMobilePayment(m.id)} style={iconBtnStyle}><Trash2 size={14} /></button>]
                      : [m.numero, fmtMoney(m.montant)]
                  ))}
                />
              )}
              {isAdmin && (
                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 160px" }}>
                    <Label>Numéro mobile</Label>
                    <TextInput value={mobileNumero} onChange={(e) => setMobileNumero(e.target.value)} placeholder="Ex. 6XX XX XX XX" />
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <Label>Montant reçu</Label>
                    <TextInput type="number" value={mobileMontant} onChange={(e) => setMobileMontant(e.target.value)} placeholder="0" />
                  </div>
                  <Button variant="ghost" onClick={addMobilePayment} style={{ borderColor: "#D9A441", color: "#1B2A4A" }}><Smartphone size={14} /> Ajouter</Button>
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 13, color: "#5B6472" }}>
                Total paiement mobile : <strong style={{ color: "#1B2A4A" }}>{fmtMoney(summary.totalMobile)}</strong>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", margin: "16px 0", paddingTop: 14, borderTop: "1px solid #F0F1F4" }}>
            <span style={{ fontSize: 13.5, color: "#5B6472" }}>Montant à verser en espèces</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1B2A4A", fontFamily: "Cambria, Georgia, serif" }}>{fmtMoney(summary.montantAVerserEspeces)}</span>
          </div>

          {isAdmin ? (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 160px" }}>
                <Label>Montant réellement remis en espèces</Label>
                <TextInput type="number" value={montantVerseInput} onChange={(e) => setMontantVerseInput(e.target.value)} placeholder="0" />
              </div>
              <Button onClick={enregistrerVersement}>Enregistrer le versement</Button>
            </div>
          ) : (
            !summary.finalise && <div style={{ fontSize: 12.5, color: "#8A93A3", fontStyle: "italic" }}>En attente de saisie du versement par l'administration.</div>
          )}

          {summary.finalise && (
            <div
              style={{
                marginTop: 18, padding: "14px 16px", borderRadius: 10,
                background: summary.statut === "manque" ? "#FBECEA" : "#EAF4EE",
                border: `1px solid ${summary.statut === "manque" ? "#F0CFC9" : "#CDE7D6"}`,
              }}
            >
              <div style={{ fontSize: 12.5, color: "#5B6472", fontWeight: 600, marginBottom: 4 }}>ÉCART DE VERSEMENT</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Cambria, Georgia, serif", color: summary.statut === "manque" ? "#C1554A" : "#3F8361" }}>
                {summary.ecart > 0 ? "+" : ""}{fmtMoney(summary.ecart)}
              </div>
              <div style={{ fontSize: 12.5, color: "#5B6472", marginTop: 4 }}>
                {summary.statut === "manque" && "Manquant — ce montant sera déduit du salaire du vendeur."}
                {summary.statut === "exces" && "Excédent — ce montant sera enregistré comme bonus à verser au vendeur."}
                {summary.statut === "equilibre" && "Versement équilibré, aucun écart."}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Caisse — total espèces / mobile par vendeur, dépenses, totaux du jour
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Messagerie — discussion admin/gestionnaire ↔ vendeur (un fil par vendeur)
// ---------------------------------------------------------------------------

function timeShort(iso) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ROLE_GROUP_LABEL = { admin: "Administrateurs", manager: "Gestionnaires", vendor: "Vendeurs", messenger: "Agents messagerie" };

function Messagerie({ currentUser, vendors = [] }) {
  const [users, setUsers] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [text, setText] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const reloadDirectory = async () => {
    const [u, counts] = await Promise.all([store.getAllUsers(), store.getDMUnreadCounts()]);
    setUsers(u);
    setUnreadCounts(counts);
    if (!selectedUserId && u.length > 0) setSelectedUserId(u[0].id);
  };

  useEffect(() => { reloadDirectory(); }, []);

  const selectedUser = users?.find((u) => u.id === selectedUserId) || null;

  useEffect(() => {
    if (!selectedUserId) { setMessages([]); setConversationId(null); return; }
    let cancelled = false;
    const load = async () => {
      const convId = await store.getOrCreateDMConversation(selectedUserId);
      if (cancelled) return;
      setConversationId(convId);
      const msgs = await store.getDMMessages(convId);
      if (!cancelled) setMessages(msgs);
      await store.markDMMessagesRead(convId, currentUser.id);
      reloadDirectory();
    };
    load();
    const interval = setInterval(async () => {
      if (!conversationId) return;
      const msgs = await store.getDMMessages(conversationId);
      if (!cancelled) setMessages(msgs);
    }, 8000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const refreshThread = async () => {
    if (!conversationId) return;
    setMessages(await store.getDMMessages(conversationId));
  };

  const send = async () => {
    const content = text.trim();
    if (!content || !conversationId) return;
    setText("");
    await store.sendDMMessage({ conversationId, senderId: currentUser.id, senderUsername: currentUser.username, content });
    await refreshThread();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !conversationId) return;
    setUploading(true);
    try {
      const { url, type } = await store.uploadDMAttachment(conversationId, file);
      await store.sendDMMessage({
        conversationId, senderId: currentUser.id, senderUsername: currentUser.username,
        content: `📎 ${file.name}`, attachmentUrl: url, attachmentType: type,
      });
      await refreshThread();
    } catch (err) {
      alert("Erreur lors de l'envoi de la pièce jointe : " + (err.message || err));
    }
    setUploading(false);
  };

  const startEdit = (m) => { setEditingId(m.id); setEditText(m.content); };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const saveEdit = async () => {
    if (!editText.trim()) return;
    await store.editDMMessage(editingId, editText.trim());
    setEditingId(null); setEditText("");
    await refreshThread();
  };
  const removeMessage = async (id) => {
    await store.deleteDMMessage(id);
    await refreshThread();
  };

  if (users === null) return <EmptyState text="Chargement de l'annuaire…" />;
  if (users.length === 0) {
    return <Card title="Messagerie"><EmptyState text="Aucun autre compte sur la plateforme pour l'instant." /></Card>;
  }

  const isMine = (m) => m.senderId === currentUser.id;
  const isImage = (type) => type && type.startsWith("image/");

  const grouped = { admin: [], manager: [], vendor: [], messenger: [] };
  users.forEach((u) => { grouped[u.role]?.push(u); });

  const thread = (
    <div style={{ display: "flex", flexDirection: "column", height: 480 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "4px 4px 12px 4px" }}>
        {messages.length === 0 ? (
          <EmptyState text="Aucun message pour l'instant. Écris le premier !" />
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: isMine(m) ? "flex-end" : "flex-start", marginBottom: 10 }}>
              <div style={{ maxWidth: "75%" }}>
                {editingId === m.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <TextInput value={editText} onChange={(e) => setEditText(e.target.value)} style={{ width: 220 }} />
                    <button onClick={saveEdit} style={iconBtnStyle}><CheckCircle2 size={15} color="#3F8361" /></button>
                    <button onClick={cancelEdit} style={iconBtnStyle}><X size={15} color="#8A93A3" /></button>
                  </div>
                ) : m.deletedAt ? (
                  <div style={{ padding: "9px 13px", borderRadius: 12, background: "#F0F1F4", color: "#9AA2B1", fontSize: 13, fontStyle: "italic" }}>
                    Message supprimé
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "9px 13px", borderRadius: 12,
                      background: isMine(m) ? "#1B2A4A" : "#F0F1F4",
                      color: isMine(m) ? "#fff" : "#1B2A4A",
                      fontSize: 13.5, lineHeight: 1.4,
                      borderBottomRightRadius: isMine(m) ? 3 : 12,
                      borderBottomLeftRadius: isMine(m) ? 12 : 3,
                    }}
                  >
                    {m.attachmentUrl && isImage(m.attachmentType) && (
                      <img src={m.attachmentUrl} alt="pièce jointe" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6, display: "block" }} />
                    )}
                    {m.attachmentUrl && !isImage(m.attachmentType) && (
                      <a href={m.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: isMine(m) ? "#D9A441" : "#1B2A4A", display: "block", marginBottom: 4 }}>
                        📎 Pièce jointe
                      </a>
                    )}
                    {m.content}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: "#9AA2B1", marginTop: 3, textAlign: isMine(m) ? "right" : "left" }}>
                  {m.senderUsername} · {timeShort(m.createdAt)}
                  {m.editedAt && !m.deletedAt && " · modifié"}
                  {isMine(m) && !m.deletedAt && editingId !== m.id && (
                    <>
                      {" · "}
                      <span onClick={() => startEdit(m)} style={{ cursor: "pointer", textDecoration: "underline" }}>modifier</span>
                      {" · "}
                      <span onClick={() => removeMessage(m.id)} style={{ cursor: "pointer", textDecoration: "underline" }}>supprimer</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #F0F1F4" }}>
        <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={onFileChosen} />
        <Button variant="ghost" onClick={pickFile} disabled={uploading} style={{ borderColor: "#D8DCE3", color: "#5B6472" }}>
          {uploading ? "…" : "📎"}
        </Button>
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écrire un message…"
          style={{ flex: 1 }}
        />
        <Button variant="gold" onClick={send}><Send size={15} /></Button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div className="dash-col-side" style={{ flex: "1 1 240px" }}>
        <Card title="Annuaire">
          {["admin", "manager", "messenger", "vendor"].map((role) => (
            grouped[role].length === 0 ? null : (
              <div key={role} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9AA2B1", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                  {ROLE_GROUP_LABEL[role]}
                </div>
                {grouped[role].map((u) => {
                  const count = unreadCounts[u.id] || 0;
                  const active = u.id === selectedUserId;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                        textAlign: "left", padding: "9px 10px", marginBottom: 3, borderRadius: 8, border: "none",
                        cursor: "pointer", background: active ? "#EAF0FB" : "transparent",
                        color: "#1B2A4A", fontSize: 13, fontWeight: active ? 700 : 500,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PresenceDot isOnline={u.isOnline} lastSeenAt={u.lastSeenAt} />
                        {u.username}
                      </span>
                      {count > 0 && (
                        <span style={{ background: "#C1554A", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ))}
        </Card>
      </div>
      <div className="dash-col-main" style={{ flex: "2 1 380px" }}>
        {selectedUser ? (
          <Card title={`Discussion avec ${selectedUser.username}`}>
            {selectedUser.role === "vendor" && selectedUser.vendorId && (() => {
              const v = vendors.find((vv) => vv.id === selectedUser.vendorId);
              return v ? <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #F0F1F4" }}><VendorMiniHeader vendor={v} /></div> : null;
            })()}
            {thread}
          </Card>
        ) : (
          <Card title="Messagerie"><EmptyState text="Choisis quelqu'un dans l'annuaire." /></Card>
        )}
      </div>
    </div>
  );
}

function Caisse({ vendors, day, setDay, withdrawals, setWithdrawals, notifications, setNotifications, daysList, today, currentUser }) {
  const [label, setLabel] = useState("");
  const [montant, setMontant] = useState("");
  const [allDays, setAllDays] = useState(null);

  useEffect(() => {
    (async () => {
      const loaded = await store.getDaysInRange(daysList || []);
      setAllDays(loaded);
    })();
  }, [daysList]);

  const summaries = vendors.map((v) => ({ vendor: v, summary: computeVersementSummary(day, v.id) })).filter((s) => s.summary.lines.length > 0);

  const totalEspeces = summaries.reduce((s, x) => s + (x.summary.finalise ? x.summary.montantVerseEspeces : 0), 0);
  const totalMobile = summaries.reduce((s, x) => s + x.summary.totalMobile, 0);
  const totalDepenses = (day.expenses || []).reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const especesNettes = totalEspeces - totalDepenses;

  const daysWithToday = allDays ? (allDays.some((d) => d.date === today) ? allDays : [...allDays, day]) : [day];
  const depensesSemaine = sumExpensesOverRange(daysWithToday, getCurrentWeekRange(today));
  const depensesMois = sumExpensesOverRange(daysWithToday, getCurrentMonthRange(today));

  const addExpense = async () => {
    const m = Number(montant);
    if (!label.trim() || !m) return;
    const next = { ...day, expenses: [...(day.expenses || []), { id: uid(), label: label.trim(), montant: m }] };
    await setDay(next);
    setLabel(""); setMontant("");
  };

  const removeExpense = async (id) => {
    await setDay({ ...day, expenses: (day.expenses || []).filter((e) => e.id !== id) });
  };

  const pendingWithdrawals = (withdrawals || []).filter((w) => w.statut === "en_attente");
  const historyWithdrawals = (withdrawals || []).filter((w) => w.statut !== "en_attente");

  const resolveWithdrawal = async (id, statut) => {
    const w = (withdrawals || []).find((x) => x.id === id);
    let refusalReason = null;
    if (statut === "refuse") {
      refusalReason = window.prompt("Raison du refus (visible dans l'historique) :", "") || "";
    }
    await setWithdrawals((withdrawals || []).map((x) => (x.id === id ? { ...x, statut, approvedBy: currentUser?.username || null, refusalReason } : x)));
    if (w) {
      const modePaiement = w.methode === "mobile" ? `par paiement mobile au ${w.numeroMobile}` : "en espèces";
      const message = statut === "approuve"
        ? `Ta demande de retrait de ${fmtMoney(w.montant)} a été approuvée — versement prévu ${modePaiement}.`
        : `Ta demande de retrait de ${fmtMoney(w.montant)} a été refusée${refusalReason ? ` : ${refusalReason}` : "."}`;
      await setNotifications([...(notifications || []), { id: uid(), vendorId: w.vendorId, message, read: false, createdAt: Date.now() }]);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="TOTAL ESPÈCES (net des dépenses)" value={fmtMoney(especesNettes)} accent="#3F8361" />
        <StatCard label="TOTAL PAIEMENT MOBILE" value={fmtMoney(totalMobile)} accent="#1B2A4A" />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="DÉPENSES — AUJOURD'HUI" value={fmtMoney(totalDepenses)} accent="#C1554A" />
        <StatCard label="DÉPENSES — CETTE SEMAINE" value={fmtMoney(depensesSemaine)} accent="#C1554A" />
        <StatCard label="DÉPENSES — CE MOIS" value={fmtMoney(depensesMois)} accent="#C1554A" />
      </div>

      {pendingWithdrawals.length > 0 && (
        <Card title="Demandes de retrait en attente">
          <Table
            headers={["Vendeur", "Montant demandé", "Mode de paiement souhaité", "Date", "Action"]}
            rows={pendingWithdrawals.map((w) => [
              w.vendorNom, fmtMoney(w.montant),
              w.methode === "mobile" ? `Paiement mobile — ${w.numeroMobile}` : "Espèces",
              formatDateFR(w.date),
              <div key="a" style={{ display: "flex", gap: 8 }}>
                <Button variant="gold" onClick={() => resolveWithdrawal(w.id, "approuve")}>Approuver</Button>
                <Button variant="ghost" onClick={() => resolveWithdrawal(w.id, "refuse")}>Refuser</Button>
              </div>,
            ])}
          />
        </Card>
      )}

      {historyWithdrawals.length > 0 && (
        <Card title="Historique des retraits">
          <Table
            headers={["Vendeur", "Montant", "Mode de paiement", "Date", "Statut", "Traité par", "Détail"]}
            rows={historyWithdrawals.map((w) => [
              w.vendorNom, fmtMoney(w.montant),
              w.methode === "mobile" ? `Mobile — ${w.numeroMobile}` : "Espèces",
              formatDateFR(w.date),
              <Badge key="b" ok={w.statut === "approuve"} okText="Approuvé" warnText="Refusé" />,
              w.approvedBy || "—",
              w.statut === "refuse" && w.refusalReason ? w.refusalReason : "—",
            ])}
          />
        </Card>
      )}

      <Card title="Versements par vendeur — aujourd'hui">
        {summaries.length === 0 ? (
          <EmptyState text="Aucun vendeur avec un retour du soir clôturé pour l'instant." />
        ) : (
          <Table
            headers={["Vendeur", "Montant attendu", "Mobile", "Espèces versées", "Écart"]}
            rows={summaries.map(({ vendor, summary }) => [
              vendor.nom,
              fmtMoney(summary.montantAttendu),
              fmtMoney(summary.totalMobile),
              summary.finalise ? fmtMoney(summary.montantVerseEspeces) : "—",
              summary.finalise ? (
                <Badge key="b" ok={summary.statut === "equilibre"} okText="Équilibré" warnText={`${summary.ecart > 0 ? "+" : ""}${fmtMoney(summary.ecart)}`} />
              ) : "—",
            ])}
          />
        )}
      </Card>

      <Card title="Dépenses du jour">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
          <div style={{ flex: "2 1 200px" }}>
            <Label>Libellé de la dépense</Label>
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Transport, sacs plastiques…" />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <Label>Montant (F)</Label>
            <TextInput type="number" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" />
          </div>
          <Button onClick={addExpense}><Plus size={15} /> Ajouter</Button>
        </div>
        {(day.expenses || []).length === 0 ? (
          <EmptyState text="Aucune dépense enregistrée aujourd'hui." />
        ) : (
          <Table
            headers={["Libellé", "Montant", ""]}
            rows={(day.expenses || []).map((e) => [
              e.label, fmtMoney(e.montant),
              <button key="del" onClick={() => removeExpense(e.id)} style={iconBtnStyle}><Trash2 size={15} /></button>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rapports — bilan mensuel imprimable (valeurs + graphiques), à exporter en
// PDF via la fonction d'impression du navigateur ("Enregistrer au format PDF").
// ---------------------------------------------------------------------------

function monthRangeFromInput(monthValue) {
  // monthValue au format "AAAA-MM"
  const [y, m] = monthValue.split("-").map(Number);
  const first = `${monthValue}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${monthValue}-${String(lastDay).padStart(2, "0")}`;
  return [first, last];
}

function monthLabelFR(monthValue) {
  const [y, m] = monthValue.split("-").map(Number);
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${months[m - 1]} ${y}`;
}

function Rapports({ vendors, products, daysList, today }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const generer = async () => {
    setLoading(true);
    const range = monthRangeFromInput(month);
    const dates = daysList.filter((d) => inRange(d, range));
    const loaded = await store.getDaysInRange(dates);
    const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

    let totalCa = 0, totalVendu = 0, totalEspeces = 0, totalMobile = 0, totalDepenses = 0;
    loaded.forEach((day) => {
      day.lines.forEach((l) => {
        if (l.quantiteVendue != null) { totalCa += l.montantAttendu || 0; totalVendu += l.quantiteVendue || 0; }
      });
      totalDepenses += (day.expenses || []).reduce((s, e) => s + (Number(e.montant) || 0), 0);
      vendors.forEach((v) => {
        const summary = computeVersementSummary(day, v.id);
        totalMobile += summary.totalMobile;
        if (summary.finalise) totalEspeces += summary.montantVerseEspeces;
      });
    });

    setReport({
      range,
      totalCa, totalVendu, totalEspeces, totalMobile, totalDepenses,
      ranking: aggregateVendorRanking(loaded, range, vendors),
      byCategory: aggregateRangeByCategory(loaded, range, productsById),
      dailySeries: buildDailyTotalSeries(loaded, range),
      joursActifs: loaded.filter((d) => d.lines.length > 0).length,
    });
    setLoading(false);
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #rapport-print-area, #rapport-print-area * { visibility: visible; }
          #rapport-print-area { position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Card title="Générer un rapport mensuel">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px" }}>
            <Label>Mois</Label>
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button variant="primary" onClick={generer} disabled={loading}>
            {loading ? "Génération…" : "Générer"}
          </Button>
          {report && (
            <Button variant="gold" onClick={() => window.print()}>
              <Printer size={15} /> Imprimer / Enregistrer en PDF
            </Button>
          )}
        </div>
      </Card>

      {report && (
        <div id="rapport-print-area">
          <Card>
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 21, fontWeight: 700, color: "#1B2A4A", textTransform: "capitalize" }}>
                Rapport mensuel — {monthLabelFR(month)}
              </div>
              <div style={{ fontSize: 12, color: "#8A93A3" }}>{report.joursActifs} jour(s) d'activité sur la période</div>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="CHIFFRE D'AFFAIRES DU MOIS" value={fmtMoney(report.totalCa)} accent="#D9A441" />
            <StatCard label="ARTICLES VENDUS" value={report.totalVendu} />
            <StatCard label="ESPÈCES ENCAISSÉES" value={fmtMoney(report.totalEspeces)} />
            <StatCard label="PAIEMENTS MOBILES" value={fmtMoney(report.totalMobile)} />
            <StatCard label="DÉPENSES DU MOIS" value={fmtMoney(report.totalDepenses)} accent="#C1554A" />
          </div>

          <Card title="Évolution du chiffre d'affaires sur le mois">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.dailySeries} margin={{ left: 0, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A93A3" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8A93A3" }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} labelFormatter={(l) => `Jour ${l}`} />
                  <Line type="monotone" dataKey="ca" stroke="#D9A441" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 340px" }}>
              <Card title="Classement des vendeurs">
                {report.ranking.length === 0 ? (
                  <EmptyState text="Aucune vente sur cette période." />
                ) : (
                  <>
                    <div style={{ height: Math.max(140, report.ranking.length * 30), marginBottom: 14 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.ranking} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="nom" width={100} tick={{ fontSize: 12, fill: "#1B2A4A" }} />
                          <Tooltip formatter={(v) => fmtMoney(v)} />
                          <Bar dataKey="ca" fill="#1B2A4A" radius={[0, 6, 6, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <Table
                      headers={["Vendeur", "Vendu", "Chiffre d'affaires"]}
                      rows={report.ranking.map((r) => [r.nom, r.vendu, fmtMoney(r.ca)])}
                    />
                  </>
                )}
              </Card>
            </div>
            <div style={{ flex: "1 1 300px" }}>
              <Card title="Performance par type de produit">
                {report.byCategory.length === 0 ? (
                  <EmptyState text="Aucune vente sur cette période." />
                ) : (
                  <Table
                    headers={["Catégorie", "Qté vendue", "Chiffre d'affaires"]}
                    rows={report.byCategory.map((c) => [c.categorie, c.qty, fmtMoney(c.ca)])}
                  />
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Historique({ daysList, vendors, today }) {
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [allDays, setAllDays] = useState(null); // null = chargement en cours
  const [expandedDate, setExpandedDate] = useState(null);

  useEffect(() => {
    (async () => setAllDays(await store.getDaysInRange(daysList)))();
  }, [daysList]);

  const vendor = vendors.find((v) => v.id === selectedVendorId) || null;

  useEffect(() => { setExpandedDate(null); }, [selectedVendorId]);

  if (daysList.length === 0) {
    return <Card title="Historique des journées"><EmptyState text="L'historique se remplira automatiquement dès qu'une distribution sera enregistrée." /></Card>;
  }

  const vendorPicker = (
    <Card title="Choisir un vendeur">
      {vendors.length === 0 ? (
        <EmptyState text="Ajoute d'abord un vendeur dans l'onglet Vendeurs & comptes." />
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {vendors.map((v) => {
            const active = v.id === selectedVendorId;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVendorId(v.id)}
                style={{
                  padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                  border: `1.5px solid ${active ? "#D9A441" : "#D8DCE3"}`,
                  background: active ? "rgba(217,164,65,0.12)" : "#fff",
                  color: active ? "#8A6D1F" : "#1B2A4A",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                }}
              >
                {v.nom}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );

  if (!vendor) {
    return (
      <div>
        {vendorPicker}
        <Card title="Historique"><EmptyState text="Choisis un vendeur ci-dessus pour voir son historique détaillé." /></Card>
      </div>
    );
  }

  if (allDays === null) {
    return (
      <div>
        {vendorPicker}
        <Card title={`Historique — ${vendor.nom}`}><EmptyState text="Chargement…" /></Card>
      </div>
    );
  }

  // Ne garder que les journées où ce vendeur a eu une activité (produits ou versement)
  const vendorDays = allDays
    .map((d) => ({ day: d, summary: computeVersementSummary(d, vendor.id), lines: (d.lines || []).filter((l) => l.vendorId === vendor.id) }))
    .filter(({ lines, summary }) => lines.length > 0 || summary.mobilePayments.length > 0)
    .sort((a, b) => b.day.date.localeCompare(a.day.date));

  const totalVendu = vendorDays.reduce((s, { lines }) => s + lines.reduce((ss, l) => ss + (l.quantiteVendue || 0), 0), 0);
  const totalCA = vendorDays.reduce((s, { summary }) => s + summary.montantAttendu, 0);
  const totalEspeces = vendorDays.reduce((s, { summary }) => s + (summary.finalise ? summary.montantVerseEspeces : 0), 0);
  const totalMobile = vendorDays.reduce((s, { summary }) => s + summary.totalMobile, 0);

  return (
    <div>
      {vendorPicker}

      <Card>
        <VendorMiniHeader vendor={vendor} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <StatCard label="Chiffre d'affaires total" value={fmtMoney(totalCA)} sub={`${vendorDays.length} jour(s) d'activité`} accent="#D9A441" />
          <StatCard label="Quantité totale vendue" value={totalVendu} sub="unités, tous produits confondus" />
          <StatCard label="Total reçu en espèces" value={fmtMoney(totalEspeces)} accent="#3F8361" />
          <StatCard label="Total reçu en mobile" value={fmtMoney(totalMobile)} accent="#4A7FC7" />
        </div>
      </Card>

      <Card title={`Historique détaillé — ${vendor.nom}`}>
        {vendorDays.length === 0 ? (
          <EmptyState text="Aucune activité enregistrée pour ce vendeur." />
        ) : (
          vendorDays.map(({ day, summary, lines }) => {
            const isOpen = expandedDate === day.date;
            return (
              <div key={day.date} style={{ borderBottom: "1px solid #F0F1F4" }}>
                <button
                  onClick={() => setExpandedDate(isOpen ? null : day.date)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left", flexWrap: "wrap", gap: 6 }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#1B2A4A" }}>
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    {formatDateFR(day.date)}
                    {day.date === today && <span style={{ fontSize: 11, color: "#D9A441", fontWeight: 700 }}>AUJOURD'HUI</span>}
                  </span>
                  <span style={{ fontSize: 13, color: "#5B6472" }}>
                    {fmtMoney(summary.montantAttendu)} attendu · {fmtMoney(summary.finalise ? summary.montantVerseEspeces : 0)} espèces · {fmtMoney(summary.totalMobile)} mobile
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: "4px 4px 18px 23px" }}>
                    {lines.length === 0 ? (
                      <EmptyState text="Aucun produit ce jour-là." />
                    ) : (
                      <Table
                        headers={["Produit", "Remis", "Restant", "Vendu", "Montant attendu"]}
                        rows={lines.map((l) => [
                          l.productNom, l.quantiteRemise,
                          l.quantiteRestante ?? "—", l.quantiteVendue ?? "—",
                          l.montantAttendu ? fmtMoney(l.montantAttendu) : "—",
                        ])}
                      />
                    )}

                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14, fontSize: 12.5, color: "#5B6472" }}>
                      <span>Espèces versées : <strong style={{ color: "#1B2A4A" }}>{summary.finalise ? fmtMoney(summary.montantVerseEspeces) : "—"}</strong></span>
                      <span>Mobile reçu : <strong style={{ color: "#1B2A4A" }}>{fmtMoney(summary.totalMobile)}</strong></span>
                      {summary.mobilePayments.length > 0 && (
                        <span>Numéros : {summary.mobilePayments.map((m) => m.numero).join(", ")}</span>
                      )}
                      {summary.finalise && (
                        <span>
                          Écart :{" "}
                          <strong style={{ color: summary.statut === "manque" ? "#C1554A" : summary.statut === "exces" ? "#3F8361" : "#1B2A4A" }}>
                            {summary.ecart > 0 ? "+" : ""}{fmtMoney(summary.ecart)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journal d'activité — connexions et actions des admins secondaires
// (visible uniquement par l'administrateur principal)
// ---------------------------------------------------------------------------

const EVENT_LABELS = {
  login: "Connexion",
  logout: "Déconnexion",
  add_vendor: "Vendeur ajouté",
  delete_vendor: "Vendeur supprimé",
  add_manager: "Gestionnaire ajouté",
  delete_manager: "Gestionnaire supprimé",
  convert_to_messenger: "Converti en messagerie",
};

function eventBadgeColor(eventType) {
  if (eventType === "login") return "#3F8361";
  if (eventType === "logout") return "#8A93A3";
  if (eventType.startsWith("delete")) return "#C1554A";
  return "#1B2A4A";
}

function JournalActivite() {
  const [entries, setEntries] = useState(null);
  const [filterUser, setFilterUser] = useState("");

  useEffect(() => {
    (async () => setEntries(await store.getActivityLog()))();
  }, []);

  if (entries === null) return <EmptyState text="Chargement du journal…" />;

  const usernames = Array.from(new Set(entries.map((e) => e.username)));
  const filtered = filterUser ? entries.filter((e) => e.username === filterUser) : entries;

  return (
    <Card
      title="Journal d'activité des administrateurs secondaires"
      right={
        usernames.length > 1 && (
          <Select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 200 }}>
            <option value="">Tous les comptes</option>
            {usernames.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        )
      }
    >
      {filtered.length === 0 ? (
        <EmptyState text="Aucune activité enregistrée pour l'instant." />
      ) : (
        <Table
          headers={["Date", "Compte", "Événement", "Détail", "Adresse IP", "Appareil"]}
          rows={filtered.map((e) => [
            new Date(e.createdAt).toLocaleString("fr-FR"),
            e.username,
            <span key="b" style={{ fontSize: 12, fontWeight: 700, color: eventBadgeColor(e.eventType) }}>
              {EVENT_LABELS[e.eventType] || e.eventType}
            </span>,
            e.description,
            e.ipAddress || "—",
            e.device ? (
              <span key="d" title={e.device} style={{ fontSize: 11.5, color: "#8A93A3" }}>
                {e.device.length > 34 ? e.device.slice(0, 34) + "…" : e.device}
              </span>
            ) : "—",
          ])}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Supervision — l'admin principal peut consulter toutes les conversations,
// en lecture seule (aucun envoi, aucune modification possible).
// ---------------------------------------------------------------------------

function Supervision({ currentUser }) {
  const [conversations, setConversations] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const convs = await store.getAllConversations();
      setConversations(convs);
      if (convs.length > 0) setSelectedId(convs[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    (async () => setMessages(await store.getDMMessages(selectedId)))();
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (conversations === null) return <EmptyState text="Chargement des conversations…" />;

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const isImage = (type) => type && type.startsWith("image/");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#8A93A3", fontSize: 12.5 }}>
        <Eye size={14} /> Lecture seule — visible uniquement par toi, aucun message ne peut être envoyé ici.
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div className="dash-col-side" style={{ flex: "1 1 260px" }}>
          <Card title={`Conversations (${conversations.length})`}>
            {conversations.length === 0 ? (
              <EmptyState text="Aucune conversation sur la plateforme pour l'instant." />
            ) : (
              conversations.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 3,
                      borderRadius: 8, border: "none", cursor: "pointer",
                      background: active ? "#EAF0FB" : "transparent", color: "#1B2A4A",
                      fontSize: 13, fontWeight: active ? 700 : 500,
                    }}
                  >
                    {c.userA.username} ↔ {c.userB.username}
                  </button>
                );
              })
            )}
          </Card>
        </div>
        <div className="dash-col-main" style={{ flex: "2 1 380px" }}>
          <Card title={selected ? `${selected.userA.username} ↔ ${selected.userB.username}` : "Conversation"}>
            {!selected ? (
              <EmptyState text="Choisis une conversation dans la liste." />
            ) : (
              <div ref={scrollRef} style={{ height: 480, overflowY: "auto", padding: "4px 4px 12px 4px" }}>
                {messages.length === 0 ? (
                  <EmptyState text="Aucun message dans cette conversation." />
                ) : (
                  messages.map((m) => {
                    const isA = m.senderUsername === selected.userA.username;
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: isA ? "flex-start" : "flex-end", marginBottom: 10 }}>
                        <div style={{ maxWidth: "75%" }}>
                          {m.deletedAt ? (
                            <div style={{ padding: "9px 13px", borderRadius: 12, background: "#F0F1F4", color: "#9AA2B1", fontSize: 13, fontStyle: "italic" }}>
                              Message supprimé
                            </div>
                          ) : (
                            <div style={{ padding: "9px 13px", borderRadius: 12, background: isA ? "#F0F1F4" : "#1B2A4A", color: isA ? "#1B2A4A" : "#fff", fontSize: 13.5, lineHeight: 1.4 }}>
                              {m.attachmentUrl && isImage(m.attachmentType) && (
                                <img src={m.attachmentUrl} alt="pièce jointe" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6, display: "block" }} />
                              )}
                              {m.attachmentUrl && !isImage(m.attachmentType) && (
                                <a href={m.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: isA ? "#1B2A4A" : "#D9A441", display: "block", marginBottom: 4 }}>
                                  📎 Pièce jointe
                                </a>
                              )}
                              {m.content}
                            </div>
                          )}
                          <div style={{ fontSize: 10.5, color: "#9AA2B1", marginTop: 3, textAlign: isA ? "left" : "right" }}>
                            {m.senderUsername} · {timeShort(m.createdAt)}
                            {m.editedAt && !m.deletedAt && " · modifié"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
