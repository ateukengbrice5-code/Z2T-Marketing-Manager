import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  LayoutDashboard, Package, Boxes, Users, Truck, MoonStar, Wallet, History,
  Plus, Trash2, CheckCircle2, AlertTriangle, ChevronRight, ChevronDown, ChevronLeft,
  Store, LogOut, Smartphone, Trophy, TrendingUp, ArrowDownToLine, RotateCcw, Eye, Pencil, Sun,
  MessageSquare, Send, X, Link2, Cake, Camera, FileText, Printer, Bell, PartyPopper, Menu, UserCircle, ClipboardList, Newspaper,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from "recharts";
import * as store from "./lib/store.js";
import * as offline from "./lib/offline.js";

// ---------------------------------------------------------------------------
// Notifications (toasts) — remplace les popups natifs alert()/window.alert,
// qui s'affichent de façon incohérente selon les navigateurs et s'affichent
// mal (ou pas du tout) dans certains contextes mobile/webview. Ce système
// affiche une petite bannière en haut de l'écran, avec la même apparence
// partout (web comme mobile), qui se referme seule après quelques secondes
// ou d'un clic.
// ---------------------------------------------------------------------------

const ToastContext = React.createContext(null);

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de ToastProvider.");
  return ctx;
}

const TOAST_STYLES = {
  success: { bg: "#F0FAF4", border: "#3F9C6D", color: "#1B2A4A", Icon: CheckCircle2, iconColor: "#3F9C6D" },
  error: { bg: "#FDF1EF", border: "#C1554A", color: "#1B2A4A", Icon: AlertTriangle, iconColor: "#C1554A" },
  warning: { bg: "#FFF8EC", border: "#D9A441", color: "#1B2A4A", Icon: AlertTriangle, iconColor: "#C79A3A" },
  info: { bg: "#EEF1F8", border: "#1B2A4A", color: "#1B2A4A", Icon: Bell, iconColor: "#1B2A4A" },
};

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback((message, type = "info", durationMs = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, message, type }]);
    if (durationMs > 0) {
      setTimeout(() => dismissToast(id), durationMs);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed", top: "max(16px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)",
          zIndex: 400, display: "flex", flexDirection: "column", gap: 8, width: "min(420px, calc(100vw - 24px))",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const s = TOAST_STYLES[t.type] || TOAST_STYLES.info;
          const Icon = s.Icon;
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto", display: "flex", alignItems: "flex-start", gap: 10,
                background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "12px 14px",
                boxShadow: "0 8px 24px rgba(27,42,74,0.16)", animation: "z2t-toast-in 0.2s ease-out",
              }}
            >
              <Icon size={18} style={{ color: s.iconColor, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 13.5, color: s.color, lineHeight: 1.4 }}>{t.message}</div>
              <button
                onClick={() => dismissToast(t.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8A93A3", padding: 2, flexShrink: 0 }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes z2t-toast-in { 0% { transform: translateY(-12px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const NAV_ADMIN = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "actualites", label: "Actualités", icon: Newspaper },
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
  { id: "actualites", label: "Actualités", icon: Newspaper },
  { id: "retour", label: "Mon retour du soir", icon: MoonStar },
  { id: "presence", label: "Ma présence", icon: CheckCircle2 },
  { id: "messagerie", label: "Messages", icon: MessageSquare },
];

const NAV_MANAGER = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "actualites", label: "Actualités", icon: Newspaper },
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

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function getCurrentYearRange(iso) {
  return [`${iso.slice(0, 4)}-01-01`, iso];
}

function getCurrentQuarterRange(iso) {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear();
  const qStartMonth = Math.floor(d.getMonth() / 3) * 3; // 0, 3, 6, 9
  const first = new Date(y, qStartMonth, 1);
  return [isoFromDate(first), iso];
}

function inRange(dateIso, range) {
  return dateIso >= range[0] && dateIso <= range[1];
}

function getPreviousQuarterRange(iso) {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear();
  const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
  const firstOfThisQuarter = new Date(y, qStartMonth, 1);
  const lastOfPrevQuarter = new Date(firstOfThisQuarter.getTime() - 86400000);
  const prevQStartMonth = Math.floor(lastOfPrevQuarter.getMonth() / 3) * 3;
  const firstOfPrevQuarter = new Date(lastOfPrevQuarter.getFullYear(), prevQStartMonth, 1);
  return [isoFromDate(firstOfPrevQuarter), isoFromDate(lastOfPrevQuarter)];
}

// Décale un mois au format "AAAA-MM" de `delta` mois (peut être négatif).
function shiftMonthValue(monthValue, delta) {
  let [y, m] = monthValue.split("-").map(Number);
  let total = y * 12 + (m - 1) + delta;
  y = Math.floor(total / 12);
  m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Plage de la période précédente, de même durée que la période choisie
// (utilisée pour comparer l'évolution du chiffre d'affaires d'un vendeur).
function previousRangeForPeriod(type, today, monthValue, customRange) {
  if (type === "semaine") return getPreviousWeekRange(today);
  if (type === "mois") return monthRangeFromInput(shiftMonthValue(monthValue, -1));
  if (type === "trimestre") return getPreviousQuarterRange(today);
  if (type === "personnalise") {
    const range = rangeForPeriod(type, today, monthValue, customRange);
    const start = new Date(range[0] + "T00:00:00");
    const end = new Date(range[1] + "T00:00:00");
    const nbJours = Math.round((end - start) / 86400000) + 1;
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (nbJours - 1) * 86400000);
    return [isoFromDate(prevStart), isoFromDate(prevEnd)];
  }
  return getPreviousYearRange(today);
}

// Renvoie [périodeActuelle, périodeN-1, périodeN-2, ...] jusqu'à n périodes
// en arrière, en reculant pas à pas — utilisé pour repérer un vendeur resté
// "moins rentable" plusieurs périodes de suite. Une période personnalisée
// n'a pas d'historique équivalent : on renvoie juste la période choisie.
function periodsBack(type, today, monthValue, n, customRange) {
  const ranges = [rangeForPeriod(type, today, monthValue, customRange)];
  if (type === "personnalise") return ranges;
  if (type === "mois") {
    for (let i = 1; i <= n; i++) ranges.push(monthRangeFromInput(shiftMonthValue(monthValue, -i)));
    return ranges;
  }
  let anchor = today;
  for (let i = 1; i <= n; i++) {
    let prevRange;
    if (type === "semaine") prevRange = getPreviousWeekRange(anchor);
    else if (type === "trimestre") prevRange = getPreviousQuarterRange(anchor);
    else prevRange = getPreviousYearRange(anchor);
    ranges.push(prevRange);
    anchor = prevRange[1];
  }
  return ranges;
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

// Règle commune de robustesse des mots de passe pour tous les comptes
// (admin, gestionnaire, vendeur, messagerie) — l'application manipule de
// l'argent (retraits, versements), un simple minimum de 6 caractères sans
// autre contrainte est insuffisant.
const PASSWORD_HELP_TEXT = "Le mot de passe doit contenir au moins 8 caractères, dont au moins une lettre et un chiffre.";
function isStrongPassword(pw) {
  return typeof pw === "string" && pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

// Vérifie un numéro mobile camerounais : 9 chiffres commençant par 6,
// avec ou sans indicatif (+237 / 237) et espaces/tirets tolérés à la saisie.
function isValidCameroonPhone(raw) {
  const cleaned = String(raw || "").replace(/[\s.-]/g, "");
  const local = cleaned.replace(/^\+?237/, "");
  return /^6\d{8}$/.test(local);
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

function StatCard({ label, value, sub, accent, onClick, active }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{
        background: "#fff",
        border: active ? `2px solid ${accent || "#1B2A4A"}` : "1px solid #E7E9EE",
        borderRadius: 14, padding: "18px 20px", flex: "1 1 200px", minWidth: 190,
        cursor: clickable ? "pointer" : "default",
        boxShadow: active ? "0 2px 10px rgba(27,42,74,0.08)" : "none",
        transition: "border 0.12s, box-shadow 0.12s",
      }}
    >
      <div style={{ fontSize: 12.5, color: "#5B6472", fontWeight: 600, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 28, fontWeight: 700, color: accent || "#1B2A4A", marginTop: 6, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#8A93A3", marginTop: 5 }}>{sub}</div>}
      {clickable && (
        <div style={{ fontSize: 11, color: "#B7BDC9", marginTop: 6, fontWeight: 600 }}>
          {active ? "▲ Masquer le détail" : "▼ Voir le détail par période"}
        </div>
      )}
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

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D8DCE3",
        fontSize: 14, fontFamily: "Calibri, Arial, sans-serif", color: "#1B2A4A",
        outline: "none", boxSizing: "border-box", resize: "vertical", ...props.style,
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
    if (!isStrongPassword(pass1)) {
      setError(PASSWORD_HELP_TEXT);
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
    if (!isStrongPassword(password)) { setError(PASSWORD_HELP_TEXT); return; }
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
        <Label>Mot de passe (8 caractères minimum, avec lettres et chiffres)</Label>
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

// Rapport vendeurs complet sur une période : chiffre d'affaires, quantité
// vendue, espèces/mobile encaissés et jours actifs pour chaque vendeur —
// avec repérage du vendeur le plus et le moins rentable (parmi ceux ayant
// eu de l'activité sur la période, pour ne pas pénaliser un vendeur inactif).
// Calcule aussi, pour chaque vendeur : son produit fétiche (le plus vendu),
// sa fiabilité de caisse (part des jours versés sans écart) et sa régularité
// (coefficient de variation de son CA journalier — plus c'est bas, plus le
// vendeur est constant d'un jour à l'autre).
function aggregateVendorFullReport(days, range, vendors) {
  const rows = vendors.map((v) => {
    let ca = 0, vendu = 0, especes = 0, mobile = 0, joursActifs = 0;
    let joursFinalises = 0, joursAvecEcart = 0, ecartTotal = 0;
    const caParJourMap = {};
    const parProduit = {}; // productId -> { nom, vendu, ca }

    days.forEach((day) => {
      if (!day || !inRange(day.date, range)) return;
      const lines = day.lines.filter((l) => l.vendorId === v.id);
      if (lines.length > 0) joursActifs += 1;

      let caJour = 0;
      lines.forEach((l) => {
        if (l.quantiteVendue != null) {
          ca += l.montantAttendu || 0;
          vendu += l.quantiteVendue || 0;
          caJour += l.montantAttendu || 0;
          if (!parProduit[l.productId]) parProduit[l.productId] = { nom: l.productNom, vendu: 0, ca: 0 };
          parProduit[l.productId].vendu += l.quantiteVendue || 0;
          parProduit[l.productId].ca += l.montantAttendu || 0;
        }
      });
      if (caJour > 0) caParJourMap[day.date] = caJour;

      const summary = computeVersementSummary(day, v.id);
      mobile += summary.totalMobile;
      if (summary.finalise) {
        especes += summary.montantVerseEspeces;
        joursFinalises += 1;
        if (summary.ecart !== 0) { joursAvecEcart += 1; ecartTotal += summary.ecart; }
      }
    });

    const caParJour = joursActifs > 0 ? Math.round(ca / joursActifs) : 0;
    const produitFetiche = Object.values(parProduit).sort((a, b) => b.vendu - a.vendu)[0] || null;

    const valeursCA = Object.values(caParJourMap);
    let regulariteCV = null;
    if (valeursCA.length > 1) {
      const moyenne = valeursCA.reduce((s, x) => s + x, 0) / valeursCA.length;
      const variance = valeursCA.reduce((s, x) => s + Math.pow(x - moyenne, 2), 0) / valeursCA.length;
      regulariteCV = moyenne > 0 ? Math.sqrt(variance) / moyenne : null;
    }

    return {
      vendorId: v.id, nom: v.nom, ca, vendu, especes, mobile, joursActifs, caParJour,
      produitFetiche,
      joursFinalises, joursAvecEcart, ecartTotal,
      tauxEcart: joursFinalises > 0 ? joursAvecEcart / joursFinalises : null,
      regulariteCV,
    };
  }).sort((a, b) => b.ca - a.ca);

  const actifs = rows.filter((r) => r.joursActifs > 0);
  const plusRentable = actifs[0] || null;
  const moinsRentable = actifs.length > 1 ? actifs[actifs.length - 1] : null;
  return { rows, plusRentable, moinsRentable };
}

// Badge ▲/▼ comparant le CA d'un vendeur à la période précédente.
function EvolutionBadge({ evolution }) {
  if (!evolution) return <span style={{ color: "#B7BDC9" }}>—</span>;
  if (evolution.type === "nouveau") return <span style={{ color: "#4A7FC7", fontWeight: 700, fontSize: 12.5 }}>🆕 Nouveau</span>;
  const { value } = evolution;
  if (value > 0) return <span style={{ color: "#3F8361", fontWeight: 700 }}>▲ +{value}%</span>;
  if (value < 0) return <span style={{ color: "#C1554A", fontWeight: 700 }}>▼ {value}%</span>;
  return <span style={{ color: "#5B6472", fontWeight: 600 }}>= 0%</span>;
}

// Traduit le coefficient de variation du CA journalier en étiquette lisible :
// plus c'est bas, plus le vendeur vend un montant similaire d'un jour à l'autre.
function regulariteLabel(cv) {
  if (cv == null) return "—";
  const pct = Math.round(cv * 100);
  if (cv <= 0.15) return `Très régulier (${pct}%)`;
  if (cv <= 0.35) return `Régulier (${pct}%)`;
  return `Irrégulier (${pct}%)`;
}

// Part des journées versées sans écart de caisse, avec un code couleur.
function FiabiliteCell({ r }) {
  if (r.joursFinalises === 0) return <span style={{ color: "#B7BDC9" }}>—</span>;
  const ok = r.joursFinalises - r.joursAvecEcart;
  const ratio = ok / r.joursFinalises;
  const color = ratio === 1 ? "#3F8361" : ratio >= 0.5 ? "#D9A441" : "#C1554A";
  return <span style={{ color, fontWeight: 600 }}>{ok}/{r.joursFinalises} j. sans écart</span>;
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

// Série jour par jour de toutes les grandeurs suivies dans l'onglet Caisse
// (chiffre d'affaires, écart de caisse, dépenses, paiement mobile, espèces
// nettes) sur une période — utilisée par le détail dépliable de chaque carte.
function buildCaisseDailySeries(days, range, vendors) {
  const byDate = {};
  days.forEach((d) => { if (d) byDate[d.date] = d; });
  const series = [];
  let cur = range[0];
  while (cur <= range[1]) {
    const d = byDate[cur];
    let ca = 0, ecart = 0, mobile = 0, especesBrutes = 0, depenses = 0;
    if (d) {
      ca = d.lines.reduce((s, l) => s + (l.quantiteVendue != null ? (l.montantAttendu || 0) : 0), 0);
      depenses = (d.expenses || []).reduce((s, e) => s + (Number(e.montant) || 0), 0);
      vendors.forEach((v) => {
        const summary = computeVersementSummary(d, v.id);
        mobile += summary.totalMobile;
        if (summary.finalise) { especesBrutes += summary.montantVerseEspeces; ecart += summary.ecart; }
      });
    }
    series.push({ date: cur, label: cur.slice(8, 10), ca, ecart, depenses, mobile, especes: especesBrutes - depenses });
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

// Rapport détaillé par produit sur une période donnée : quantité remise aux
// vendeurs (sortie), quantité invendue retournée en stock (entrée), quantité
// vendue et chiffre d'affaires généré (calculé au prix en vigueur au moment
// de chaque distribution). Le "stock" / "reste" est la valeur actuelle du
// produit (le stock n'a pas d'historique par date, seule sa valeur en temps
// réel est connue) — il est donc identique quelle que soit la période choisie.
function aggregateProductReport(days, range, products) {
  const totals = {};
  products.forEach((p) => {
    totals[p.id] = { productId: p.id, nom: p.nom, categorie: p.categorie || "Général", stockActuel: p.stock, entree: 0, sortie: 0, vendu: 0, ca: 0 };
  });
  days.forEach((day) => {
    if (!day || !inRange(day.date, range)) return;
    day.lines.forEach((l) => {
      if (!totals[l.productId]) {
        // Produit depuis supprimé du catalogue : on le fait quand même apparaître dans l'historique.
        totals[l.productId] = { productId: l.productId, nom: l.productNom, categorie: "Général", stockActuel: null, entree: 0, sortie: 0, vendu: 0, ca: 0 };
      }
      const t = totals[l.productId];
      t.sortie += l.quantiteRemise || 0;
      if (l.quantiteRestante != null) t.entree += l.quantiteRestante;
      if (l.quantiteVendue != null) { t.vendu += l.quantiteVendue; t.ca += l.montantAttendu || 0; }
    });
  });
  const rows = Object.values(totals).sort((a, b) => b.ca - a.ca);
  const maxVendu = rows.reduce((m, r) => Math.max(m, r.vendu), 0);
  const topVendus = maxVendu > 0 ? rows.filter((r) => r.vendu === maxVendu) : [];
  return { rows, topVendus, maxVendu };
}

// Dates auxquelles un vendeur donné a fait un retour du soir (au moins une
// ligne de sa journée a été validée), utilisées pour déterminer les jours de
// présence payables sans dépendre uniquement du pointage manuel de l'admin.
function buildRetourDoneDates(days, vendorId) {
  const set = new Set();
  days.forEach((d) => {
    if (!d) return;
    if (d.lines.some((l) => l.vendorId === vendorId && l.quantiteRestante != null)) set.add(d.date);
  });
  return set;
}

// Construit, jour par jour depuis le début du cycle de salaire en cours, la
// liste des journées et indique si chacune est "payable" : soit parce que le
// pointage admin dit "présent", soit parce qu'un retour du soir a été fait.
function buildPresenceCycle(cycleStart, today, attendanceHistory, retourDoneDates) {
  const attendanceByDate = {};
  (attendanceHistory || []).forEach((a) => { attendanceByDate[a.date] = a; });
  const jours = [];
  let cur = cycleStart;
  let guard = 0;
  while (cur <= today && guard < 1000) {
    const att = attendanceByDate[cur];
    const parPointage = att?.statut === "present";
    const parRetour = retourDoneDates.has(cur);
    jours.push({ date: cur, payable: parPointage || parRetour, parPointage, parRetour, statutPointage: att?.statut || null });
    cur = addDays(cur, 1);
    guard += 1;
  }
  return jours;
}

// Calcule le résumé de versement (espèces + mobile) d'un vendeur pour un jour donné
// Nom complet affiché sur les cartes, fiches et tableaux vendeur — le nom
// seul (v.nom) ne suffisait pas, le prénom (v.prenom) était saisi mais
// jamais affiché nulle part dans l'interface.
function vendorFullName(v) {
  if (!v) return "";
  return [v.nom, v.prenom].filter(Boolean).join(" ");
}

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
    finalise, ecart, statut, validePar: finalise ? (versement.validePar || null) : null,
    heureVersement: finalise ? (versement.heureVersement || null) : null,
    totalPieces: lines.reduce((s, l) => s + (l.quantiteVendue || 0), 0),
  };
}

// Historique jour par jour des ventes et versements d'un vendeur, à partir
// d'un ensemble de journées (days). Utilisé à la fois côté fiche vendeur
// (admin) et côté tableau de bord du vendeur lui-même.
function buildVendeurVenteHistory(days, vendorId) {
  return (days || [])
    .map((d) => {
      const s = computeVersementSummary(d, vendorId);
      return {
        date: d.date,
        totalPieces: s.totalPieces,
        montantAttendu: s.montantAttendu,
        montantVerseEspeces: s.montantVerseEspeces,
        totalMobile: s.totalMobile,
        finalise: s.finalise,
        statut: s.statut,
      };
    })
    .filter((d) => d.totalPieces > 0 || d.montantAttendu > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}



function AdminAchievementBell({ achievements, pointageNotifications, onMarkSeen, onMarkPointageSeen, onOpen }) {
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

  const items = [
    ...achievements.map((a) => ({ kind: "achievement", id: a.id, createdAt: a.createdAt, data: a })),
    ...(pointageNotifications || []).map((n) => ({ kind: "pointage", id: n.id, createdAt: n.createdAt, data: n })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        style={{
          position: "relative", background: "#fff", border: "1px solid #E7E9EE", borderRadius: 10,
          width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1B2A4A",
        }}
        title="Notifications (paliers atteints, pointage…)"
      >
        <Bell size={17} />
        {items.length > 0 && (
          <span
            style={{
              position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 999,
              background: "#C1554A", color: "#fff", fontSize: 10.5, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            }}
          >
            {items.length}
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
            Notifications
          </div>
          {items.length === 0 ? (
            <EmptyState text="Rien de nouveau pour l'instant." />
          ) : (
            items.map((item) =>
              item.kind === "achievement" ? (
                <div
                  key={`a-${item.id}`}
                  onClick={() => onMarkSeen(item.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderBottom: "1px solid #F5F6F8", cursor: "pointer" }}
                >
                  <Trophy size={15} color={PALIER_COLORS[item.data.palier]} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 600 }}>
                      {item.data.vendorNom} — {PALIER_LABELS[item.data.palier]}
                    </div>
                    <div style={{ fontSize: 12, color: "#8A93A3", marginTop: 2 }}>
                      {fmtMoney(item.data.montant)} · {formatDateFR(item.data.date)}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={`p-${item.id}`}
                  onClick={() => onMarkPointageSeen(item.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderBottom: "1px solid #F5F6F8", cursor: "pointer" }}
                >
                  <CheckCircle2 size={15} color="#3F9C6D" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#1B2A4A" }}>{item.data.message}</div>
                </div>
              )
            )
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
  return (
    <ToastProvider>
      <AppRoot />
    </ToastProvider>
  );
}

function AppRoot() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState(null); // null = pas encore vérifié
  const [currentUser, setCurrentUser] = useState(null);
  const [currentVendor, setCurrentVendor] = useState(null);

  const [tab, setTab] = useState("dashboard");
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("z2t_dark_mode") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("z2t_dark_mode", darkMode ? "1" : "0"); } catch { /* stockage indisponible, on ignore */ }
  }, [darkMode]);
  const syncFailCounts = useRef({});

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
        delete syncFailCounts.current[action.id];
      } catch (e) {
        console.error("Échec de synchronisation, nouvelle tentative plus tard", action, e);
        const count = (syncFailCounts.current[action.id] || 0) + 1;
        syncFailCounts.current[action.id] = count;
        // Après plusieurs échecs consécutifs de la même action, on ne se
        // contente plus d'un console.error invisible : on prévient
        // explicitement l'utilisateur que la synchro reste bloquée.
        if (count === 3) {
          showToast(
            `Une action en attente (${action.description || action.type}) n'arrive pas à se synchroniser. Vérifie ta connexion ; si le problème persiste, contacte le support.`,
            "warning",
            10000
          );
        }
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
    if (!currentUser || currentUser.blocked) return;
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
    if (!canSeeAchievements || currentUser?.blocked || !online) return;
    reloadUnseenAchievements();
    const id = setInterval(reloadUnseenAchievements, 30000);
    return () => clearInterval(id);
  }, [canSeeAchievements, online, reloadUnseenAchievements]);

  const markAchievementSeen = async (id) => {
    setUnseenAchievements((prev) => prev.filter((a) => a.id !== id));
    try { await store.markAchievementSeen(id); } catch (e) { console.error("Impossible de marquer le palier comme vu", e); }
  };

  // Rafraîchit périodiquement les notifications (pointage, retraits…) pour
  // que le vendeur concerné et tous les admins voient les évènements récents
  // sans avoir à recharger la page.
  useEffect(() => {
    if (!currentUser || currentUser.blocked || !online) return;
    const reload = async () => {
      try { const fresh = await store.getNotifications(); setNotifications(fresh); offline.cacheSet("notifications", fresh); } catch (e) { console.error("Rafraîchissement des notifications impossible", e); }
    };
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [currentUser, online]);

  const markNotificationSeenByAdmin = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, seenByAdmin: true } : n)));
    try { await store.markNotificationSeenByAdmin(id); } catch (e) { console.error("Impossible de marquer la notification comme vue", e); }
  };
  const unseenPointage = canSeeAchievements ? notifications.filter((n) => n.type === "pointage" && !n.seenByAdmin) : [];

  const persistObjectives = async (next) => {
    setObjectives(next);
    await store.setSalesObjectives(next, currentUser?.username);
    store.logActivity(currentUser, "set_sales_objectives", `Objectifs de vente modifiés : minimal ${next.minimal}, maximal ${next.maximal}, extraordinaire ${next.extraordinaire}.`);
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
        if (!prevById[p.id]) {
          await store.addProduct({ nom: p.nom, prix: p.prix, stock: p.stock, categorie: p.categorie });
          store.logActivity(currentUser, "add_product", `Produit ajouté : ${p.nom} (stock initial ${p.stock}, prix ${p.prix} FCFA).`);
        } else if (prevById[p.id].stock !== p.stock) {
          await store.updateProductStock(p.id, p.stock);
          store.logActivity(currentUser, "update_product_stock", `Stock de ${p.nom} modifié : ${prevById[p.id].stock} → ${p.stock}.`);
        }
      }
      for (const p of products) {
        if (!next.find((x) => x.id === p.id)) {
          await store.deleteProduct(p.id);
          store.logActivity(currentUser, "delete_product", `Produit supprimé : ${p.nom}.`);
        }
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
        store.logActivity(currentUser, "withdrawal_requested", `Demande de retrait de ${w.montant} FCFA (${w.methode}) pour ${w.vendorNom}.`);
      } else if (prevById[w.id].statut !== w.statut) {
        const payload = { id: w.id, statut: w.statut, extra: { approvedBy: w.approvedBy, refusalReason: w.refusalReason } };
        if (isNewOffline) offline.enqueue({ type: "updateWithdrawalStatus", payload });
        else { try { await store.updateWithdrawalStatus(w.id, w.statut, payload.extra); } catch { offline.enqueue({ type: "updateWithdrawalStatus", payload }); } }
        store.logActivity(currentUser, "withdrawal_status", `Retrait de ${w.montant} FCFA pour ${w.vendorNom} : ${w.statut}${w.refusalReason ? ` (motif : ${w.refusalReason})` : ""}.`);
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

  const ensureTodayInList = useCallback(async (currentList) => {
    if (!currentList.includes(today)) {
      const next = [today, ...currentList];
      setDaysList(next);
      return next;
    }
    return currentList;
  }, [today]);

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

  if (currentUser?.blocked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F7F8FA", fontFamily: "Calibri, Arial, sans-serif" }}>
        <div style={{ maxWidth: 440, background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <AlertTriangle size={36} color="#C1554A" style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1B2A4A", marginBottom: 10 }}>Accès indisponible</div>
          <div style={{ fontSize: 13.5, color: "#5B6472", marginBottom: 22 }}>{currentUser.blockedReason}</div>
          <Button variant="ghost" onClick={handleLogout}>Se déconnecter</Button>
        </div>
      </div>
    );
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
  const isSuperAdmin = !!currentUser.isSuperAdmin;
  const canManage = isAdmin || isManager; // accès Tableau de bord / Finances / Stock / Personnel
  const nav = isAdmin
    ? (currentUser.isPrimary
        ? [...NAV_ADMIN,
           { id: "journal", label: "Journal d'activité", icon: History },
           { id: "supervision", label: "Toutes les conversations", icon: Eye },
           ...(isSuperAdmin ? [{ id: "entreprises", label: "Entreprises (abonnements)", icon: Store }] : [])]
        : [...NAV_ADMIN, ...(isSuperAdmin ? [{ id: "entreprises", label: "Entreprises (abonnements)", icon: Store }] : [])])
    : isManager ? NAV_MANAGER : isMessenger ? NAV_MESSENGER : NAV_VENDOR;
  const roleLabel = isAdmin ? (currentUser.isPrimary ? "admin principal" : "admin") : isManager ? "gestionnaire" : isMessenger ? "agent messagerie" : "vendeur";
  const activeVendor = currentUser.role === "vendor" ? currentVendor : null;

  return (
    <div className="app-shell" data-theme={darkMode ? "dark" : "light"} style={{ display: "flex", minHeight: "100vh", fontFamily: "Calibri, Arial, sans-serif", background: "#F7F8FA" }}>
      <style>{`
        .app-sidebar { position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; transition: transform 0.25s ease; overflow-y: auto; }
        .app-main { margin-left: 220px; }
        .mobile-menu-btn { display: none; }
        .mobile-nav-backdrop { display: none; }
        @media (max-width: 860px) {
          .app-sidebar { transform: translateX(-100%); box-shadow: 0 0 30px rgba(0,0,0,0.25); }
          .app-sidebar.open { transform: translateX(0); }
          .app-main { margin-left: 0; }
          .mobile-menu-btn { display: inline-flex; }
          .mobile-nav-backdrop.open { display: block; position: fixed; inset: 0; background: rgba(21,32,57,0.5); z-index: 90; }
        }

        /* Mode nuit — l'app est construite avec des couleurs fixes en style
           inline (pas de variables CSS d'origine), donc on surcharge par
           dessus avec !important plutôt que de réécrire des centaines de
           styles. Couvre l'essentiel (fond, cartes, tableaux, champs,
           textes) ; un recoin très spécifique peut rester en clair. */
        [data-theme="dark"] { background: #10151F; }
        [data-theme="dark"] .app-main { background: #10151F; }
        [data-theme="dark"] .app-header { background: #10151F !important; border-bottom-color: #232B3D !important; }
        [data-theme="dark"] .app-header h1 { color: #E8EAF0 !important; }
        [data-theme="dark"] .app-date { color: #8B95AC !important; }
        [data-theme="dark"] .card { background: #1A2131 !important; border-color: #262E42 !important; }
        [data-theme="dark"] .card h3 { color: #E8EAF0 !important; }
        [data-theme="dark"] h1, [data-theme="dark"] h2 { color: #E8EAF0 !important; }
        [data-theme="dark"] label { color: #B7BECB !important; }
        [data-theme="dark"] input, [data-theme="dark"] select, [data-theme="dark"] textarea {
          background: #131A28 !important; border-color: #2A3348 !important; color: #E8EAF0 !important;
        }
        [data-theme="dark"] table { color: #D6DAE4 !important; }
        [data-theme="dark"] th { color: #8B95AC !important; border-bottom-color: #262E42 !important; }
        [data-theme="dark"] td { border-bottom-color: #212739 !important; }
        [data-theme="dark"] tr:hover td { background: #1E2536 !important; }
      `}</style>

      {/* Fond semi-transparent derrière le menu mobile ouvert */}
      <div className={`mobile-nav-backdrop${mobileNavOpen ? " open" : ""}`} onClick={() => setMobileNavOpen(false)} />

      {/* Barre latérale — fixe sur web/PC quel que soit le défilement, en tiroir sur mobile */}
      <div className={`app-sidebar${mobileNavOpen ? " open" : ""}`} style={{ width: 220, background: "#152039", color: "#fff", padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
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
          className="dark-mode-btn"
          onClick={() => setDarkMode((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "10px 12px", marginTop: "auto", borderRadius: 8, border: "none", cursor: "pointer",
            background: "transparent", color: "#C7CCDA", fontSize: 13.5, fontWeight: 500,
          }}
        >
          {darkMode ? <Sun size={16} /> : <MoonStar size={16} />}
          {darkMode ? "Mode clair" : "Mode nuit"}
        </button>

        <button
          className="logout-btn"
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
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
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen(true)}
              style={{ background: "#fff", border: "1px solid #E7E9EE", borderRadius: 10, width: 36, height: 36, alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1B2A4A" }}
            >
              <Menu size={18} />
            </button>
            <h1 style={{ margin: 0, fontFamily: "Cambria, Georgia, serif", fontSize: 24, color: "#1B2A4A" }}>
              {nav.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {canManage && (
              <AdminAchievementBell
                achievements={unseenAchievements}
                pointageNotifications={unseenPointage}
                onMarkSeen={markAchievementSeen}
                onMarkPointageSeen={markNotificationSeenByAdmin}
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
        {tab === "actualites" && (
          <NewsFeed currentUser={currentUser} />
        )}
        {tab === "produits" && isAdmin && <Produits products={products} setProducts={persistProducts} reloadProducts={reloadProducts} currentUser={currentUser} />}
        {tab === "stock" && canManage && <Stock products={products} setProducts={persistProducts} currentUser={currentUser} />}
        {tab === "vendeurs" && canManage && (
          <Vendeurs vendors={vendors} reloadVendors={reloadVendors} isAdmin={isAdmin} currentUser={currentUser} daysList={daysList} />
        )}
        {tab === "distribution" && isAdmin && (
          <Distribution products={products} setProducts={persistProducts} vendors={vendors} day={day} setDay={persistDay} ensureTodayInList={ensureTodayInList} daysList={daysList} currentUser={currentUser} today={today} />
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
            currentUser={currentUser}
            today={today}
          />
        )}
        {tab === "presence" && !canManage && (
          <MaPresence vendor={activeVendor} daysList={daysList} today={today} currentUser={currentUser} />
        )}
        {tab === "caisse" && canManage && (
          <Caisse vendors={vendors} day={day} setDay={persistDay} withdrawals={withdrawals} setWithdrawals={persistWithdrawals} notifications={notifications} setNotifications={persistNotifications} daysList={daysList} today={today} currentUser={currentUser} />
        )}
        {tab === "messagerie" && (
          <Messagerie currentUser={currentUser} vendors={vendors} />
        )}
        {tab === "rapports" && canManage && (
          <Rapports vendors={vendors} products={products} daysList={daysList} today={today} day={day} />
        )}
        {tab === "historique" && isAdmin && <Historique vendors={vendors} daysList={daysList} today={today} currentUser={currentUser} reloadVendors={reloadVendors} />}
        {tab === "journal" && isAdmin && currentUser.isPrimary && <JournalActivite />}
        {tab === "supervision" && isAdmin && currentUser.isPrimary && <Supervision currentUser={currentUser} />}
        {tab === "entreprises" && isSuperAdmin && <EntreprisesAdmin currentUser={currentUser} />}
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
  const venteHistory = buildVendeurVenteHistory(daysWithToday, vendor.id);
  const totalPiecesVendues = venteHistory.reduce((s, d) => s + d.totalPieces, 0);

  const bonusTotal = computeVendorBonusTotal(daysWithToday, vendor.id);
  const dejaDemande = (withdrawals || [])
    .filter((w) => w.vendorId === vendor.id && (w.statut === "en_attente" || w.statut === "approuve"))
    .reduce((s, w) => s + w.montant, 0);
  const soldeDisponible = Math.max(0, bonusTotal - dejaDemande);

  const mesRetraits = (withdrawals || []).filter((w) => w.vendorId === vendor.id).slice().reverse();
  const mesNotifications = (notifications || []).filter((n) => n.vendorId === vendor.id).slice().reverse();
  const nonLues = mesNotifications.filter((n) => !n.read);

  const demanderRetrait = async () => {
    if (vendor.contractStatut === "cloture") { setRequestError("Contrat clôturé : les demandes de retrait ne sont plus possibles."); return; }
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

      {vendor.contractStatut === "cloture" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBECEA", border: "1px solid #F0CFC9", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#C1554A", fontWeight: 600 }}>
          <AlertTriangle size={15} /> Contrat clôturé — accès en lecture seule à ton historique. Les ventes et demandes de retrait ne sont plus possibles.
        </div>
      )}
      {vendor.contractStatut === "en_pause" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBF6EA", border: "1px solid #EBDBAF", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#C79A3A", fontWeight: 600 }}>
          <AlertTriangle size={15} /> Contrat en pause.
        </div>
      )}

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
        <StatCard label="PIÈCES VENDUES — TOTAL CUMULÉ" value={totalPiecesVendues} />
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

      <Card title="Historique de mes ventes et versements">
        {venteHistory.length === 0 ? (
          <EmptyState text="Aucune vente enregistrée pour l'instant." />
        ) : (
          <Table
            headers={["Date", "Pièces vendues", "Montant attendu", "Versé", "Statut"]}
            rows={venteHistory.map((d) => [
              formatDateFR(d.date),
              d.totalPieces,
              fmtMoney(d.montantAttendu),
              d.finalise ? fmtMoney((d.montantVerseEspeces || 0) + d.totalMobile) : "En attente",
              d.finalise ? (d.statut === "equilibre" ? "Équilibré" : d.statut === "exces" ? "Excédent" : "Manquant") : "—",
            ])}
          />
        )}
      </Card>

      <Card title="Solde et retrait d'excédent">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: "#5B6472" }}>Solde d'excédent disponible</span>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Cambria, Georgia, serif", color: "#3F8361" }}>{fmtMoney(soldeDisponible)}</span>
        </div>
        {vendor.contractStatut === "cloture" ? (
          <EmptyState text="Les demandes de retrait ne sont plus possibles (contrat clôturé)." />
        ) : soldeDisponible > 0 ? (
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

function Produits({ products, setProducts, reloadProducts, currentUser }) {
  const { showToast } = useToast();
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [stock, setStock] = useState("");
  const [categorie, setCategorie] = useState("");
  const [catEdits, setCatEdits] = useState({});

  const categoriesExistantes = Array.from(new Set(products.map((p) => p.categorie).filter(Boolean)));

  const add = async () => {
    if (!nom.trim() || !prix) return;
    const prixNum = Number(prix);
    const stockNum = stock === "" ? 0 : Number(stock);
    if (Number.isNaN(prixNum) || prixNum <= 0) {
      showToast("Le prix unitaire doit être un nombre positif.", "error");
      return;
    }
    if (Number.isNaN(stockNum) || stockNum < 0) {
      showToast("Le stock initial ne peut pas être négatif.", "error");
      return;
    }
    const next = [...products, { id: uid(), nom: nom.trim(), prix: prixNum, stock: stockNum, categorie: categorie.trim() || "Général" }];
    await setProducts(next);
    setNom(""); setPrix(""); setStock(""); setCategorie("");
  };

  const remove = async (id) => {
    const p = products.find((pp) => pp.id === id);
    const ok = window.confirm(`Supprimer définitivement le produit "${p ? p.nom : ""}" ?\n\nCette action est irréversible.`);
    if (!ok) return;
    await setProducts(products.filter((pp) => pp.id !== id));
    if (p) store.logActivity(currentUser, "delete_product", `Produit supprimé : ${p.nom}.`);
  };

  const saveCategorie = async (id) => {
    const value = catEdits[id];
    if (value === undefined) return;
    await store.updateProductCategorie(id, value);
    const p = products.find((pp) => pp.id === id);
    store.logActivity(currentUser, "update_product_category", `Catégorie de ${p ? p.nom : id} changée : ${value}.`);
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

function Stock({ products, setProducts, currentUser }) {
  const { showToast } = useToast();
  const [adjust, setAdjust] = useState({});

  const reappro = async (id) => {
    const raw = adjust[id];
    const qty = Number(raw);
    if (!raw || Number.isNaN(qty)) return;
    if (qty <= 0) {
      showToast("La quantité réapprovisionnée doit être un nombre positif. Pour corriger un stock à la baisse, utilise l'onglet Produits.", "error");
      return;
    }
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

      <Inventaire products={products} currentUser={currentUser} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventaire physique hebdomadaire (recommandé chaque samedi) — compare le
// stock système à un comptage réel, et n'enregistre que l'écart : on ne
// touche jamais au stock système ici, l'ajustement reste une action
// manuelle séparée (via "Réapprovisionner" ci-dessus si besoin).
// ---------------------------------------------------------------------------

function prochainSamedi(todayIso) {
  const d = new Date(todayIso + "T00:00:00");
  const diff = (6 - d.getDay() + 7) % 7; // 0 si aujourd'hui est déjà samedi
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function Inventaire({ products, currentUser }) {
  const { showToast } = useToast();
  const today = todayISO();
  const estSamedi = new Date(today + "T00:00:00").getDay() === 6;

  const [qtyPhysique, setQtyPhysique] = useState({}); // productId -> valeur saisie (texte)
  const [historique, setHistorique] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // date dépliée dans l'historique
  const [saving, setSaving] = useState(false);

  const reloadHistorique = async () => setHistorique(await store.getInventaires());
  useEffect(() => { reloadHistorique(); }, []);

  const physiqueDe = (p) => (qtyPhysique[p.id] !== undefined ? qtyPhysique[p.id] : String(p.stock));
  const ecartDe = (p) => Number(physiqueDe(p)) - Number(p.stock);

  const nbEcarts = products.filter((p) => ecartDe(p) !== 0).length;

  const enregistrer = async () => {
    setSaving(true);
    const lignes = products.map((p) => ({
      productId: p.id, productNom: p.nom,
      stockSysteme: Number(p.stock), stockPhysique: Number(physiqueDe(p)), ecart: ecartDe(p),
    }));
    try {
      await store.saveInventaire({ date: today, lignes, createdBy: currentUser?.username });
      await store.logActivity(currentUser, "inventaire", `Inventaire du ${fmtDateFr(today)} enregistré (${lignes.filter((l) => l.ecart !== 0).length} écart(s)).`);
      showToast(`Inventaire du ${fmtDateFr(today)} enregistré.`, "success");
      // Impression automatique du résultat qui vient d'être enregistré, avant
      // que le formulaire ne soit réinitialisé.
      printInventaire();
      setQtyPhysique({});
      await reloadHistorique();
    } catch (err) {
      showToast("Erreur lors de l'enregistrement de l'inventaire : " + (err.message || err), "error");
    }
    setSaving(false);
  };

  // Impression / export PDF de l'inventaire du jour, sur le même principe
  // que les rapports : on marque la zone imprimable juste avant window.print()
  // pour éviter tout problème de timing avec le rendu React.
  const printRef = useRef(null);
  const printInventaire = () => {
    if (!printRef.current) return;
    document.body.classList.add("printing-section");
    printRef.current.setAttribute("data-print-active", "true");
    window.print();
    const cleanup = () => {
      printRef.current?.removeAttribute("data-print-active");
      document.body.classList.remove("printing-section");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
  };

  // Impression du détail d'un inventaire de l'historique (le "résultat
  // enregistré" en bas de page), sur le même principe que l'inventaire du
  // jour.
  const historiquePrintRef = useRef(null);
  const printHistorique = () => {
    if (!historiquePrintRef.current) return;
    document.body.classList.add("printing-section");
    historiquePrintRef.current.setAttribute("data-print-active", "true");
    window.print();
    const cleanup2 = () => {
      historiquePrintRef.current?.removeAttribute("data-print-active");
      document.body.classList.remove("printing-section");
      window.removeEventListener("afterprint", cleanup2);
    };
    window.addEventListener("afterprint", cleanup2);
  };
  const selectedInv = historique?.find((inv) => inv.date === selectedDate) || null;

  return (
    <>
      <style>{`
        @media print {
          body.printing-section * { visibility: hidden; }
          body.printing-section [data-print-active="true"],
          body.printing-section [data-print-active="true"] * { visibility: visible; }
          body.printing-section [data-print-active="true"] { position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          body.printing-section [data-print-active="true"] .print-value { display: inline !important; }
        }
      `}</style>

      <div ref={printRef}>
        <Card
          title={`Inventaire physique — ${fmtDateFr(today)}`}
          right={
            <span className="no-print" style={{ fontSize: 12.5, color: estSamedi ? "#3F9C6D" : "#8A93A3", fontWeight: estSamedi ? 700 : 400 }}>
              {estSamedi ? "C'est aujourd'hui le jour de l'inventaire hebdomadaire" : `Prochain inventaire recommandé : ${fmtDateFr(prochainSamedi(today))}`}
            </span>
          }
        >
          <div className="no-print" style={{ marginBottom: 12, fontSize: 12.5, color: "#8A93A3" }}>
            Compare le stock système au comptage réel des produits. Le stock système n'est pas modifié — seul l'écart est enregistré, pour vérification.
          </div>
          <Table
            headers={["Produit", "Stock système", "Stock physique compté", "Écart"]}
            rows={products.map((p) => {
              const ecart = ecartDe(p);
              return [
                p.nom, p.stock,
                <React.Fragment key="q">
                  <TextInput
                    type="number" style={{ width: 90 }} className="no-print"
                    value={physiqueDe(p)}
                    onChange={(e) => setQtyPhysique((s) => ({ ...s, [p.id]: e.target.value }))}
                  />
                  <span className="print-value" style={{ display: "none" }}>{physiqueDe(p)}</span>
                </React.Fragment>,
                <span key="e" style={{ fontWeight: 700, color: ecart === 0 ? "#8A93A3" : ecart > 0 ? "#3F9C6D" : "#C1554A" }}>
                  {ecart > 0 ? `+${ecart}` : ecart}
                </span>,
              ];
            })}
          />
          <div className="no-print" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: nbEcarts > 0 ? "#C1554A" : "#8A93A3" }}>
              {nbEcarts > 0 ? `${nbEcarts} produit${nbEcarts > 1 ? "s" : ""} avec écart` : "Aucun écart pour l'instant"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={enregistrer} disabled={saving}>
                <ClipboardList size={15} /> Enregistrer et imprimer l'inventaire du {fmtDateFr(today)}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Historique des inventaires">
        {historique === null ? (
          <EmptyState text="Chargement…" />
        ) : historique.length === 0 ? (
          <EmptyState text="Aucun inventaire enregistré pour l'instant." />
        ) : (
          <Table
            headers={["Date", "Produits comptés", "Écarts", ""]}
            rows={historique.flatMap((inv) => {
              const nbEc = inv.lignes.filter((l) => l.ecart !== 0).length;
              const rows = [[
                fmtDateFr(inv.date), inv.lignes.length,
                <Badge key="b" ok={nbEc === 0} okText="Aucun écart" warnText={`${nbEc} écart(s)`} />,
                <button
                  key="t" onClick={() => setSelectedDate(selectedDate === inv.date ? null : inv.date)}
                  style={{ background: "none", border: "none", color: "#1B2A4A", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
                >
                  {selectedDate === inv.date ? "Masquer" : "Détail"}
                </button>,
              ]];
              if (selectedDate === inv.date) {
                rows.push([
                  <div key="detail">
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                      <Button variant="gold" onClick={printHistorique}>
                        <Printer size={15} /> Imprimer / Enregistrer en PDF
                      </Button>
                    </div>
                    <Table
                      headers={["Produit", "Stock système", "Stock physique", "Écart"]}
                      rows={inv.lignes.map((l) => [
                        l.productNom, l.stockSysteme, l.stockPhysique,
                        <span key="e" style={{ fontWeight: 700, color: l.ecart === 0 ? "#8A93A3" : l.ecart > 0 ? "#3F9C6D" : "#C1554A" }}>
                          {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                        </span>,
                      ])}
                    />
                  </div>,
                ]);
              }
              return rows;
            })}
          />
        )}
      </Card>

      {selectedInv && (
        <div ref={historiquePrintRef} style={{ display: "none" }}>
          <Card>
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 21, fontWeight: 700, color: "#1B2A4A" }}>
                Inventaire physique — {fmtDateFr(selectedInv.date)}
              </div>
              <div style={{ fontSize: 12, color: "#8A93A3" }}>
                Enregistré{selectedInv.createdBy ? ` par ${selectedInv.createdBy}` : ""}
              </div>
            </div>
            <Table
              headers={["Produit", "Stock système", "Stock physique", "Écart"]}
              rows={selectedInv.lignes.map((l) => [
                l.productNom, l.stockSysteme, l.stockPhysique,
                <span key="e" style={{ fontWeight: 700, color: l.ecart === 0 ? "#8A93A3" : l.ecart > 0 ? "#3F9C6D" : "#C1554A" }}>
                  {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                </span>,
              ])}
            />
          </Card>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Vendeurs & comptes
// ---------------------------------------------------------------------------

function Vendeurs({ vendors, reloadVendors, isAdmin, currentUser, daysList }) {
  const { showToast } = useToast();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [numeroCni, setNumeroCni] = useState("");
  const [pieceNature, setPieceNature] = useState("cni");
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
      // On réutilise un lien déjà actif s'il en existe un, plutôt que d'en
      // créer un nouveau à chaque clic — sinon plusieurs liens valides
      // s'accumulent pour le même vendeur, tous utilisables en parallèle.
      const existing = await store.getInviteLinkForVendor(vendorId);
      if (existing) {
        setInviteUrls((m) => ({ ...m, [vendorId]: existing }));
        showToast("Un lien d'invitation est déjà actif pour ce vendeur — il a été réutilisé plutôt que d'en créer un nouveau.", "info");
      } else {
        const created = await store.createInviteLink({ vendorId, role: "vendor" });
        setInviteUrls((m) => ({ ...m, [vendorId]: created }));
        const v = vendors.find((vv) => vv.id === vendorId);
        store.logActivity(currentUser, "create_invite_link", `Lien d'invitation généré${v ? ` pour ${v.nom}` : ""}.`);
      }
    } catch (e) {
      setError(e.message || "Erreur lors de la création du lien.");
    }
    setInviteBusy(null);
  };

  const revokeInvite = async (vendorId) => {
    const invite = inviteUrls[vendorId];
    if (!invite) return;
    const v = vendors.find((vv) => vv.id === vendorId);
    const ok = window.confirm(`Révoquer ce lien d'invitation${v ? ` pour ${v.nom}` : ""} ?\n\nIl ne pourra plus être utilisé pour créer un compte.`);
    if (!ok) return;
    try {
      await store.revokeInviteLink(invite.id);
      setInviteUrls((m) => { const n = { ...m }; delete n[vendorId]; return n; });
      store.logActivity(currentUser, "revoke_invite_link", `Lien d'invitation révoqué${v ? ` pour ${v.nom}` : ""}.`);
    } catch (e) {
      setError(e.message || "Erreur lors de la révocation du lien.");
    }
  };

  const copyInvite = (url) => {
    navigator.clipboard?.writeText(url);
    showToast("Lien d'invitation copié.", "success", 2500);
  };

  // Messagerie et admin secondaire n'ont pas d'entité préexistante (contrairement
  // au vendeur) : on gère donc une liste de liens en attente par rôle, plutôt
  // qu'un lien par cible.
  const [genericInvites, setGenericInvites] = useState({ messenger: [], admin: [] });
  const [genericInviteBusy, setGenericInviteBusy] = useState(null);

  const loadGenericInvites = async (role) => {
    try {
      const list = await store.listPendingInvites(role);
      setGenericInvites((m) => ({ ...m, [role]: list }));
    } catch (e) {
      // silencieux : ce n'est qu'un rafraîchissement d'affichage
    }
  };

  useEffect(() => {
    if (isAdmin) loadGenericInvites("messenger");
    if (currentUser?.isPrimary) loadGenericInvites("admin");
  }, [isAdmin, currentUser?.isPrimary]);

  const generateGenericInvite = async (role) => {
    setGenericInviteBusy(role);
    if (role === "admin") setAdminError(""); else setMsgError("");
    try {
      const created = await store.createInviteLink({ role });
      await loadGenericInvites(role);
      const label = role === "messenger" ? "messagerie" : "administrateur secondaire";
      store.logActivity(currentUser, "create_invite_link", `Lien d'invitation généré (compte ${label}).`);
      showToast("Lien d'invitation généré — pense à le copier avant de quitter cet onglet.", "success");
    } catch (e) {
      // L'erreur doit s'afficher près du bouton cliqué (carte messagerie ou
      // carte admin secondaire) et non dans l'état "error" général, affiché
      // tout en haut de la page près du formulaire d'ajout de vendeur — sinon
      // elle passe inaperçue et l'action semble ne rien faire.
      const msg = e.message || "Erreur lors de la création du lien.";
      if (role === "admin") setAdminError(msg); else setMsgError(msg);
    }
    setGenericInviteBusy(null);
  };

  const revokeGenericInvite = async (role, inviteId) => {
    const ok = window.confirm("Révoquer ce lien d'invitation ?\n\nIl ne pourra plus être utilisé pour créer un compte.");
    if (!ok) return;
    try {
      await store.revokeInviteLink(inviteId);
      await loadGenericInvites(role);
      const label = role === "messenger" ? "messagerie" : "administrateur secondaire";
      store.logActivity(currentUser, "revoke_invite_link", `Lien d'invitation révoqué (compte ${label}).`);
    } catch (e) {
      const msg = e.message || "Erreur lors de la révocation du lien.";
      if (role === "admin") setAdminError(msg); else setMsgError(msg);
    }
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
    if (!isStrongPassword(msgPassword)) { setMsgError(PASSWORD_HELP_TEXT); return; }
    setMsgError("");
    setMsgBusy(true);
    try {
      await store.createAccount({ username: msgUsername.trim(), password: msgPassword, role: "messenger" });
      await reloadAccounts();
      store.logActivity(currentUser, "add_messenger", `Compte messagerie créé : ${msgUsername.trim()}.`);
      setMsgUsername(""); setMsgPassword("");
    } catch (e) {
      setMsgError(e.message || "Erreur lors de la création.");
    }
    setMsgBusy(false);
  };

  const removeMessenger = async (id, name) => {
    const ok = window.confirm(`Supprimer définitivement le compte messagerie de ${name} ?\n\nCette action est irréversible.`);
    if (!ok) return;
    try {
      await store.deleteAccount(id);
      await reloadAccounts();
      store.logActivity(currentUser, "delete_messenger", `Compte messagerie supprimé : ${name}.`);
    } catch (e) {
      setMsgError(e.message || "Erreur lors de la suppression.");
    }
  };

  const add = async () => {
    if (!nom.trim()) { setError("Indique un nom de vendeur."); return; }
    if (!prenom.trim()) { setError("Indique un prénom."); return; }
    if (!dateNaissance) { setError("Indique une date de naissance."); return; }
    if (!telephone.trim()) { setError("Indique un numéro de téléphone."); return; }
    if (!isValidCameroonPhone(telephone)) { setError("Le numéro de téléphone doit être un numéro mobile camerounais valide (9 chiffres commençant par 6, ex. 6XX XX XX XX)."); return; }
    if (username.trim() && !password) { setError("Indique un mot de passe pour ce compte."); return; }
    if (password && !isStrongPassword(password)) { setError(PASSWORD_HELP_TEXT); return; }
    setError("");
    setBusy(true);
    try {
      const vendor = await store.addVendor({
        nom: nom.trim(),
        prenom: prenom.trim(),
        numeroCni: numeroCni.trim(),
        pieceNature,
        dateNaissance: dateNaissance || null,
        telephone: telephone.trim(),
      });
      // La photo reste recommandée mais n'est plus obligatoire : on ne
      // l'envoie que si l'admin en a choisi une, sans bloquer la création
      // du vendeur si l'envoi échoue.
      if (photoFile) {
        try {
          await store.uploadVendorPhoto(vendor.id, photoFile);
          store.logActivity(currentUser, "upload_vendor_photo", `Photo ajoutée pour ${nom.trim()}.`);
        } catch (photoErr) {
          showToast(`Vendeur créé, mais la photo n'a pas pu être envoyée : ${photoErr.message || photoErr}`, "error", 8000);
        }
      }
      if (username.trim()) {
        await store.createAccount({ username: username.trim(), password, role: "vendor", vendorId: vendor.id });
      }
      await reloadVendors();
      await reloadAccounts();
      store.logActivity(currentUser, "add_vendor", `Vendeur ajouté : ${nom.trim()}.`);
      setNom(""); setPrenom(""); setNumeroCni(""); setPieceNature("cni"); setDateNaissance(""); setTelephone(""); setUsername(""); setPassword("");
      setPhotoFile(null); setPhotoPreview("");
    } catch (e) {
      setError(e.message || "Erreur lors de la création.");
    }
    setBusy(false);
  };

  const remove = async (id, nomVendeur) => {
    const ok = window.confirm(
      `Supprimer définitivement le vendeur ${nomVendeur} ?\n\nSon compte de connexion (s'il existe) sera aussi supprimé. Cette action est irréversible.`
    );
    if (!ok) return;
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
    const ok = window.confirm(`Supprimer définitivement le compte gestionnaire de ${name} ?\n\nCette action est irréversible.`);
    if (!ok) return;
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
    if (!isStrongPassword(adminPassword)) { setAdminError(PASSWORD_HELP_TEXT); return; }
    setAdminError("");
    setAdminBusy(true);
    try {
      await store.createAccount({ username: adminName.trim(), password: adminPassword, role: "admin" });
      await reloadAccounts();
      store.logActivity(currentUser, "add_secondary_admin", `Compte administrateur secondaire créé : ${adminName.trim()}.`);
      setAdminName(""); setAdminPassword("");
    } catch (e) {
      setAdminError(e.message || "Erreur lors de la création.");
    }
    setAdminBusy(false);
  };

  const removeAdmin = async (id, name) => {
    const ok = window.confirm(`Supprimer définitivement le compte administrateur secondaire de ${name} ?\n\nCette action est irréversible.`);
    if (!ok) return;
    try {
      await store.deleteAccount(id);
      await reloadAccounts();
      store.logActivity(currentUser, "delete_secondary_admin", `Compte administrateur secondaire supprimé : ${name}.`);
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
            <Label>Nom du vendeur *</Label>
            <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Awa" />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <Label>Prénom *</Label>
            <TextInput value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0F1F4" }}>
          <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
            Champs obligatoires, sauf le numéro de pièce et la photo qui restent facultatifs.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Nature de la pièce</Label>
              <Select value={pieceNature} onChange={(e) => setPieceNature(e.target.value)}>
                {PIECE_NATURE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Numéro / référence de la pièce</Label>
              <TextInput value={numeroCni} onChange={(e) => setNumeroCni(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Date de naissance *</Label>
              <TextInput type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Téléphone *</Label>
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
        <div style={{ marginTop: 14 }}>
          <Button onClick={add} disabled={busy}><Plus size={15} /> {busy ? "Ajout…" : "Ajouter"}</Button>
        </div>
      </Card>

      <Card title={`Équipe (${vendors.length})`}>
        {vendors.length === 0 ? (
          <EmptyState text="Aucun vendeur enregistré." />
        ) : (
          <Table
            headers={["Nom", "Pièce d'identité", "Téléphone", "Compte de connexion", "Présence", "Statut", "", "", ""]}
            rows={vendors.map((v) => {
              const u = vendorAccounts.find((u) => u.vendorId === v.id);
              const p = presence[v.id];
              const invite = inviteUrls[v.id];
              const contrat = CONTRACT_STATUT_LABELS[v.contractStatut || "actif"];
              return [
                vendorFullName(v),
                v.numeroCni ? `${PIECE_NATURE_LABELS[v.pieceNature] || "Pièce"} — ${v.numeroCni}` : "—",
                v.telephone || "—",
                u ? u.username : "— aucun —",
                u ? <PresenceDot key="p" isOnline={p?.isOnline} lastSeenAt={p?.lastSeenAt} showLabel /> : "—",
                <span key="cs" style={{ fontSize: 11.5, fontWeight: 700, color: contrat.color, padding: "3px 8px", borderRadius: 999, background: `${contrat.color}1A` }}>{contrat.label}</span>,
                <button key="fiche" onClick={() => setFicheVendorId(v.id)} title="Voir la fiche détaillée" style={{ ...iconBtnStyle, color: "#5B6472" }}>
                  <Eye size={15} />
                </button>,
                u ? (
                  <button key="conv" onClick={() => convertToMessenger(u.id, v.nom)} title="Passer en compte messagerie uniquement" style={{ ...iconBtnStyle, color: "#5B6472" }}>
                    <MessageSquare size={15} />
                  </button>
                ) : invite ? (
                  <div key="invite-actions" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button onClick={() => copyInvite(invite.url)} title={`Copier le lien d'invitation (valide jusqu'au ${invite.expiresAt ? formatDateFR(isoFromDate(new Date(invite.expiresAt))) : "—"})`} style={{ ...iconBtnStyle, color: "#3F9C6D" }}>
                      <Link2 size={15} />
                    </button>
                    <button onClick={() => revokeInvite(v.id)} title="Révoquer ce lien d'invitation" style={{ ...iconBtnStyle, color: "#C1554A" }}>
                      <X size={15} />
                    </button>
                  </div>
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
            Le lien expire 7 jours après sa création — l'icône <X size={11} style={{ verticalAlign: "middle" }} /> permet de le révoquer avant terme si besoin.
          </div>
        )}
      </Card>

      {ficheVendorId && (
        <VendorFiche
          vendor={vendors.find((v) => v.id === ficheVendorId)}
          onClose={() => setFicheVendorId(null)}
          currentUser={currentUser}
          reloadVendors={reloadVendors}
          daysList={daysList}
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
            <Button variant="gold" onClick={() => generateGenericInvite("messenger")} disabled={genericInviteBusy === "messenger"}>
              <Send size={15} /> {genericInviteBusy === "messenger" ? "Génération…" : "Générer un lien d'invitation"}
            </Button>
          </div>
          {msgError && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 10 }}>{msgError}</div>}

          {genericInvites.messenger.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "#8A93A3", marginBottom: 8 }}>Liens d'invitation en attente (7 jours de validité) :</div>
              <Table
                headers={["Créé le", "Expire le", ""]}
                rows={genericInvites.messenger.map((inv) => [
                  inv.createdAt ? formatDateFR(isoFromDate(new Date(inv.createdAt))) : "—",
                  inv.expiresAt ? formatDateFR(isoFromDate(new Date(inv.expiresAt))) : "—",
                  <div key="actions" style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => copyInvite(inv.url)} title="Copier le lien" style={{ ...iconBtnStyle, color: "#3F9C6D" }}><Link2 size={15} /></button>
                    <button onClick={() => revokeGenericInvite("messenger", inv.id)} title="Révoquer ce lien" style={{ ...iconBtnStyle, color: "#C1554A" }}><X size={15} /></button>
                  </div>,
                ])}
              />
            </div>
          )}

          {messengers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Table
                headers={["Nom d'utilisateur", ""]}
                rows={messengers.map((m) => [
                  m.username,
                  <button key="del" onClick={() => removeMessenger(m.id, m.username)} style={iconBtnStyle}><Trash2 size={15} /></button>,
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
            <Button variant="gold" onClick={() => generateGenericInvite("admin")} disabled={genericInviteBusy === "admin"}>
              <Send size={15} /> {genericInviteBusy === "admin" ? "Génération…" : "Générer un lien d'invitation"}
            </Button>
          </div>
          {adminError && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 10 }}>{adminError}</div>}

          {genericInvites.admin.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "#8A93A3", marginBottom: 8 }}>Liens d'invitation en attente (7 jours de validité) :</div>
              <Table
                headers={["Créé le", "Expire le", ""]}
                rows={genericInvites.admin.map((inv) => [
                  inv.createdAt ? formatDateFR(isoFromDate(new Date(inv.createdAt))) : "—",
                  inv.expiresAt ? formatDateFR(isoFromDate(new Date(inv.expiresAt))) : "—",
                  <div key="actions" style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => copyInvite(inv.url)} title="Copier le lien" style={{ ...iconBtnStyle, color: "#3F9C6D" }}><Link2 size={15} /></button>
                    <button onClick={() => revokeGenericInvite("admin", inv.id)} title="Révoquer ce lien" style={{ ...iconBtnStyle, color: "#C1554A" }}><X size={15} /></button>
                  </div>,
                ])}
              />
            </div>
          )}

          {secondaryAdmins.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Table
                headers={["Nom d'utilisateur", ""]}
                rows={secondaryAdmins.map((a) => [
                  a.username,
                  <button key="del" onClick={() => removeAdmin(a.id, a.username)} style={iconBtnStyle}><Trash2 size={15} /></button>,
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
  const [entries, setEntries] = useState({}); // vendorId -> { statut, notes, heure }
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
      rows.forEach((r) => { map[r.vendorId] = { statut: r.statut, notes: r.notes || "", heure: r.heure || null }; });
      setEntries(map);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement.");
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [date, open]);

  const setStatut = (vendorId, statut) => {
    // L'heure exacte du clic est mémorisée : c'est elle qui sera affichée et
    // communiquée au vendeur ainsi qu'à tous les admins une fois enregistrée.
    setEntries((m) => ({ ...m, [vendorId]: { ...(m[vendorId] || { notes: "" }), statut, heure: nowHHMM() } }));
  };
  const setNotes = (vendorId, notes) => {
    setEntries((m) => ({ ...m, [vendorId]: { ...(m[vendorId] || { statut: "present" }), notes } }));
  };
  const markAllPresent = () => {
    const map = {};
    vendors.forEach((v) => { map[v.id] = { statut: "present", notes: entries[v.id]?.notes || "", heure: nowHHMM() }; });
    setEntries(map);
  };

  const save = async () => {
    const toSave = vendors
      .filter((v) => entries[v.id]?.statut)
      .map((v) => ({ vendorId: v.id, statut: entries[v.id].statut, notes: entries[v.id].notes, heure: entries[v.id].heure }));
    if (toSave.length === 0) { setError("Marque au moins un vendeur avant d'enregistrer."); return; }
    setSaving(true);
    setError("");
    try {
      await store.setVendorAttendanceBulk(date, toSave, currentUser?.id);
      setSaved(true);
      store.logActivity(currentUser, "set_attendance_bulk", `Pointage du ${fmtDateFr(date)} enregistré pour ${toSave.length} vendeur(s).`);
      // Le pointage du jour même déclenche une notification à la fois pour
      // le vendeur concerné (il voit l'heure exacte de son pointage) et pour
      // tous les admins (visible dans la cloche de notifications).
      if (date === todayISO()) {
        for (const v of vendors) {
          const e = entries[v.id];
          if (!e?.statut || !e.heure) continue;
          const message = `Pointage : ${STATUT_LABELS[e.statut]?.label || e.statut} à ${e.heure}${currentUser?.username ? ` (par ${currentUser.username})` : ""}`;
          try { await store.createNotification({ vendorId: v.id, message, type: "pointage", seenByAdmin: false }); } catch (err) { console.error("Notification de pointage impossible", err); }
        }
      }
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
                const e = entries[v.id] || { statut: null, notes: "", heure: null };
                return (
                  <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingBottom: 10, borderBottom: "1px solid #F3F4F7" }}>
                    <div style={{ width: 140, fontWeight: 600, fontSize: 13.5, color: "#1B2A4A" }}>{vendorFullName(v)}</div>
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
                    {e.heure && (
                      <span style={{ fontSize: 11.5, color: "#8A93A3", display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={12} color="#3F9C6D" /> Pointé à {e.heure}
                      </span>
                    )}
                    <TextInput placeholder="Note (facultatif)" value={e.notes} onChange={(ev) => setNotes(v.id, ev.target.value)} style={{ flex: "1 1 160px", maxWidth: 220 }} />
                  </div>
                );
              })}
            </div>
          )}

          {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
          {saved && <div style={{ color: "#3F9C6D", fontSize: 12.5, marginTop: 12 }}>Pointage enregistré. Le vendeur et tous les admins peuvent voir l'heure exacte.</div>}
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

const PIECE_NATURE_OPTIONS = [
  { value: "cni", label: "Carte d'identité nationale" },
  { value: "acte_naissance", label: "Acte de naissance" },
  { value: "carte_scolaire", label: "Carte scolaire" },
  { value: "carte_etudiant", label: "Carte d'étudiant" },
  { value: "piece_parentale", label: "Pièce parentale" },
];
const PIECE_NATURE_LABELS = Object.fromEntries(PIECE_NATURE_OPTIONS.map((o) => [o.value, o.label]));

const CONTRACT_STATUT_LABELS = {
  actif: { label: "Actif", color: "#3F9C6D" },
  en_pause: { label: "En pause", color: "#C79A3A" },
  cloture: { label: "Clôturé", color: "#C1554A" },
};

function VendorFiche({ vendor, onClose, currentUser, reloadVendors, daysList }) {
  const { showToast } = useToast();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(vendor?.photoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [statut, setStatut] = useState("present");
  const [heurePointage, setHeurePointage] = useState(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contractStatut, setContractStatut] = useState(vendor?.contractStatut || "actif");
  const [contractSaving, setContractSaving] = useState(false);
  const [allDaysForCycle, setAllDaysForCycle] = useState(null);
  const [latestCycle, setLatestCycle] = useState(null);
  const [contestations, setContestations] = useState([]);
  const [payingCycle, setPayingCycle] = useState(false);
  const [activeResolveId, setActiveResolveId] = useState(null);
  const [resolveMsg, setResolveMsg] = useState("");
  const [resolving, setResolving] = useState(false);
  const [editingRegDate, setEditingRegDate] = useState(false);
  const [regDateInput, setRegDateInput] = useState(vendor?.dateEnregistrement || "");
  const [regDateSaving, setRegDateSaving] = useState(false);
  const [todayDay, setTodayDay] = useState(null);
  const [cycleHistory, setCycleHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const fileRef = useRef(null);
  const today = todayISO();
  const isAdmin = currentUser?.role === "admin";

  const load = async () => {
    setLoading(true);
    const h = await store.getVendorAttendanceHistory(vendor.id, 400);
    setHistory(h);
    const t = h.find((a) => a.date === today);
    if (t) { setStatut(t.statut); setNotes(t.notes || ""); setHeurePointage(t.heureArrivee || null); }
    try {
      const [allDays, cycle, contest, dayToday, cycles, allWithdrawals] = await Promise.all([
        store.getDaysInRange(daysList || []),
        store.getLatestSalaryCycle(vendor.id),
        store.getContestationsForVendor(vendor.id),
        store.getDay(today),
        store.getSalaryCycleHistory(vendor.id),
        store.getWithdrawals(),
      ]);
      setAllDaysForCycle(allDays);
      setLatestCycle(cycle);
      setContestations(contest);
      setTodayDay(dayToday);
      setCycleHistory(cycles);
      setWithdrawals(allWithdrawals.filter((w) => w.vendorId === vendor.id));
    } catch (e) {
      console.error("Chargement des données de salaire/présence impossible", e);
    }
    setLoading(false);
  };

  useEffect(() => { if (vendor) load(); }, [vendor?.id]);
  useEffect(() => { setContractStatut(vendor?.contractStatut || "actif"); }, [vendor?.id, vendor?.contractStatut]);
  useEffect(() => { setRegDateInput(vendor?.dateEnregistrement || ""); setEditingRegDate(false); }, [vendor?.id, vendor?.dateEnregistrement]);

  if (!vendor) return null;

  const presentCount = history.filter((a) => a.statut === "present").length;
  const absAutorise = history.filter((a) => a.statut === "absent_autorise").length;
  const absNonAutorise = history.filter((a) => a.statut === "absent_non_autorise").length;
  const versementToday = todayDay ? computeVersementSummary(todayDay, vendor.id) : null;
  const venteHistory = allDaysForCycle ? buildVendeurVenteHistory(allDaysForCycle, vendor.id) : [];
  const totalPiecesVendues = venteHistory.reduce((s, d) => s + d.totalPieces, 0);
  const totalVerseGlobal = venteHistory.reduce((s, d) => s + (d.finalise ? (d.montantVerseEspeces || 0) + d.totalMobile : 0), 0);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await store.uploadVendorPhoto(vendor.id, file);
      setPhotoUrl(url);
      store.logActivity(currentUser, "upload_vendor_photo", `Photo mise à jour pour ${vendor.nom}.`);
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi de la photo.");
    }
    setUploading(false);
  };

  const saveAttendance = async () => {
    setSaving(true);
    setError("");
    const heure = heurePointage || nowHHMM();
    try {
      await store.setVendorAttendance({ vendorId: vendor.id, date: today, statut, notes, heure, validatedBy: currentUser?.id });
      await load();
      store.logActivity(currentUser, "set_attendance", `Présence du ${fmtDateFr(today)} pour ${vendor.nom} : ${STATUT_LABELS[statut].label}.`);
      const message = `Pointage : ${STATUT_LABELS[statut]?.label || statut} à ${heure}${currentUser?.username ? ` (par ${currentUser.username})` : ""}`;
      try { await store.createNotification({ vendorId: vendor.id, message, type: "pointage", seenByAdmin: false }); } catch (err) { console.error("Notification de pointage impossible", err); }
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement.");
    }
    setSaving(false);
  };

  const saveContractStatut = async (next) => {
    setContractSaving(true);
    setError("");
    try {
      await store.setVendorContractStatut(vendor.id, next);
      setContractStatut(next);
      if (reloadVendors) await reloadVendors();
      store.logActivity(currentUser, "set_contract_statut", `Statut de contrat de ${vendor.nom} : ${CONTRACT_STATUT_LABELS[next].label}.`);
    } catch (err) {
      setError(err.message || "Erreur lors de la mise à jour du statut de contrat.");
    }
    setContractSaving(false);
  };

  const saveRegDate = async () => {
    if (!regDateInput) { setError("Choisis une date."); return; }
    if (regDateInput > today) { setError("La date d'enregistrement ne peut pas être dans le futur."); return; }
    // Tant qu'aucun premier cycle de salaire n'a encore été versé, cette date
    // sert de point de départ au calcul des jours payables — la modifier
    // change donc potentiellement le montant du premier salaire.
    const affectsPay = !latestCycle;
    const ok = window.confirm(
      affectsPay
        ? `Corriger la date d'enregistrement de ${vendor.nom} au ${formatDateFR(regDateInput)} ?\n\nAucun salaire n'a encore été versé pour ce vendeur : cette date deviendra le point de départ du calcul des jours payables de son premier cycle.`
        : `Corriger la date d'enregistrement de ${vendor.nom} au ${formatDateFR(regDateInput)} ?\n\nCeci est purement informatif : un cycle de salaire a déjà été versé, donc les calculs de paie en cours ne sont pas affectés.`
    );
    if (!ok) return;
    setRegDateSaving(true);
    setError("");
    try {
      await store.setVendorRegistrationDate(vendor.id, regDateInput);
      if (reloadVendors) await reloadVendors();
      store.logActivity(currentUser, "edit_vendor_registration_date", `Date d'enregistrement de ${vendor.nom} corrigée au ${formatDateFR(regDateInput)}.`);
      showToast("Date d'enregistrement mise à jour.", "success");
      setEditingRegDate(false);
    } catch (err) {
      setError(err.message || "Erreur lors de la mise à jour de la date.");
    }
    setRegDateSaving(false);
  };

  const cycleStart = latestCycle ? addDays(latestCycle.cycleEnd, 1) : (vendor.dateEnregistrement || today);
  const retourDoneDates = allDaysForCycle ? buildRetourDoneDates(allDaysForCycle, vendor.id) : new Set();
  const cycleJours = allDaysForCycle ? buildPresenceCycle(cycleStart, today, history, retourDoneDates) : [];
  const joursComptesCycle = cycleJours.filter((j) => j.payable).length;

  const marquerSalaireVerse = async () => {
    setPayingCycle(true);
    setError("");
    try {
      await store.markSalaryCyclePaid({
        vendorId: vendor.id, cycleStart, cycleEnd: today, joursComptes: joursComptesCycle, montant: null, paidBy: currentUser?.id,
      });
      store.logActivity(currentUser, "salary_paid", `Salaire marqué comme versé pour ${vendor.nom} (${joursComptesCycle} jour(s) de présence, cycle du ${fmtDateFr(cycleStart)} au ${fmtDateFr(today)}).`);
      await load();
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement du versement.");
    }
    setPayingCycle(false);
  };

  const resoudreContestation = async (id) => {
    setResolving(true);
    setError("");
    try {
      await store.resolveContestation(id, { adminResponse: resolveMsg, resolvedBy: currentUser?.id });
      store.logActivity(currentUser, "resolve_contestation", `Contestation de présence de ${vendor.nom} résolue.`);
      setActiveResolveId(null);
      setResolveMsg("");
      await load();
    } catch (err) {
      setError(err.message || "Erreur lors de la résolution.");
    }
    setResolving(false);
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
                <img src={photoUrl} alt={vendorFullName(vendor)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
            <h2 style={{ margin: 0, fontFamily: "Cambria, Georgia, serif", fontSize: 21, color: "#1B2A4A" }}>{vendorFullName(vendor)}</h2>
            <div style={{ fontSize: 12.5, color: "#8A93A3", marginTop: 4 }}>
              {vendor.numeroCni ? `${PIECE_NATURE_LABELS[vendor.pieceNature] || "Pièce"} ${vendor.numeroCni}` : "Pièce d'identité non renseignée"} · {vendor.telephone || "téléphone non renseigné"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: "1 1 140px" }}>
            <Label>Date de naissance</Label>
            <div style={{ fontSize: 13.5, color: "#1B2A4A" }}>{fmtDateFr(vendor.dateNaissance)}</div>
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <Label>Date d'enregistrement</Label>
            {editingRegDate ? (
              <div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <TextInput type="date" value={regDateInput} max={today} onChange={(e) => setRegDateInput(e.target.value)} style={{ width: 150 }} />
                  <Button onClick={saveRegDate} disabled={regDateSaving} style={{ padding: "6px 10px" }}>{regDateSaving ? "…" : "OK"}</Button>
                  <button onClick={() => { setEditingRegDate(false); setRegDateInput(vendor?.dateEnregistrement || ""); }} style={{ ...iconBtnStyle, color: "#8A93A3" }}><X size={15} /></button>
                </div>
                <span style={{ display: "block", fontSize: 11, color: "#9AA2B1", fontStyle: "italic", marginTop: 4 }}>
                  Utile pour un vendeur qui travaillait déjà avant la mise en place de l'application.
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: "#1B2A4A" }}>
                {fmtDateFr(vendor.dateEnregistrement)}
                {isAdmin && (
                  <button onClick={() => setEditingRegDate(true)} title="Corriger cette date" style={{ ...iconBtnStyle, color: "#5B6472", marginLeft: 6, padding: "2px 4px" }}>
                    <span style={{ fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>corriger</span>
                  </button>
                )}
                <span style={{ display: "block", fontSize: 11, color: "#9AA2B1", fontStyle: "italic" }}>
                  {latestCycle
                    ? "n'affecte plus la paie : un cycle de salaire a déjà été versé"
                    : "sert de point de départ au calcul du premier cycle de salaire tant qu'aucun salaire n'a été versé"}
                </span>
              </div>
            )}
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
          <div style={{ flex: 1, textAlign: "center", background: "#EEF1F8", borderRadius: 10, padding: "10px 6px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1B2A4A" }}>{totalPiecesVendues}</div>
            <div style={{ fontSize: 11, color: "#5B6472" }}>pièces vendues (cumul)</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: "#F3FAF6", borderRadius: 10, padding: "10px 6px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#3F8361" }}>{fmtMoney(totalVerseGlobal)}</div>
            <div style={{ fontSize: 11, color: "#5B6472" }}>versé (cumul)</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginBottom: 16 }}>
          <Label>Pointage d'aujourd'hui ({fmtDateFr(today)})</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            {Object.entries(STATUT_LABELS).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => { setStatut(key); setHeurePointage(nowHHMM()); }}
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
            {heurePointage && (
              <span style={{ fontSize: 11.5, color: "#8A93A3", display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={12} color="#3F9C6D" /> {heurePointage}
              </span>
            )}
          </div>
          <TextInput placeholder="Note (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ marginBottom: 10 }} />
          <Button variant="primary" onClick={saveAttendance} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le pointage"}</Button>
          <div style={{ fontSize: 11, color: "#9AA2B1", marginTop: 6 }}>L'heure exacte sera visible par ce vendeur et par tous les admins.</div>

          {versementToday && versementToday.lines.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #E7E9EE" }}>
              <div style={{ fontSize: 12, color: "#8A93A3", fontWeight: 600, marginBottom: 8 }}>VERSEMENT DU JOUR</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 120px", background: "#F7F8FA", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: "#8A93A3" }}>Pièces vendues</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1B2A4A" }}>{versementToday.totalPieces}</div>
                </div>
                <div style={{ flex: "1 1 120px", background: "#F7F8FA", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: "#8A93A3" }}>Espèces versées</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#3F8361" }}>{versementToday.finalise ? fmtMoney(versementToday.montantVerseEspeces) : "—"}</div>
                </div>
                <div style={{ flex: "1 1 120px", background: "#F7F8FA", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: "#8A93A3" }}>Dépôt mobile</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1B2A4A" }}>{fmtMoney(versementToday.totalMobile)}</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "#8A93A3", marginTop: 8 }}>
                {versementToday.finalise
                  ? <>Versement validé{versementToday.heureVersement ? ` à ${versementToday.heureVersement}` : ""}{versementToday.validePar ? ` par ${versementToday.validePar}` : ""}.</>
                  : "Versement du soir pas encore finalisé."}
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}


        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginBottom: 16 }}>
          <Label>Statut du contrat</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {Object.entries(CONTRACT_STATUT_LABELS).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => saveContractStatut(key)}
                disabled={contractSaving || contractStatut === key}
                style={{
                  padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: contractStatut === key ? "default" : "pointer",
                  border: `1.5px solid ${contractStatut === key ? color : "#D8DCE3"}`,
                  background: contractStatut === key ? color : "#fff",
                  color: contractStatut === key ? "#fff" : "#5B6472",
                  opacity: contractSaving ? 0.6 : 1,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "#8A93A3" }}>
            {contractStatut === "actif" && "Le vendeur travaille normalement."}
            {contractStatut === "en_pause" && "Le vendeur reste visible partout, mais son contrat est temporairement en pause."}
            {contractStatut === "cloture" && "Contrat terminé : le vendeur ne peut plus vendre ni demander de retrait, mais garde un accès en lecture seule à son historique."}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16 }}>
          <Label>Historique récent</Label>
          {loading ? (
            <div style={{ fontSize: 12.5, color: "#9AA2B1" }}>Chargement…</div>
          ) : history.length === 0 ? (
            <EmptyState text="Aucun pointage enregistré pour l'instant." />
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              <Table
                headers={["Date", "Statut", "Heure", "Note"]}
                rows={history.map((a) => [
                  fmtDateFr(a.date),
                  <span key="s" style={{ color: STATUT_LABELS[a.statut]?.color, fontWeight: 600 }}>{STATUT_LABELS[a.statut]?.label || a.statut}</span>,
                  a.heureArrivee || "—",
                  a.notes || "—",
                ])}
              />
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginTop: 16 }}>
          <Label>Cycle de salaire (26 jours de présence payable)</Label>
          {allDaysForCycle === null ? (
            <div style={{ fontSize: 12.5, color: "#9AA2B1" }}>Chargement…</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: joursComptesCycle >= 26 ? "#3F9C6D" : "#1B2A4A" }}>
                  {joursComptesCycle} / 26
                </div>
                <div style={{ fontSize: 11.5, color: "#8A93A3" }}>
                  jour(s) comptés depuis le {fmtDateFr(cycleStart)} — présence = pointage « présent » ou retour du soir fait
                </div>
              </div>
              <Button variant="gold" onClick={marquerSalaireVerse} disabled={payingCycle || joursComptesCycle === 0}>
                {payingCycle ? "Enregistrement…" : "Marquer le salaire comme versé"}
              </Button>
              <div style={{ fontSize: 11, color: "#9AA2B1", marginTop: 6 }}>
                Clôture le cycle en cours et en démarre un nouveau à partir du lendemain.
              </div>
              {latestCycle && (
                <div style={{ fontSize: 11.5, color: "#8A93A3", marginTop: 8 }}>
                  Dernier versement : {fmtDateFr(latestCycle.cycleEnd)} ({latestCycle.joursComptes} jour(s) comptés).
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginTop: 16 }}>
          <Label>Historique des cycles de salaire versés</Label>
          {cycleHistory.length === 0 ? (
            <EmptyState text="Aucun salaire versé pour l'instant." />
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              <Table
                headers={["Période", "Jours comptés", "Montant", "Versé le"]}
                rows={cycleHistory.map((c) => [
                  `${fmtDateFr(c.cycleStart)} → ${fmtDateFr(c.cycleEnd)}`,
                  c.joursComptes,
                  c.montant != null ? fmtMoney(c.montant) : "—",
                  c.paidAt ? formatDateFR(isoFromDate(new Date(c.paidAt))) : "—",
                ])}
              />
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginTop: 16 }}>
          <Label>Historique des ventes et versements</Label>
          {venteHistory.length === 0 ? (
            <EmptyState text="Aucune vente enregistrée pour l'instant." />
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              <Table
                headers={["Date", "Pièces vendues", "Montant attendu", "Versé", "Statut"]}
                rows={venteHistory.map((d) => [
                  formatDateFR(d.date),
                  d.totalPieces,
                  fmtMoney(d.montantAttendu),
                  d.finalise ? fmtMoney((d.montantVerseEspeces || 0) + d.totalMobile) : "En attente",
                  d.finalise ? (d.statut === "equilibre" ? "Équilibré" : d.statut === "exces" ? "Excédent" : "Manquant") : "—",
                ])}
              />
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginTop: 16 }}>
          <Label>Retraits demandés par ce vendeur</Label>
          {withdrawals.length === 0 ? (
            <EmptyState text="Aucun retrait demandé pour l'instant." />
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              <Table
                headers={["Date", "Montant", "Méthode", "Statut"]}
                rows={withdrawals.map((w) => [
                  fmtDateFr(w.date),
                  fmtMoney(w.montant),
                  w.methode === "mobile" ? `Mobile${w.numeroMobile ? ` (${w.numeroMobile})` : ""}` : "Espèces",
                  <span key="st" style={{
                    fontSize: 11.5, fontWeight: 700,
                    color: w.statut === "approuve" ? "#3F9C6D" : w.statut === "refuse" ? "#C1554A" : "#C79A3A",
                  }}>
                    {w.statut === "approuve" ? "Approuvé" : w.statut === "refuse" ? "Refusé" : "En attente"}
                  </span>,
                ])}
              />
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #F0F1F4", paddingTop: 16, marginTop: 16 }}>
          <Label>Contestations de présence envoyées par ce vendeur</Label>
          {contestations.length === 0 ? (
            <EmptyState text="Aucune contestation envoyée par ce vendeur." />
          ) : (
            contestations.map((c) => (
              <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #F5F6F8" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1B2A4A" }}>
                  {fmtDateFr(c.date)} {c.resolved && <span style={{ color: "#3F9C6D", fontWeight: 400 }}>· résolue</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "#5B6472", marginBottom: 6 }}>{c.message}</div>
                {c.resolved ? (
                  c.adminResponse && <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic" }}>Réponse : {c.adminResponse}</div>
                ) : activeResolveId === c.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <TextInput placeholder="Réponse (facultatif)" value={resolveMsg} onChange={(e) => setResolveMsg(e.target.value)} style={{ maxWidth: 260 }} />
                    <Button variant="primary" onClick={() => resoudreContestation(c.id)} disabled={resolving}>{resolving ? "…" : "Marquer résolue"}</Button>
                    <Button variant="ghost" onClick={() => { setActiveResolveId(null); setResolveMsg(""); }}>Annuler</Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => { setActiveResolveId(c.id); setResolveMsg(""); }}>Répondre / résoudre</Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Onglet vendeur "Ma présence" — le vendeur consulte son cycle de salaire en
// cours (26 jours de présence payable) et peut signaler un jour qui lui
// semble mal renseigné ; l'administration voit et résout ces signalements
// depuis la fiche vendeur (VendorFiche).
function MaPresence({ vendor, daysList, today, currentUser }) {
  const [history, setHistory] = useState([]);
  const [allDays, setAllDays] = useState(null);
  const [latestCycle, setLatestCycle] = useState(null);
  const [contestations, setContestations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contestDate, setContestDate] = useState(null);
  const [contestMsg, setContestMsg] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [h, days, cycle, contest] = await Promise.all([
        store.getVendorAttendanceHistory(vendor.id, 400),
        store.getDaysInRange(daysList || []),
        store.getLatestSalaryCycle(vendor.id),
        store.getContestationsForVendor(vendor.id),
      ]);
      setHistory(h);
      setAllDays(days);
      setLatestCycle(cycle);
      setContestations(contest);
    } catch (e) {
      setError(e.message || "Erreur lors du chargement de ta fiche de présence.");
    }
    setLoading(false);
  };

  useEffect(() => { if (vendor) load(); }, [vendor?.id]);

  if (!vendor) return <EmptyState text="Compte non lié à un vendeur." />;
  if (loading) return <EmptyState text="Chargement de ta fiche de présence…" />;

  const cycleStart = latestCycle ? addDays(latestCycle.cycleEnd, 1) : (vendor.dateEnregistrement || today);
  const retourDoneDates = buildRetourDoneDates(allDays || [], vendor.id);
  const cycleJours = buildPresenceCycle(cycleStart, today, history, retourDoneDates).slice().reverse();
  const joursComptes = cycleJours.filter((j) => j.payable).length;

  const envoyerContestation = async (date) => {
    if (!contestMsg.trim()) return;
    setSending(true);
    setError("");
    try {
      await store.createAttendanceContestation({ vendorId: vendor.id, date, message: contestMsg.trim() });
      store.logActivity(currentUser, "create_contestation", `${vendor.nom} a signalé un problème pour le ${fmtDateFr(date)}.`);
      setContestDate(null);
      setContestMsg("");
      await load();
    } catch (e) {
      setError(e.message || "Erreur lors de l'envoi du signalement.");
    }
    setSending(false);
  };

  return (
    <div>
      <Card title="Cycle de salaire en cours">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: joursComptes >= 26 ? "#3F9C6D" : "#1B2A4A" }}>{joursComptes} / 26</div>
          <div style={{ fontSize: 12.5, color: "#8A93A3" }}>jour(s) de présence comptés depuis le {fmtDateFr(cycleStart)}</div>
        </div>
        <div style={{ fontSize: 11.5, color: "#9AA2B1" }}>
          Une journée compte dès qu'elle est marquée « présent » par l'administration, ou dès qu'un retour du soir a été fait ce jour-là.
        </div>
      </Card>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="PIÈCES VENDUES — TOTAL CUMULÉ" value={totalPiecesVendues} />
        <StatCard label="VERSÉ — TOTAL CUMULÉ" value={fmtMoney(totalVerseGlobal)} accent="#3F8361" />
      </div>

      <Card title="Historique des ventes et versements">
        {venteHistory.length === 0 ? (
          <EmptyState text="Aucune vente enregistrée pour l'instant." />
        ) : (
          <Table
            headers={["Date", "Pièces vendues", "Montant attendu", "Versé", "Statut"]}
            rows={venteHistory.map((d) => [
              formatDateFR(d.date),
              d.totalPieces,
              fmtMoney(d.montantAttendu),
              d.finalise ? fmtMoney((d.montantVerseEspeces || 0) + d.totalMobile) : "En attente",
              d.finalise ? (d.statut === "equilibre" ? "Équilibré" : d.statut === "exces" ? "Excédent" : "Manquant") : "—",
            ])}
          />
        )}
      </Card>

      <Card title="Ma fiche de présence">
        {error && <div style={{ color: "#C1554A", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        {cycleJours.length === 0 ? (
          <EmptyState text="Aucune journée sur la période en cours." />
        ) : (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {cycleJours.map((j) => (
              <div key={j.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F5F6F8", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A" }}>{fmtDateFr(j.date)}</div>
                  <div style={{ fontSize: 11.5, color: j.payable ? "#3F9C6D" : "#9AA2B1" }}>
                    {j.payable ? "Comptée" : "Non comptée"}
                    {j.parRetour ? " — retour du soir fait" : j.statutPointage ? ` — pointage : ${STATUT_LABELS[j.statutPointage]?.label || j.statutPointage}` : " — aucune donnée"}
                  </div>
                </div>
                {contestDate === j.date ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <TextInput placeholder="Explique le problème…" value={contestMsg} onChange={(e) => setContestMsg(e.target.value)} style={{ maxWidth: 220 }} />
                    <Button variant="primary" onClick={() => envoyerContestation(j.date)} disabled={sending}>{sending ? "…" : "Envoyer"}</Button>
                    <Button variant="ghost" onClick={() => { setContestDate(null); setContestMsg(""); }}>Annuler</Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => { setContestDate(j.date); setContestMsg(""); }}>Signaler un problème</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Mes signalements">
        {contestations.length === 0 ? (
          <EmptyState text="Tu n'as signalé aucun problème pour l'instant." />
        ) : (
          contestations.map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #F5F6F8" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1B2A4A" }}>
                {fmtDateFr(c.date)}{" "}
                {c.resolved ? <span style={{ color: "#3F9C6D", fontWeight: 400 }}>· résolu</span> : <span style={{ color: "#C79A3A", fontWeight: 400 }}>· en attente</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "#5B6472" }}>{c.message}</div>
              {c.resolved && c.adminResponse && <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic" }}>Réponse : {c.adminResponse}</div>}
            </div>
          ))
        )}
      </Card>
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
          <img src={vendor.photoUrl} alt={vendorFullName(vendor)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Users size={16} color="#B7BECB" />
        )}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A" }}>{vendorFullName(vendor)}</div>
        <div style={{ fontSize: 11, color: "#8A93A3" }}>
          {vendor.numeroCni ? `${PIECE_NATURE_LABELS[vendor.pieceNature] || "Pièce"} ${vendor.numeroCni}` : ""}{vendor.numeroCni && vendor.telephone ? " · " : ""}{vendor.telephone || ""}
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



// Liste de vendeurs actifs sous forme de cartes cliquables — utilisée en
// haut de Distribution et Retour du soir pour choisir le vendeur concerné.
function VendorPicker({ vendors, selectedId, onSelect }) {
  if (vendors.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {vendors.map((v) => {
        const active = v.id === selectedId;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 6px",
              borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: active ? "2px solid #D9A441" : "1px solid #D8DCE3",
              background: active ? "#FFF8EC" : "#fff", color: "#1B2A4A",
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: "50%", background: "#EEF0F4", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {v.photoUrl ? (
                <img src={v.photoUrl} alt={vendorFullName(v)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Users size={13} color="#B7BECB" />
              )}
            </span>
            {vendorFullName(v)}
          </button>
        );
      })}
    </div>
  );
}

// Navigateur jour par jour (façon calendrier) — utilisé dans Distribution,
// Retour du soir et Caisse pour consulter/corriger une journée passée sans
// jamais pouvoir aller dans le futur.
function DayNavigator({ date, today, onChange }) {
  const isToday = date === today;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      <button
        onClick={() => onChange(addDays(date, -1))}
        title="Jour précédent"
        style={{ ...iconBtnStyle, border: "1px solid #D8DCE3", borderRadius: 8, padding: "8px 10px", color: "#1B2A4A" }}
      >
        <ChevronLeft size={16} />
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D8DCE3", fontSize: 13.5, fontFamily: "Calibri, Arial, sans-serif", color: "#1B2A4A" }}
      />
      <button
        onClick={() => !isToday && onChange(addDays(date, 1))}
        disabled={isToday}
        title="Jour suivant"
        style={{ ...iconBtnStyle, border: "1px solid #D8DCE3", borderRadius: 8, padding: "8px 10px", color: isToday ? "#C7CCDA" : "#1B2A4A", cursor: isToday ? "default" : "pointer" }}
      >
        <ChevronRight size={16} />
      </button>
      {!isToday && (
        <Button variant="ghost" onClick={() => onChange(today)}>Revenir à aujourd'hui</Button>
      )}
      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1B2A4A", textTransform: "capitalize" }}>{formatDateFR(date)}</span>
      {!isToday && (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#D9A441", background: "#FFF8EC", padding: "3px 9px", borderRadius: 999 }}>
          JOUR PASSÉ — consultation / correction
        </span>
      )}
    </div>
  );
}

function Distribution({ products, setProducts, vendors, day: dayProp, setDay: setDayProp, ensureTodayInList, daysList, currentUser, today }) {
  const { showToast } = useToast();
  const [viewDate, setViewDate] = useState(today);
  const [pastDay, setPastDay] = useState(null);
  const prevTodayRef = useRef(today);

  // Si la date du jour change (minuit passé, onglet resté ouvert) alors qu'on
  // était sur "aujourd'hui", on suit automatiquement le nouveau jour au lieu
  // de rester bloqué sur l'ancienne date (bug : dépenses/lignes de la veille
  // qui semblaient "traîner" sur le jour courant).
  useEffect(() => {
    if (viewDate === prevTodayRef.current && today !== prevTodayRef.current) {
      setViewDate(today);
    }
    prevTodayRef.current = today;
  }, [today, viewDate]);

  useEffect(() => {
    if (viewDate === today) { setPastDay(null); return; }
    (async () => setPastDay(await store.getDay(viewDate)))();
  }, [viewDate, today]);

  const day = viewDate === today ? dayProp : (pastDay || emptyDay(viewDate));
  const setDay = async (next) => {
    if (viewDate === today) { await setDayProp(next); return; }
    setPastDay(next);
    await store.setDay(next);
  };

  const [vendorId, setVendorId] = useState("");
  const [qtyByProduct, setQtyByProduct] = useState({}); // productId -> quantité saisie (texte)
  const [error, setError] = useState("");
  const [editQty, setEditQty] = useState({}); // lineId -> valeur en cours d'édition
  const [filterStatutJour, setFilterStatutJour] = useState("tous"); // "tous" | "encours" — filtre du tableau "Distributions du jour"
  const [searchProduct, setSearchProduct] = useState(""); // filtre produit dans le tableau de remise

  // Un vendeur au contrat clôturé ne doit plus recevoir de nouvelle
  // distribution, même saisie manuellement par l'administrateur.
  const activeVendors = vendors.filter((v) => v.contractStatut !== "cloture");
  const selectedVendor = activeVendors.find((v) => v.id === vendorId);

  // ---------------------------------------------------------------------
  // Report du stock invendu — évite de refaire la distribution à la main
  // chaque matin : ce qu'un vendeur a rapporté non vendu (retour du soir)
  // et qui n'a pas encore été redistribué peut être reporté en un clic
  // vers aujourd'hui, comme une distribution normale (le stock système est
  // décrémenté exactement comme lors d'une remise manuelle).
  const [carryDays, setCarryDays] = useState([]);
  const [reporting, setReporting] = useState(false);
  // Filtre "par vendeur" pour l'affichage du stock invendu à reporter :
  // "" = tous les vendeurs, sinon l'id du vendeur choisi (évite une longue liste).
  const [invenduVendorFilter, setInvenduVendorFilter] = useState("");
  // Sections vendeur dépliées dans "Distributions du jour" — regroupement
  // pour éviter de répéter le nom du vendeur à chaque ligne produit.
  const [expandedVendors, setExpandedVendors] = useState(new Set());

  useEffect(() => {
    if (viewDate !== today) { setCarryDays([]); return; }
    // On regarde jusqu'à 14 jours en arrière pour rattraper un report oublié
    // un ou plusieurs matins précédents, pas seulement la veille.
    const candidates = (daysList || []).filter((d) => d < today).sort((a, b) => b.localeCompare(a)).slice(0, 14);
    if (candidates.length === 0) { setCarryDays([]); return; }
    store.getDaysInRange(candidates).then(setCarryDays).catch(() => setCarryDays([]));
  }, [today, viewDate, daysList]);

  const reportCandidates = [];
  carryDays.forEach((d) => {
    (d.lines || []).forEach((l) => {
      if ((l.quantiteRestante || 0) > 0 && !l.reporte && activeVendors.some((v) => v.id === l.vendorId)) {
        reportCandidates.push({ ...l, sourceDate: d.date });
      }
    });
  });

  // Regroupées par vendeur + produit pour l'affichage et l'application en une fois.
  const reportGroups = (() => {
    const map = new Map();
    reportCandidates.forEach((l) => {
      const key = `${l.vendorId}::${l.productId}`;
      if (!map.has(key)) {
        map.set(key, { vendorId: l.vendorId, vendorNom: l.vendorNom, productId: l.productId, productNom: l.productNom, prix: l.prix, quantite: 0, sources: [] });
      }
      const g = map.get(key);
      g.quantite += l.quantiteRestante;
      g.sources.push({ date: l.sourceDate, lineId: l.id });
    });
    return Array.from(map.values());
  })();

  // Vendeurs concernés par un report, pour peupler le sélecteur de filtre.
  const invenduVendorOptions = (() => {
    const map = new Map();
    reportGroups.forEach((g) => { if (!map.has(g.vendorId)) map.set(g.vendorId, g.vendorNom); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  // Si le vendeur sélectionné n'a plus de reliquat (ex : après un report), on revient à "tous".
  useEffect(() => {
    if (invenduVendorFilter && !invenduVendorOptions.some(([id]) => id === invenduVendorFilter)) {
      setInvenduVendorFilter("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportGroups.length]);

  const filteredReportGroups = invenduVendorFilter
    ? reportGroups.filter((g) => g.vendorId === invenduVendorFilter)
    : reportGroups;

  const reporterStockInvendu = async (groupsParam) => {
    const reportGroupsToApply = groupsParam && groupsParam.length ? groupsParam : reportGroups;
    if (reportGroupsToApply.length === 0) return;
    setError("");
    setReporting(true);
    try {
      // Garde-fou : vérifie que le stock système est bien suffisant pour
      // chaque produit avant d'appliquer le report (au cas où il aurait
      // changé entre-temps).
      const needByProduct = {};
      reportGroupsToApply.forEach((g) => { needByProduct[g.productId] = (needByProduct[g.productId] || 0) + g.quantite; });
      const insuffisants = [];
      Object.entries(needByProduct).forEach(([productId, need]) => {
        const product = products.find((p) => p.id === productId);
        if (!product || product.stock < need) insuffisants.push(product ? product.nom : productId);
      });
      const groupsToApply = reportGroupsToApply.filter((g) => !insuffisants.includes(g.productNom));

      if (groupsToApply.length === 0) {
        showToast("Stock système insuffisant pour reporter les quantités invendues.", "error");
        setReporting(false);
        return;
      }

      let nextLines = [...day.lines];
      let nextProducts = [...products];
      groupsToApply.forEach((g) => {
        const existingLine = nextLines.find(
          (l) => l.vendorId === g.vendorId && l.productId === g.productId && l.quantiteRestante === null
        );
        nextLines = existingLine
          ? nextLines.map((l) => (l.id === existingLine.id ? { ...l, quantiteRemise: l.quantiteRemise + g.quantite } : l))
          : [...nextLines, {
              id: uid(), vendorId: g.vendorId, vendorNom: g.vendorNom, productId: g.productId, productNom: g.productNom,
              prix: g.prix, quantiteRemise: g.quantite, quantiteRestante: null, quantiteVendue: null, montantAttendu: null,
            }];
        nextProducts = nextProducts.map((p) => (p.id === g.productId ? { ...p, stock: p.stock - g.quantite } : p));
      });

      await setDay({ ...day, lines: nextLines });
      await setProducts(nextProducts);
      if (viewDate === today) await ensureTodayInList(daysList);

      // Marque les lignes sources comme reportées (jour par jour) pour ne
      // pas les proposer une seconde fois demain.
      const bySourceDate = new Map();
      groupsToApply.forEach((g) => {
        g.sources.forEach(({ date, lineId }) => {
          if (!bySourceDate.has(date)) bySourceDate.set(date, new Set());
          bySourceDate.get(date).add(lineId);
        });
      });
      for (const [date, lineIds] of bySourceDate.entries()) {
        const sourceDay = carryDays.find((d) => d.date === date);
        if (!sourceDay) continue;
        const updatedLines = sourceDay.lines.map((l) => (lineIds.has(l.id) ? { ...l, reporte: true } : l));
        await store.setDay({ ...sourceDay, lines: updatedLines });
      }
      setCarryDays((prev) => prev.map((d) => {
        const ids = bySourceDate.get(d.date);
        if (!ids) return d;
        return { ...d, lines: d.lines.map((l) => (ids.has(l.id) ? { ...l, reporte: true } : l)) };
      }));

      store.logActivity(
        currentUser, "report_stock_invendu",
        `Stock invendu reporté vers aujourd'hui : ${groupsToApply.map((g) => `${g.quantite} ${g.productNom} → ${g.vendorNom}`).join(", ")}.`
      );
      showToast("Stock invendu reporté — les vendeurs concernés repartent avec leur stock de la veille.", "success");
      if (insuffisants.length > 0) {
        showToast(`Stock système insuffisant pour reporter : ${insuffisants.join(", ")}. À distribuer manuellement.`, "warning", 8000);
      }
    } catch (e) {
      setError(e.message || "Erreur lors du report du stock invendu.");
    }
    setReporting(false);
  };
  // ---------------------------------------------------------------------

  // Produits déjà en main du vendeur sélectionné, pas encore retournés —
  // indexé par produit pour fusionner facilement avec le tableau de remise.
  const pendingForSelectedVendor = vendorId
    ? day.lines.filter((l) => l.vendorId === vendorId && l.quantiteRestante === null)
    : [];
  const pendingByProduct = Object.fromEntries(pendingForSelectedVendor.map((l) => [l.productId, l]));

  const produitsAffiches = searchProduct.trim()
    ? products.filter((p) => p.nom.toLowerCase().includes(searchProduct.trim().toLowerCase()))
    : products;

  // Change de vendeur : on repart d'une liste de quantités vierge, pour
  // éviter de mélanger la saisie de deux vendeurs différents.
  const selectVendor = (id) => {
    setVendorId(id);
    setError("");
    setQtyByProduct({});
  };

  const setQtyFor = (productId, value) => setQtyByProduct((s) => ({ ...s, [productId]: value }));

  // Boutons de quantités rapides : ajoutent à ce qui est déjà saisi plutôt
  // que de l'écraser, pour pouvoir cumuler (ex. +10 puis +5 = 15).
  const bumpQty = (productId, amount) => {
    setQtyByProduct((s) => ({ ...s, [productId]: String((Number(s[productId]) || 0) + amount) }));
  };

  // Valide en une seule fois toutes les quantités saisies dans la liste :
  // une seule mise à jour de `day` et de `products` pour toute la remise.
  const validateDistribution = async () => {
    setError("");
    if (!vendorId) return;
    const vendor = activeVendors.find((v) => v.id === vendorId);
    if (!vendor) return; // vendeur clôturé (ou introuvable) : distribution bloquée

    const items = products
      .map((p) => ({ product: p, qty: Number(qtyByProduct[p.id]) }))
      .filter((it) => qtyByProduct[it.product.id] && it.qty > 0);

    if (items.length === 0) return;

    for (const item of items) {
      if (item.product.stock < item.qty) {
        setError(`Stock insuffisant pour ${item.product.nom} : il ne reste que ${item.product.stock} en stock.`);
        return;
      }
    }

    let nextLines = [...day.lines];
    let nextProducts = [...products];

    items.forEach(({ product, qty }) => {
      // Si ce vendeur a déjà une ligne en attente pour ce même produit, on
      // ajoute la quantité à la ligne existante au lieu d'en créer une deuxième.
      const existingLine = nextLines.find(
        (l) => l.vendorId === vendorId && l.productId === product.id && l.quantiteRestante === null
      );
      nextLines = existingLine
        ? nextLines.map((l) => (l.id === existingLine.id ? { ...l, quantiteRemise: l.quantiteRemise + qty } : l))
        : [...nextLines, {
            id: uid(), vendorId, vendorNom: vendor.nom, productId: product.id, productNom: product.nom,
            prix: product.prix, quantiteRemise: qty, quantiteRestante: null, quantiteVendue: null, montantAttendu: null,
          }];
      nextProducts = nextProducts.map((p) => (p.id === product.id ? { ...p, stock: p.stock - qty } : p));
    });

    await setDay({ ...day, lines: nextLines });
    await setProducts(nextProducts);
    if (viewDate === today) await ensureTodayInList(daysList);
    store.logActivity(
      currentUser,
      "distribute",
      `Distribution à ${vendor.nom} : ${items.map((it) => `${it.qty} ${it.product.nom}`).join(", ")}.`
    );
    setQtyByProduct({});
  };

  const saveEditedQty = async (line) => {
    setError("");
    const raw = editQty[line.id];
    if (raw === undefined || raw === "") return;
    const newQty = Number(raw);
    if (Number.isNaN(newQty) || newQty <= 0) {
      setError("Quantité invalide — utilise la corbeille pour annuler complètement cette distribution.");
      return;
    }
    const diff = newQty - line.quantiteRemise; // >0 = on prend plus de stock, <0 = on en rend
    const product = products.find((p) => p.id === line.productId);
    if (diff > 0 && product && product.stock < diff) {
      setError(`Stock insuffisant pour augmenter cette quantité : il ne reste que ${product.stock} en stock.`);
      return;
    }
    const nextLines = day.lines.map((l) => (l.id === line.id ? { ...l, quantiteRemise: newQty } : l));
    await setDay({ ...day, lines: nextLines });
    if (product) {
      await setProducts(products.map((p) => (p.id === line.productId ? { ...p, stock: p.stock - diff } : p)));
    }
    store.logActivity(currentUser, "edit_distribution", `Distribution de ${line.productNom} à ${line.vendorNom} modifiée : ${line.quantiteRemise} → ${newQty}.`);
    setEditQty((s) => { const n = { ...s }; delete n[line.id]; return n; });
  };

  const cancelDistribution = async (line) => {
    setError("");
    const ok = window.confirm(`Annuler cette distribution de ${line.quantiteRemise} ${line.productNom} à ${line.vendorNom} ?\n\nLe stock sera recrédité et cette action est irréversible.`);
    if (!ok) return;
    const nextLines = day.lines.filter((l) => l.id !== line.id);
    await setDay({ ...day, lines: nextLines });
    const product = products.find((p) => p.id === line.productId);
    if (product) {
      await setProducts(products.map((p) => (p.id === line.productId ? { ...p, stock: p.stock + line.quantiteRemise } : p)));
    }
    store.logActivity(currentUser, "cancel_distribution", `Distribution annulée : ${line.quantiteRemise} ${line.productNom} repris à ${line.vendorNom}.`);
    setEditQty((s) => { const n = { ...s }; delete n[line.id]; return n; });
  };

  const nbSaisis = Object.values(qtyByProduct).filter((v) => Number(v) > 0).length;
  const QUICK_QTYS = [5, 10, 20];

  return (
    <div>
      <DayNavigator date={viewDate} today={today} onChange={setViewDate} />

      {viewDate === today && reportGroups.length > 0 && (
        <Card title="Stock invendu à reporter">
          <div style={{ fontSize: 12.5, color: "#8A93A3", marginBottom: 12 }}>
            Ces vendeurs ont un reliquat non vendu, rapporté lors d'un retour du soir précédent et pas encore
            redistribué. Reporte-le en un clic pour éviter de refaire toute la distribution ce matin.
          </div>

          {invenduVendorOptions.length > 1 && (
            <div style={{ marginBottom: 12, maxWidth: 280 }}>
              <Select
                value={invenduVendorFilter}
                onChange={(e) => setInvenduVendorFilter(e.target.value)}
              >
                <option value="">Tous les vendeurs ({invenduVendorOptions.length})</option>
                {invenduVendorOptions.map(([id, nom]) => (
                  <option key={id} value={id}>{nom}</option>
                ))}
              </Select>
            </div>
          )}

          <Table
            headers={["Vendeur", "Produit", "Quantité invendue"]}
            rows={filteredReportGroups.map((g) => [g.vendorNom, g.productNom, g.quantite])}
          />
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="gold"
              onClick={() => reporterStockInvendu(invenduVendorFilter ? filteredReportGroups : reportGroups)}
              disabled={reporting || filteredReportGroups.length === 0}
            >
              <RotateCcw size={15} />
              {reporting
                ? "Report en cours…"
                : invenduVendorFilter
                ? `Reporter pour ${invenduVendorOptions.find(([id]) => id === invenduVendorFilter)?.[1] || "ce vendeur"}`
                : "Reporter tout vers aujourd'hui"}
            </Button>
          </div>
        </Card>
      )}

      <div style={{ position: "sticky", top: 78, zIndex: 15, background: "#F7F8FA", paddingBottom: 2 }}>
        <Card title="Vendeurs actifs">
          <VendorPicker vendors={activeVendors} selectedId={vendorId} onSelect={selectVendor} />
          {activeVendors.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#C1554A" }}>
              {vendors.length === 0
                ? "Ajoute d'abord un vendeur dans l'onglet Vendeurs & comptes."
                : "Tous les vendeurs sont au contrat clôturé — aucune distribution n'est possible."}
            </div>
          )}
        </Card>
      </div>

      {selectedVendor && (
        <Card title={`${vendorFullName(selectedVendor)} — remise et suivi des produits`}>
          {products.length === 0 ? (
            <EmptyState text="Aucun produit enregistré — ajoute d'abord des produits dans l'onglet Produits." />
          ) : (
            <>
              {products.length > 6 && (
                <div style={{ marginBottom: 12, maxWidth: 260 }}>
                  <TextInput placeholder="Rechercher un produit…" value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
                </div>
              )}
              <Table
                headers={["Produit", "Stock système", "Déjà remis aujourd'hui", "Ajouter"]}
                rows={produitsAffiches.map((p) => {
                  const pending = pendingByProduct[p.id];
                  return [
                    p.nom,
                    p.stock,
                    pending ? (
                      <div key="dr" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <TextInput
                          type="number" style={{ width: 80 }}
                          value={editQty[pending.id] ?? pending.quantiteRemise}
                          onChange={(e) => setEditQty((s) => ({ ...s, [pending.id]: e.target.value }))}
                        />
                        <Button variant="ghost" onClick={() => saveEditedQty(pending)}>OK</Button>
                        <button onClick={() => cancelDistribution(pending)} title="Annuler cette distribution" style={iconBtnStyle}><Trash2 size={15} /></button>
                      </div>
                    ) : (
                      <span key="dr" style={{ color: "#B7BECB" }}>—</span>
                    ),
                    <div key="add" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <TextInput
                        type="number" style={{ width: 80 }} placeholder="0"
                        value={qtyByProduct[p.id] ?? ""}
                        onChange={(e) => setQtyFor(p.id, e.target.value)}
                      />
                      {QUICK_QTYS.map((q) => (
                        <button
                          key={q} onClick={() => bumpQty(p.id, q)}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                            border: "1px solid #D8DCE3", background: "#fff", color: "#5B6472",
                          }}
                        >
                          +{q}
                        </button>
                      ))}
                    </div>,
                  ];
                })}
              />
              {produitsAffiches.length === 0 && (
                <EmptyState text="Aucun produit ne correspond à cette recherche." />
              )}
              {error && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#C1554A" }}>{error}</div>
              )}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={validateDistribution} disabled={nbSaisis === 0}>
                  <Truck size={15} /> Valider la remise{nbSaisis > 0 ? ` (${nbSaisis} produit${nbSaisis > 1 ? "s" : ""})` : ""}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      <Card title="Distributions du jour">
        {day.lines.length === 0 ? (
          <EmptyState text="Aucune distribution enregistrée aujourd'hui." />
        ) : (
          (() => {
            // Regroupe les lignes par vendeur + produit : plusieurs remises
            // successives au même vendeur pour le même produit dans la
            // journée (ex. un retour entre-temps, puis une nouvelle remise)
            // n'affichent qu'une seule ligne, avec la quantité cumulée.
            const groups = [];
            const index = new Map();
            day.lines.forEach((l) => {
              const key = `${l.vendorId}::${l.productId}`;
              if (!index.has(key)) {
                index.set(key, groups.length);
                groups.push({
                  vendorId: l.vendorId, vendorNom: l.vendorNom, productNom: l.productNom,
                  quantiteRemise: 0, toutRetourne: true, lignes: [],
                });
              }
              const g = groups[index.get(key)];
              g.quantiteRemise += l.quantiteRemise;
              g.lignes.push(l);
              if (l.quantiteRestante === null) g.toutRetourne = false;
            });

            // Modifiable uniquement quand il n'existe qu'une seule remise
            // pour ce couple vendeur/produit aujourd'hui et qu'elle est
            // encore en cours — sinon (plusieurs remises mélangées à des
            // retours) l'édition resterait ambiguë, mieux vaut passer par
            // la sélection du vendeur dans ce cas.
            groups.forEach((g) => {
              g.ligneModifiable = g.lignes.length === 1 && g.lignes[0].quantiteRestante === null ? g.lignes[0] : null;
            });

            const visibleGroups = filterStatutJour === "encours" ? groups.filter((g) => !g.toutRetourne) : groups;
            const total = visibleGroups.reduce((s, g) => s + g.quantiteRemise, 0);
            const nbEnCours = groups.filter((g) => !g.toutRetourne).length;

            // Regroupement par vendeur : un vendeur = une section repliable,
            // au lieu de répéter son nom sur chacune de ses lignes produit.
            const vendorSections = (() => {
              const map = new Map();
              visibleGroups.forEach((g) => {
                if (!map.has(g.vendorId)) {
                  map.set(g.vendorId, { vendorId: g.vendorId, vendorNom: g.vendorNom, items: [], totalQty: 0, nbEnCours: 0 });
                }
                const s = map.get(g.vendorId);
                s.items.push(g);
                s.totalQty += g.quantiteRemise;
                if (!g.toutRetourne) s.nbEnCours += 1;
              });
              return Array.from(map.values()).sort((a, b) => a.vendorNom.localeCompare(b.vendorNom));
            })();

            const allOpen = vendorSections.length > 0 && vendorSections.every((s) => expandedVendors.has(s.vendorId));
            const toggleVendor = (id) => setExpandedVendors((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
            const toggleAll = () => setExpandedVendors(
              allOpen ? new Set() : new Set(vendorSections.map((s) => s.vendorId))
            );

            return (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setFilterStatutJour("tous")}
                    style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: filterStatutJour === "tous" ? "2px solid #1B2A4A" : "1px solid #D8DCE3",
                      background: filterStatutJour === "tous" ? "#1B2A4A" : "#fff",
                      color: filterStatutJour === "tous" ? "#fff" : "#1B2A4A",
                    }}
                  >
                    Tous ({groups.length})
                  </button>
                  <button
                    onClick={() => setFilterStatutJour("encours")}
                    style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: filterStatutJour === "encours" ? "2px solid #C1893D" : "1px solid #D8DCE3",
                      background: filterStatutJour === "encours" ? "#FFF8EC" : "#fff", color: "#C1893D",
                    }}
                  >
                    En cours ({nbEnCours})
                  </button>
                  {vendorSections.length > 1 && (
                    <Button
                      variant="ghost" onClick={toggleAll}
                      style={{ padding: "6px 12px", fontSize: 12.5, marginLeft: "auto" }}
                    >
                      {allOpen ? "Tout replier" : "Tout déplier"}
                    </Button>
                  )}
                </div>

                {vendorSections.length === 0 ? (
                  <EmptyState text="Rien à afficher pour ce filtre." />
                ) : (
                  <>
                    {vendorSections.map((s) => {
                      const isOpen = expandedVendors.has(s.vendorId);
                      return (
                        <div key={s.vendorId} style={{ border: "1px solid #EEF0F4", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                          <button
                            onClick={() => toggleVendor(s.vendorId)}
                            style={{
                              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                              gap: 10, padding: "10px 14px", background: "#F7F8FA", border: "none",
                              cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: "#1B2A4A", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              {isOpen ? <ChevronDown size={15} style={{ flexShrink: 0 }} /> : <ChevronRight size={15} style={{ flexShrink: 0 }} />}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.vendorNom}</span>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8A93A3", whiteSpace: "nowrap" }}>
                                · {s.items.length} produit{s.items.length > 1 ? "s" : ""} · {s.totalQty} au total
                              </span>
                            </span>
                            {s.nbEnCours > 0 && <span style={{ flexShrink: 0 }}><Badge ok={false} warnText={`${s.nbEnCours} en cours`} /></span>}
                          </button>

                          {isOpen && (
                            <div style={{ padding: "6px 12px 12px" }}>
                              <Table
                                headers={["Produit", "Qté remise", "Statut", ""]}
                                rows={s.items.map((g) => [
                                  g.productNom,
                                  g.ligneModifiable ? (
                                    <TextInput
                                      key="q" type="number" style={{ width: 90 }}
                                      value={editQty[g.ligneModifiable.id] ?? g.quantiteRemise}
                                      onChange={(e) => setEditQty((st) => ({ ...st, [g.ligneModifiable.id]: e.target.value }))}
                                    />
                                  ) : g.quantiteRemise,
                                  <button
                                    key="b" onClick={() => setFilterStatutJour(g.toutRetourne ? "tous" : "encours")}
                                    title="Cliquer pour filtrer sur ce statut" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                                  >
                                    <Badge ok={g.toutRetourne} okText="Retour fait" warnText="En cours" />
                                  </button>,
                                  g.ligneModifiable ? (
                                    <div key="actions" style={{ display: "flex", gap: 6 }}>
                                      <Button variant="ghost" onClick={() => saveEditedQty(g.ligneModifiable)}>Enregistrer</Button>
                                      <button onClick={() => cancelDistribution(g.ligneModifiable)} title="Annuler cette distribution" style={iconBtnStyle}><Trash2 size={15} /></button>
                                    </div>
                                  ) : "—",
                                ])}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A" }}>
                        Total : {total} produit{total > 1 ? "s" : ""}
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retour du soir — tous les produits d'un vendeur d'un coup, + versement
// ---------------------------------------------------------------------------

function RetourDuSoir({ isAdmin, vendors, products, setProducts, day: dayProp, setDay: setDayProp, activeVendor, currentUser, today }) {
  const { showToast } = useToast();
  const [viewDate, setViewDate] = useState(today);
  const [pastDay, setPastDay] = useState(null);
  const prevTodayRef = useRef(today);

  // Idem Distribution/Caisse : si le jour change pendant que l'onglet reste
  // ouvert, on repasse automatiquement sur "aujourd'hui" au lieu de rester
  // figé sur la veille.
  useEffect(() => {
    if (viewDate === prevTodayRef.current && today !== prevTodayRef.current) {
      setViewDate(today);
    }
    prevTodayRef.current = today;
  }, [today, viewDate]);

  useEffect(() => {
    if (viewDate === today) { setPastDay(null); return; }
    (async () => setPastDay(await store.getDay(viewDate)))();
  }, [viewDate, today]);

  const day = viewDate === today ? dayProp : (pastDay || emptyDay(viewDate));
  const setDay = async (next) => {
    if (viewDate === today) { await setDayProp(next); return; }
    setPastDay(next);
    await store.setDay(next);
  };

  // Un vendeur au contrat clôturé ne doit plus pouvoir faire l'objet d'un
  // retour du soir saisi manuellement par l'administrateur (voir Distribution).
  const activeVendors = isAdmin ? vendors.filter((v) => v.contractStatut !== "cloture") : vendors;
  const [selectedVendorId, setSelectedVendorId] = useState(isAdmin ? (activeVendors[0]?.id || "") : (activeVendor?.id || ""));
  const [pendingInputs, setPendingInputs] = useState({});
  const [mobileOn, setMobileOn] = useState(false);
  const [mobileNumero, setMobileNumero] = useState("");
  const [mobileMontant, setMobileMontant] = useState("");
  const [montantVerseInput, setMontantVerseInput] = useState("");
  const [correctionId, setCorrectionId] = useState(null);
  const [correctionInputs, setCorrectionInputs] = useState({});

  const vendor = isAdmin ? activeVendors.find((v) => v.id === selectedVendorId) : activeVendor;

  useEffect(() => {
    setPendingInputs({});
    setMobileNumero("");
    setMobileMontant("");
    setCorrectionId(null);
    setCorrectionInputs({});
    if (vendor) {
      const summary = computeVersementSummary(day, vendor.id);
      setMobileOn(summary.mobilePayments.length > 0);
      setMontantVerseInput(summary.montantVerseEspeces !== null ? String(summary.montantVerseEspeces) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id]);

  if (isAdmin && activeVendors.length === 0) {
    return (
      <Card title="Retour du soir">
        <EmptyState
          text={
            vendors.length === 0
              ? "Ajoute d'abord un vendeur dans l'onglet Vendeurs & comptes."
              : "Tous les vendeurs sont au contrat clôturé — aucun retour du soir n'est possible."
          }
        />
      </Card>
    );
  }
  if (!vendor) {
    return <Card title="Retour du soir"><EmptyState text="Aucun vendeur sélectionné." /></Card>;
  }

  const lines = day.lines.filter((l) => l.vendorId === vendor.id);
  const pending = lines.filter((l) => l.quantiteRestante === null);
  const done = lines.filter((l) => l.quantiteRestante !== null);
  const summary = computeVersementSummary(day, vendor.id);

  const validerTout = async () => {
    if (!isAdmin) return;
    let changed = false;
    const stockIncrements = {};
    const details = [];
    const invalides = [];
    const nextLines = day.lines.map((l) => {
      if (l.vendorId !== vendor.id || l.quantiteRestante !== null) return l;
      const val = pendingInputs[l.id];
      if (val === undefined || val === "") return l;
      const restante = Number(val);
      if (Number.isNaN(restante)) return l;
      // Garde-fou : impossible de retourner plus que ce qui a été remis le
      // matin, ni un nombre négatif — sinon le stock serait réalimenté avec
      // des quantités fictives (voir bug rapporté sur le retour du soir).
      if (restante < 0 || restante > l.quantiteRemise) {
        invalides.push(`${l.productNom} (saisi ${restante}, remis ${l.quantiteRemise})`);
        return l;
      }
      changed = true;
      const vendue = Math.max(0, l.quantiteRemise - restante);
      if (restante > 0) stockIncrements[l.productId] = (stockIncrements[l.productId] || 0) + restante;
      details.push(`${l.productNom} : ${vendue} vendu(s), ${restante} retourné(s)`);
      return { ...l, quantiteRestante: restante, quantiteVendue: vendue, montantAttendu: vendue * l.prix };
    });
    if (invalides.length > 0) {
      showToast(
        `Quantité restante invalide pour : ${invalides.join(" ; ")}. La quantité retournée ne peut pas dépasser la quantité remise le matin, ni être négative.`,
        "error",
        8000
      );
    }
    if (!changed) return;
    await setDay({ ...day, lines: nextLines });
    if (Object.keys(stockIncrements).length > 0) {
      const nextProducts = products.map((p) => (stockIncrements[p.id] ? { ...p, stock: p.stock + stockIncrements[p.id] } : p));
      await setProducts(nextProducts);
    }
    store.logActivity(currentUser, "retour_du_soir", `Retour du soir de ${vendor.nom} validé — ${details.join(" ; ")}.`);
    setPendingInputs((s) => {
      const next = { ...s };
      for (const l of pending) {
        if (!invalides.some((txt) => txt.startsWith(l.productNom))) delete next[l.id];
      }
      return next;
    });
  };

  const commencerCorrection = (line) => {
    if (!isAdmin) return;
    setCorrectionId(line.id);
    setCorrectionInputs((s) => ({ ...s, [line.id]: String(line.quantiteRestante) }));
  };

  const annulerCorrection = (lineId) => {
    setCorrectionId(null);
    setCorrectionInputs((s) => {
      const next = { ...s };
      delete next[lineId];
      return next;
    });
  };

  const validerCorrection = async (line) => {
    if (!isAdmin) return;
    const val = correctionInputs[line.id];
    if (val === undefined || val === "") return;
    const restante = Number(val);
    if (Number.isNaN(restante) || restante < 0 || restante > line.quantiteRemise) {
      showToast(
        `Quantité restante invalide (saisi ${val}, remis ${line.quantiteRemise}). La quantité retournée ne peut pas dépasser la quantité remise le matin, ni être négative.`,
        "error",
        8000
      );
      return;
    }
    const ancienneRestante = line.quantiteRestante;
    if (restante === ancienneRestante) {
      annulerCorrection(line.id);
      return;
    }
    const vendue = Math.max(0, line.quantiteRemise - restante);
    const nextLines = day.lines.map((l) =>
      l.id === line.id ? { ...l, quantiteRestante: restante, quantiteVendue: vendue, montantAttendu: vendue * l.prix } : l
    );
    await setDay({ ...day, lines: nextLines });
    // On ne réajuste le stock que de la différence entre l'ancienne et la
    // nouvelle quantité retournée, pour ne pas fausser le stock déjà mis à
    // jour lors de la première validation.
    const delta = restante - ancienneRestante;
    if (delta !== 0) {
      const nextProducts = products.map((p) => (p.id === line.productId ? { ...p, stock: p.stock + delta } : p));
      await setProducts(nextProducts);
    }
    store.logActivity(
      currentUser,
      "correction_retour_du_soir",
      `Correction du retour du soir de ${vendor.nom} pour ${line.productNom} : ${ancienneRestante} → ${restante} retourné(s) (désormais ${vendue} vendu(s)).`
    );
    annulerCorrection(line.id);
  };

  const addMobilePayment = async () => {
    if (!isAdmin) return;
    const montant = Number(mobileMontant);
    if (!mobileNumero.trim() || mobileMontant === "" || Number.isNaN(montant)) return;
    if (montant <= 0) {
      showToast("Le montant d'un paiement mobile doit être un nombre positif.", "error");
      return;
    }
    const versements = { ...(day.versements || {}) };
    const current = versements[vendor.id] || { mobilePayments: [], montantVerseEspeces: null };
    versements[vendor.id] = { ...current, mobilePayments: [...(current.mobilePayments || []), { id: uid(), numero: mobileNumero.trim(), montant }] };
    await setDay({ ...day, versements });
    store.logActivity(currentUser, "add_mobile_payment", `Paiement mobile de ${montant} FCFA (${mobileNumero.trim()}) ajouté pour ${vendor.nom}.`);
    setMobileNumero(""); setMobileMontant("");
  };

  const removeMobilePayment = async (id) => {
    if (!isAdmin) return;
    const versements = { ...(day.versements || {}) };
    const current = versements[vendor.id] || { mobilePayments: [], montantVerseEspeces: null };
    const removed = (current.mobilePayments || []).find((m) => m.id === id);
    if (removed) {
      const ok = window.confirm(`Supprimer le paiement mobile de ${removed.montant} FCFA (${removed.numero}) ?`);
      if (!ok) return;
    }
    versements[vendor.id] = { ...current, mobilePayments: (current.mobilePayments || []).filter((m) => m.id !== id) };
    await setDay({ ...day, versements });
    if (removed) store.logActivity(currentUser, "remove_mobile_payment", `Paiement mobile de ${removed.montant} FCFA (${removed.numero}) supprimé pour ${vendor.nom}.`);
  };

  const enregistrerVersement = async () => {
    if (!isAdmin) return;
    const montant = Number(montantVerseInput);
    if (Number.isNaN(montant) || montantVerseInput === "") return;
    if (montant < 0) {
      showToast("Le montant versé en espèces ne peut pas être négatif.", "error");
      return;
    }
    const versements = { ...(day.versements || {}) };
    const current = versements[vendor.id] || { mobilePayments: [], montantVerseEspeces: null };
    versements[vendor.id] = { ...current, montantVerseEspeces: montant, validePar: currentUser?.username || null, heureVersement: nowHHMM() };
    await setDay({ ...day, versements });
    store.logActivity(currentUser, "enregistrer_versement", `Versement en espèces de ${montant} FCFA enregistré pour ${vendor.nom}.`);
  };

  return (
    <div>
      <DayNavigator date={viewDate} today={today} onChange={setViewDate} />
      {!isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#8A93A3", fontSize: 12.5 }}>
          <Eye size={14} /> Espace de consultation — seul l'administrateur peut saisir ou modifier ces informations.
        </div>
      )}

      <Card title="Retour du soir">
        {isAdmin ? (
          <div>
            <Label>Choisir un vendeur</Label>
            <VendorPicker vendors={activeVendors} selectedId={selectedVendorId} onSelect={setSelectedVendorId} />
          </div>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A" }}>Vendeur : {vendorFullName(vendor)}</div>
        )}
        {isAdmin && <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0F1F4" }}><VendorMiniHeader vendor={vendor} /></div>}
      </Card>

      <Card title={`Produits distribués à ${vendorFullName(vendor)} aujourd'hui`}>
        {pending.length === 0 ? (
          <EmptyState text="Aucun retour en attente pour ce vendeur." />
        ) : isAdmin ? (
          <>
            <Table
              headers={["Produit", "Remis le matin", "Restant ce soir"]}
              rows={pending.map((l) => [
                l.productNom, l.quantiteRemise,
                <TextInput key="i" type="number" min={0} max={l.quantiteRemise} style={{ width: 100 }} placeholder="Qté" value={pendingInputs[l.id] || ""} onChange={(e) => setPendingInputs((s) => ({ ...s, [l.id]: e.target.value }))} />,
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

      {done.length > 0 && (
        <Card title={`Retours déjà enregistrés pour ${vendorFullName(vendor)}`}>
          <Table
            headers={
              isAdmin
                ? ["Produit", "Remis", "Restant", "Vendu", "Montant attendu", "Stock", ""]
                : ["Produit", "Remis", "Restant", "Vendu", "Montant attendu", "Stock"]
            }
            rows={done.map((l) => {
              const enCorrection = isAdmin && correctionId === l.id;
              const base = [
                l.productNom,
                l.quantiteRemise,
                enCorrection ? (
                  <TextInput
                    key="i"
                    type="number"
                    min={0}
                    max={l.quantiteRemise}
                    style={{ width: 90 }}
                    value={correctionInputs[l.id] ?? ""}
                    onChange={(e) => setCorrectionInputs((s) => ({ ...s, [l.id]: e.target.value }))}
                  />
                ) : (
                  l.quantiteRestante
                ),
                l.quantiteVendue > 0 ? (
                  <span
                    key="v"
                    style={{
                      display: "inline-block", minWidth: 22, textAlign: "center",
                      fontWeight: 700, fontSize: 12.5, color: "#8A5A00",
                      background: "#FFE9A8", padding: "3px 9px", borderRadius: 6,
                    }}
                  >
                    {l.quantiteVendue}
                  </span>
                ) : (
                  l.quantiteVendue
                ),
                fmtMoney(l.montantAttendu),
                l.quantiteRestante > 0 ? (
                  <span key="s" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#3F8361" }}>
                    <RotateCcw size={12} /> {l.quantiteRestante} retour au stock
                  </span>
                ) : "—",
              ];
              if (isAdmin) {
                base.push(
                  enCorrection ? (
                    <div key="a" style={{ display: "flex", gap: 6 }}>
                      <Button variant="gold" onClick={() => validerCorrection(l)} style={{ padding: "6px 10px", fontSize: 12 }}>OK</Button>
                      <Button variant="ghost" onClick={() => annulerCorrection(l.id)} style={{ padding: "6px 10px", fontSize: 12 }}>Annuler</Button>
                    </div>
                  ) : (
                    <button
                      key="c"
                      onClick={() => commencerCorrection(l)}
                      style={{ ...iconBtnStyle, color: "#1B2A4A" }}
                      title="Corriger ce retour"
                    >
                      <Pencil size={14} />
                    </button>
                  )
                );
              }
              return base;
            })}
          />
          <div
            style={{
              marginTop: 14, paddingTop: 14, borderTop: "1px solid #F0F1F4",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13.5, color: "#5B6472" }}>Nombre total de pièces</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1B2A4A" }}>
              {done.reduce((n, l) => n + l.quantiteRemise, 0)} remises ·{" "}
              <span style={{ color: "#8A5A00", background: "#FFE9A8", padding: "2px 8px", borderRadius: 6 }}>
                {done.reduce((n, l) => n + l.quantiteVendue, 0)} vendues
              </span>
              {" "}· {done.reduce((n, l) => n + l.quantiteRestante, 0)} retournées
            </span>
          </div>
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
              {summary.validePar && (
                <div style={{ fontSize: 12, color: "#5B6472", marginTop: 6 }}>
                  Validé par : <strong>{summary.validePar}</strong>{summary.heureVersement ? ` à ${summary.heureVersement}` : ""}
                </div>
              )}
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
  const { showToast } = useToast();
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
    store.logActivity(currentUser, "send_message", `Message envoyé à ${selectedUser?.username || "un utilisateur"}.`);
    await refreshThread();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const pickFile = () => fileInputRef.current?.click();

  const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024; // 15 Mo
  const BLOCKED_ATTACHMENT_EXTENSIONS = [".exe", ".bat", ".cmd", ".msi", ".sh", ".apk", ".com", ".scr"];

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !conversationId) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      showToast(`Ce fichier est trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). La taille maximale autorisée est de 15 Mo.`, "error");
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (BLOCKED_ATTACHMENT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      showToast("Ce type de fichier n'est pas autorisé en pièce jointe.", "error");
      return;
    }
    setUploading(true);
    try {
      const { url, type } = await store.uploadDMAttachment(conversationId, file);
      await store.sendDMMessage({
        conversationId, senderId: currentUser.id, senderUsername: currentUser.username,
        content: `📎 ${file.name}`, attachmentUrl: url, attachmentType: type,
      });
      store.logActivity(currentUser, "send_attachment", `Pièce jointe envoyée à ${selectedUser?.username || "un utilisateur"} (${file.name}).`);
      await refreshThread();
    } catch (err) {
      showToast("Erreur lors de l'envoi de la pièce jointe : " + (err.message || err), "error");
    }
    setUploading(false);
  };

  const startEdit = (m) => { setEditingId(m.id); setEditText(m.content); };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const saveEdit = async () => {
    if (!editText.trim()) return;
    await store.editDMMessage(editingId, editText.trim());
    store.logActivity(currentUser, "edit_message", `Message modifié dans la conversation avec ${selectedUser?.username || "un utilisateur"}.`);
    setEditingId(null); setEditText("");
    await refreshThread();
  };
  const removeMessage = async (id) => {
    await store.deleteDMMessage(id);
    store.logActivity(currentUser, "delete_message", `Message supprimé dans la conversation avec ${selectedUser?.username || "un utilisateur"}.`);
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

// Libellé, couleur et colonnes du détail par vendeur pour chaque carte
// cliquable de l'onglet Caisse. Les dépenses n'étant pas rattachées à un
// vendeur, elles n'ont pas de ventilation par vendeur (columns = null) —
// on y liste plutôt chaque dépense individuelle de la période.
function caisseMetricLabel(metric) {
  return {
    ca: "Chiffre d'affaires", ecart: "Écart de caisse", depenses: "Dépenses",
    mobile: "Paiement mobile", especes: "Espèces nettes",
  }[metric] || "";
}
function caisseMetricAccent(metric) {
  return {
    ca: "#D9A441", ecart: "#C1554A", depenses: "#C1554A", mobile: "#1B2A4A", especes: "#3F8361",
  }[metric] || "#1B2A4A";
}
function caisseVendorColumns(metric) {
  switch (metric) {
    case "ca":
      return { headers: ["Vendeur", "Chiffre d'affaires", "Quantité vendue"], row: (r) => [r.nom, fmtMoney(r.ca), r.vendu] };
    case "mobile":
      return { headers: ["Vendeur", "Paiement mobile"], row: (r) => [r.nom, fmtMoney(r.mobile)] };
    case "especes":
      return { headers: ["Vendeur", "Espèces versées"], row: (r) => [r.nom, fmtMoney(r.especes)] };
    case "ecart":
      return {
        headers: ["Vendeur", "Écart cumulé", "Jours avec écart", "Jours versés"],
        row: (r) => [r.nom, `${r.ecartTotal > 0 ? "+" : ""}${fmtMoney(r.ecartTotal)}`, r.joursAvecEcart, r.joursFinalises],
      };
    default:
      return null;
  }
}

function Caisse({ vendors, day: dayProp, setDay: setDayProp, withdrawals, setWithdrawals, notifications, setNotifications, daysList, today, currentUser }) {
  const [viewDate, setViewDate] = useState(today);
  const [pastDay, setPastDay] = useState(null);
  const prevTodayRef = useRef(today);

  // Corrige le bug : si l'onglet Caisse reste ouvert d'un jour à l'autre,
  // viewDate restait figé sur la veille et affichait donc les dépenses
  // d'hier comme si c'était celles d'aujourd'hui. On resynchronise
  // automatiquement viewDate dès que "today" avance.
  useEffect(() => {
    if (viewDate === prevTodayRef.current && today !== prevTodayRef.current) {
      setViewDate(today);
    }
    prevTodayRef.current = today;
  }, [today, viewDate]);

  useEffect(() => {
    if (viewDate === today) { setPastDay(null); return; }
    (async () => setPastDay(await store.getDay(viewDate)))();
  }, [viewDate, today]);

  const day = viewDate === today ? dayProp : (pastDay || emptyDay(viewDate));
  const setDay = async (next) => {
    if (viewDate === today) { await setDayProp(next); return; }
    setPastDay(next);
    await store.setDay(next);
  };
  const { showToast } = useToast();
  const [label, setLabel] = useState("");
  const [montant, setMontant] = useState("");
  const [allDays, setAllDays] = useState(null);

  useEffect(() => {
    (async () => {
      const loaded = await store.getDaysInRange(daysList || []);
      setAllDays(loaded);
    })();
  }, [daysList]);

  // Détail dépliable d'une carte de la Caisse (CA, écart, dépenses, mobile,
  // espèces nettes) sur une période choisie — avec ventilation par vendeur
  // (versements/écarts individuels) quand la métrique s'y prête.
  const [caisseDetailMetric, setCaisseDetailMetric] = useState(null);
  const [caisseDetailPeriodType, setCaisseDetailPeriodType] = useState("mois");
  const [caisseDetailMonth, setCaisseDetailMonth] = useState(today.slice(0, 7));
  const [caisseDetailCustomRange, setCaisseDetailCustomRange] = useState([today, today]);
  const [caisseDetailLoading, setCaisseDetailLoading] = useState(false);
  const [caisseDetailData, setCaisseDetailData] = useState(null);
  const [caisseDetailError, setCaisseDetailError] = useState("");

  const chargerDetailCaisse = async (metric, periodType, monthValue, customRange) => {
    setCaisseDetailLoading(true);
    setCaisseDetailError("");
    try {
      const range = rangeForPeriod(periodType, today, monthValue, customRange);
      const dates = (daysList || []).filter((d) => inRange(d, range));
      const loaded = await store.getDaysInRange(dates);
      const daily = buildCaisseDailySeries(loaded, range, vendors);
      const vendorRows = aggregateVendorFullReport(loaded, range, vendors).rows;
      const expensesList = loaded
        .filter((d) => d && inRange(d.date, range))
        .flatMap((d) => (d.expenses || []).map((e) => ({ ...e, date: d.date })))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      setCaisseDetailData({ range, daily, vendorRows, expensesList });
    } catch (err) {
      console.error("Erreur chargement détail caisse :", err);
      setCaisseDetailError("Impossible de charger le détail (" + (err?.message || "erreur inconnue") + "). Réessaie.");
    } finally {
      setCaisseDetailLoading(false);
    }
  };

  const toggleCaisseDetail = (metric) => {
    if (caisseDetailMetric === metric) { setCaisseDetailMetric(null); return; }
    setCaisseDetailMetric(metric);
    chargerDetailCaisse(metric, caisseDetailPeriodType, caisseDetailMonth, caisseDetailCustomRange);
  };

  // Recharge automatiquement dès que la période choisie change, tant qu'une
  // carte est ouverte.
  useEffect(() => {
    if (caisseDetailMetric) chargerDetailCaisse(caisseDetailMetric, caisseDetailPeriodType, caisseDetailMonth, caisseDetailCustomRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caisseDetailPeriodType, caisseDetailMonth, caisseDetailCustomRange]);

  const summaries = vendors.map((v) => ({ vendor: v, summary: computeVersementSummary(day, v.id) })).filter((s) => s.summary.lines.length > 0);

  const totalEspeces = summaries.reduce((s, x) => s + (x.summary.finalise ? x.summary.montantVerseEspeces : 0), 0);
  const totalMobile = summaries.reduce((s, x) => s + x.summary.totalMobile, 0);
  const totalDepenses = (day.expenses || []).reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const especesNettes = totalEspeces - totalDepenses;

  const daysWithToday = allDays ? (allDays.some((d) => d.date === today) ? allDays : [...allDays, dayProp]) : [dayProp];
  const depensesSemaine = sumExpensesOverRange(daysWithToday, getCurrentWeekRange(today));
  const depensesMois = sumExpensesOverRange(daysWithToday, getCurrentMonthRange(today));

  const addExpense = async () => {
    const m = Number(montant);
    if (!label.trim() || montant === "" || Number.isNaN(m)) return;
    if (m <= 0) {
      showToast("Le montant d'une dépense doit être un nombre positif.", "error");
      return;
    }
    const next = { ...day, expenses: [...(day.expenses || []), { id: uid(), label: label.trim(), montant: m }] };
    await setDay(next);
    store.logActivity(currentUser, "add_expense", `Dépense ajoutée : ${label.trim()} (${m} FCFA).`);
    setLabel(""); setMontant("");
  };

  const removeExpense = async (id) => {
    const removed = (day.expenses || []).find((e) => e.id === id);
    if (removed) {
      const ok = window.confirm(`Supprimer la dépense "${removed.label}" (${removed.montant} FCFA) ?`);
      if (!ok) return;
    }
    await setDay({ ...day, expenses: (day.expenses || []).filter((e) => e.id !== id) });
    if (removed) store.logActivity(currentUser, "remove_expense", `Dépense supprimée : ${removed.label} (${removed.montant} FCFA).`);
  };

  const pendingWithdrawals = (withdrawals || []).filter((w) => w.statut === "en_attente");
  const historyWithdrawals = (withdrawals || []).filter((w) => w.statut !== "en_attente");
  const withdrawalsToday = (withdrawals || []).filter((w) => w.date === today);
  const totalAttendu = summaries.reduce((s, x) => s + x.summary.montantAttendu, 0);

  // Écart de caisse global : somme des écarts de versement par vendeur
  // (espèces versées - espèces attendues), sans tenir compte des dépenses
  // du jour. N'est affiché que lorsqu'il y a réellement un écart, juste
  // après la case "montant attendu".
  const ecartCaisse = summaries.reduce((s, x) => s + (x.summary.finalise ? x.summary.ecart : 0), 0);
  const caisseEquilibree = Math.abs(ecartCaisse) < 1;

  // Noms de celui ou ceux qui ont validé les versements du jour, pour
  // mention automatique dans le PDF (ligne "Compté par") au lieu d'une
  // signature manuscrite à remplir.
  const validateurs = Array.from(new Set(summaries.filter((x) => x.summary.finalise && x.summary.validePar).map((x) => x.summary.validePar)));

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

  // Impression / export PDF de la situation de caisse du jour — même
  // principe que pour les rapports et l'inventaire.
  const printRef = useRef(null);
  const printCaisse = () => {
    if (!printRef.current) return;
    document.body.classList.add("printing-section");
    printRef.current.setAttribute("data-print-active", "true");
    window.print();
    const cleanup = () => {
      printRef.current?.removeAttribute("data-print-active");
      document.body.classList.remove("printing-section");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
  };

  return (
    <div>
      <style>{`
        @media print {
          body.printing-section * { visibility: hidden; }
          body.printing-section [data-print-active="true"],
          body.printing-section [data-print-active="true"] * { visibility: visible; }
          body.printing-section [data-print-active="true"] { display: block !important; position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <DayNavigator date={viewDate} today={today} onChange={setViewDate} />

      <div style={{ marginBottom: 20 }}>
        <Button variant="gold" onClick={printCaisse}>
          <Printer size={15} /> Imprimer / Enregistrer en PDF — Situation de caisse du {fmtDateFr(viewDate)}
        </Button>
      </div>

      <div ref={printRef} style={{ display: "none" }}>
        <Card>
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 21, fontWeight: 700, color: "#1B2A4A" }}>
              Situation de caisse — {fmtDateFr(viewDate)}
            </div>
            <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 600, marginTop: 2 }}>
              Caissière : {currentUser?.username || "—"}
            </div>
            <div style={{ fontSize: 12, color: "#8A93A3" }}>
              Document généré le {fmtDateFr(today)}{currentUser?.username ? ` par ${currentUser.username}` : ""}
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="MONTANT ATTENDU (TOUS VENDEURS)" value={fmtMoney(totalAttendu)} accent="#1B2A4A" />
          {!caisseEquilibree && (
            <StatCard
              label="ÉCART DE CAISSE"
              value={`${ecartCaisse > 0 ? "+" : ""}${fmtMoney(ecartCaisse)}`}
              accent={ecartCaisse > 0 ? "#3F9C6D" : "#C1554A"}
              sub={ecartCaisse > 0 ? "Excédent" : "Manquant"}
            />
          )}
          <StatCard label="ESPÈCES NETTES EN CAISSE" value={fmtMoney(especesNettes)} accent="#3F8361" />
          <StatCard label="PAIEMENT MOBILE" value={fmtMoney(totalMobile)} />
          <StatCard label="DÉPENSES DU JOUR" value={fmtMoney(totalDepenses)} accent="#C1554A" />
        </div>

        <Card title="Versements par vendeur">
          {summaries.length === 0 ? (
            <EmptyState text="Aucun vendeur avec un retour du soir clôturé pour l'instant." />
          ) : (
            <Table
              headers={["Vendeur", "Montant attendu", "Mobile", "Espèces versées", "Écart", "Validé par"]}
              rows={summaries.map(({ vendor, summary }) => [
                vendorFullName(vendor),
                fmtMoney(summary.montantAttendu),
                fmtMoney(summary.totalMobile),
                summary.finalise ? fmtMoney(summary.montantVerseEspeces) : "—",
                summary.finalise ? (summary.ecart === 0 ? "Équilibré" : `${summary.ecart > 0 ? "+" : ""}${fmtMoney(summary.ecart)}`) : "—",
                summary.validePar || "—",
              ])}
            />
          )}
        </Card>

        <Card title="Dépenses du jour">
          {(day.expenses || []).length === 0 ? (
            <EmptyState text="Aucune dépense enregistrée aujourd'hui." />
          ) : (
            <Table
              headers={["Libellé", "Montant"]}
              rows={(day.expenses || []).map((e) => [e.label, fmtMoney(e.montant)])}
            />
          )}
        </Card>

        <Card title="Retraits du jour">
          {withdrawalsToday.length === 0 ? (
            <EmptyState text="Aucun retrait demandé aujourd'hui." />
          ) : (
            <Table
              headers={["Vendeur", "Montant", "Mode de paiement", "Statut", "Traité par"]}
              rows={withdrawalsToday.map((w) => [
                w.vendorNom, fmtMoney(w.montant),
                w.methode === "mobile" ? `Mobile — ${w.numeroMobile}` : "Espèces",
                w.statut === "en_attente" ? "En attente" : w.statut === "approuve" ? "Approuvé" : "Refusé",
                w.approvedBy || "—",
              ])}
            />
          )}
        </Card>

        <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginTop: 30, paddingTop: 16, borderTop: "1px solid #F0F1F4" }}>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 11, color: "#8A93A3", marginBottom: 6 }}>Compté par (nom) :</div>
            <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 600, marginBottom: 18 }}>
              {validateurs.length > 0 ? validateurs.join(", ") : "—"}
            </div>
            <div style={{ borderTop: "1px solid #1B2A4A", paddingTop: 4, fontSize: 11, color: "#8A93A3" }}>Signature</div>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 11, color: "#8A93A3", marginBottom: 24 }}>Vérifié par (admin) :</div>
            <div style={{ borderTop: "1px solid #1B2A4A", paddingTop: 4, fontSize: 11, color: "#8A93A3" }}>Signature</div>
          </div>
        </div>
      </div>

      <div className="no-print">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard
          label="CHIFFRE D'AFFAIRES DE LA JOURNÉE" value={fmtMoney(totalAttendu)} accent="#D9A441"
          onClick={() => toggleCaisseDetail("ca")} active={caisseDetailMetric === "ca"}
        />
        {!caisseEquilibree && (
          <StatCard
            label="ÉCART DE CAISSE"
            value={`${ecartCaisse > 0 ? "+" : ""}${fmtMoney(ecartCaisse)}`}
            accent={ecartCaisse > 0 ? "#3F9C6D" : "#C1554A"}
            sub={ecartCaisse > 0 ? "Excédent" : "Manquant"}
            onClick={() => toggleCaisseDetail("ecart")} active={caisseDetailMetric === "ecart"}
          />
        )}
        <StatCard
          label="DÉPENSES — AUJOURD'HUI" value={fmtMoney(totalDepenses)} accent="#C1554A"
          onClick={() => toggleCaisseDetail("depenses")} active={caisseDetailMetric === "depenses"}
        />
        <StatCard
          label="TOTAL PAIEMENT MOBILE" value={fmtMoney(totalMobile)} accent="#1B2A4A"
          onClick={() => toggleCaisseDetail("mobile")} active={caisseDetailMetric === "mobile"}
        />
        <StatCard
          label="TOTAL ESPÈCES (net des dépenses)" value={fmtMoney(especesNettes)} accent="#3F8361"
          onClick={() => toggleCaisseDetail("especes")} active={caisseDetailMetric === "especes"}
        />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard
          label="DÉPENSES — CETTE SEMAINE" value={fmtMoney(depensesSemaine)} accent="#C1554A"
          onClick={() => { setCaisseDetailPeriodType("semaine"); toggleCaisseDetail("depenses"); }}
          active={caisseDetailMetric === "depenses" && caisseDetailPeriodType === "semaine"}
        />
        <StatCard
          label="DÉPENSES — CE MOIS" value={fmtMoney(depensesMois)} accent="#C1554A"
          onClick={() => { setCaisseDetailPeriodType("mois"); toggleCaisseDetail("depenses"); }}
          active={caisseDetailMetric === "depenses" && caisseDetailPeriodType === "mois"}
        />
      </div>

      {caisseDetailMetric && (
        <Card
          title={`Détail — ${caisseMetricLabel(caisseDetailMetric)}`}
          right={
            <button onClick={() => setCaisseDetailMetric(null)} title="Fermer le détail" style={iconBtnStyle}>
              <X size={16} />
            </button>
          }
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <Label>Période</Label>
              <PeriodSelector
                value={caisseDetailPeriodType} onChange={setCaisseDetailPeriodType}
                customRange={caisseDetailCustomRange} onCustomRangeChange={setCaisseDetailCustomRange}
              />
            </div>
            {caisseDetailPeriodType === "mois" && (
              <div style={{ flex: "1 1 160px" }}>
                <Label>Mois</Label>
                <TextInput type="month" value={caisseDetailMonth} onChange={(e) => setCaisseDetailMonth(e.target.value)} />
              </div>
            )}
          </div>

          {caisseDetailError && (
            <div style={{ fontSize: 12.5, color: "#C1554A", marginBottom: 12 }}>{caisseDetailError}</div>
          )}

          {caisseDetailLoading ? (
            <div style={{ fontSize: 13, color: "#8A93A3" }}>Chargement…</div>
          ) : caisseDetailData ? (
            (() => {
              const total = caisseDetailData.daily.reduce((s, d) => s + (d[caisseDetailMetric] || 0), 0);
              const vendorCols = caisseVendorColumns(caisseDetailMetric);
              return (
                <>
                  <div style={{ fontSize: 13, color: "#1B2A4A", fontWeight: 700, marginBottom: 4, textTransform: "capitalize" }}>
                    {periodLabelFR(caisseDetailPeriodType, caisseDetailData.range, caisseDetailMonth)}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#8A93A3", marginBottom: 16 }}>
                    Total sur la période : <strong style={{ color: caisseMetricAccent(caisseDetailMetric) }}>
                      {total > 0 && caisseDetailMetric === "ecart" ? "+" : ""}{fmtMoney(total)}
                    </strong>
                  </div>

                  <div style={{ height: 200, marginBottom: 20 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={caisseDetailData.daily} margin={{ left: 0, right: 10, top: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A93A3" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#8A93A3" }} />
                        <Tooltip formatter={(v) => fmtMoney(v)} labelFormatter={(l) => `Jour ${l}`} />
                        <Line type="monotone" dataKey={caisseDetailMetric} stroke={caisseMetricAccent(caisseDetailMetric)} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <Table
                    headers={["Date", caisseMetricLabel(caisseDetailMetric)]}
                    rows={caisseDetailData.daily
                      .filter((d) => d[caisseDetailMetric] !== 0)
                      .map((d) => [formatDateFR(d.date), `${d[caisseDetailMetric] > 0 && caisseDetailMetric === "ecart" ? "+" : ""}${fmtMoney(d[caisseDetailMetric])}`])}
                  />
                  {caisseDetailData.daily.every((d) => d[caisseDetailMetric] === 0) && (
                    <EmptyState text="Aucun mouvement sur cette période." />
                  )}

                  {vendorCols ? (
                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 15, fontWeight: 700, color: "#1B2A4A", marginBottom: 10 }}>
                        Détail par vendeur
                      </div>
                      {caisseDetailData.vendorRows.filter((r) => r.joursActifs > 0 || r.joursFinalises > 0).length === 0 ? (
                        <EmptyState text="Aucune activité de vendeur sur cette période." />
                      ) : (
                        <Table
                          headers={vendorCols.headers}
                          rows={caisseDetailData.vendorRows
                            .filter((r) => r.joursActifs > 0 || r.joursFinalises > 0)
                            .map(vendorCols.row)}
                        />
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 15, fontWeight: 700, color: "#1B2A4A", marginBottom: 6 }}>
                        Dépenses de la période
                      </div>
                      <div style={{ fontSize: 12, color: "#8A93A3", marginBottom: 10 }}>
                        Les dépenses ne sont pas rattachées à un vendeur en particulier — voici chaque dépense individuelle.
                      </div>
                      {caisseDetailData.expensesList.length === 0 ? (
                        <EmptyState text="Aucune dépense sur cette période." />
                      ) : (
                        <Table
                          headers={["Date", "Libellé", "Montant"]}
                          rows={caisseDetailData.expensesList.map((e) => [formatDateFR(e.date), e.label, fmtMoney(e.montant)])}
                        />
                      )}
                    </div>
                  )}
                </>
              );
            })()
          ) : null}
        </Card>
      )}

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
            headers={["Vendeur", "Montant attendu", "Mobile", "Espèces versées", "Écart", "Validé par"]}
            rows={summaries.map(({ vendor, summary }) => [
              vendorFullName(vendor),
              fmtMoney(summary.montantAttendu),
              fmtMoney(summary.totalMobile),
              summary.finalise ? fmtMoney(summary.montantVerseEspeces) : "—",
              summary.finalise ? (
                <Badge key="b" ok={summary.statut === "equilibre"} okText="Équilibré" warnText={`${summary.ecart > 0 ? "+" : ""}${fmtMoney(summary.ecart)}`} />
              ) : "—",
              summary.validePar || "—",
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

// Sélecteur à 4 options (Semaine / Mois / Trimestre / Année), utilisé par
// les deux cartes de l'onglet Rapports.
function PeriodSelector({ value, onChange, customRange, onCustomRangeChange }) {
  const options = [
    { key: "semaine", label: "Semaine" },
    { key: "mois", label: "Mois" },
    { key: "trimestre", label: "Trimestre" },
    { key: "annee", label: "Année" },
    ...(onCustomRangeChange ? [{ key: "personnalise", label: "Personnalisé" }] : []),
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: value === o.key ? "2px solid #D9A441" : "1px solid #D8DCE3",
              background: value === o.key ? "#FFF8EC" : "#fff", color: "#1B2A4A",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value === "personnalise" && onCustomRangeChange && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <input
              type="date"
              value={customRange?.[0] || ""}
              // En changeant la date de début, on aligne aussi la fin sur
              // cette même date : choisir UNE date affiche directement les
              // dépenses (et le reste) de CE jour-là, sans devoir aussi
              // toucher le second champ. Pour une vraie plage, l'utilisateur
              // ajuste ensuite le champ "au" séparément. (Pas de max ici :
              // sinon impossible de repartir sur une date plus tardive après
              // un premier choix.)
              onChange={(e) => onCustomRangeChange([e.target.value, e.target.value])}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D8DCE3", fontSize: 13, fontFamily: "Calibri, Arial, sans-serif", color: "#1B2A4A" }}
            />
          </div>
          <span style={{ fontSize: 12.5, color: "#8A93A3" }}>au</span>
          <div>
            <input
              type="date"
              value={customRange?.[1] || ""}
              onChange={(e) => onCustomRangeChange([customRange?.[0] || e.target.value, e.target.value])}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D8DCE3", fontSize: 13, fontFamily: "Calibri, Arial, sans-serif", color: "#1B2A4A" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Calcule la plage de dates correspondant au type de période choisi.
// "mois" reste piloté par un sélecteur AAAA-MM (pour choisir n'importe quel
// mois) ; les trois autres se basent toujours sur la période en cours.
function rangeForPeriod(type, today, monthValue, customRange) {
  if (type === "semaine") return getCurrentWeekRange(today);
  if (type === "mois") return monthRangeFromInput(monthValue);
  if (type === "trimestre") return getCurrentQuarterRange(today);
  if (type === "personnalise") {
    if (customRange && customRange[0] && customRange[1]) {
      return customRange[0] <= customRange[1] ? customRange : [customRange[1], customRange[0]];
    }
    return [today, today];
  }
  return getCurrentYearRange(today);
}

function periodLabelFR(type, range, monthValue) {
  if (type === "mois") return monthLabelFR(monthValue);
  if (type === "semaine") return `Semaine du ${formatDateFR(range[0])} au ${formatDateFR(range[1])}`;
  if (type === "personnalise") return `Du ${formatDateFR(range[0])} au ${formatDateFR(range[1])}`;
  if (type === "trimestre") {
    const trimestre = Math.floor((parseInt(range[0].slice(5, 7), 10) - 1) / 3) + 1;
    return `${trimestre}ᵉ trimestre ${range[0].slice(0, 4)}`;
  }
  return `Année ${range[0].slice(0, 4)}`;
}

function Rapports({ vendors, products, daysList, today, day }) {
  const [periodType, setPeriodType] = useState("mois");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [customRange, setCustomRange] = useState([today, today]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState("");

  const [produitPeriodType, setProduitPeriodType] = useState("mois");
  const [produitMonth, setProduitMonth] = useState(today.slice(0, 7));
  const [produitCustomRange, setProduitCustomRange] = useState([today, today]);
  const [produitLoading, setProduitLoading] = useState(false);
  const [produitReport, setProduitReport] = useState(null);
  const [produitError, setProduitError] = useState("");

  const [vendorPeriodType, setVendorPeriodType] = useState("mois");
  const [vendorMonth, setVendorMonth] = useState(today.slice(0, 7));
  const [vendorCustomRange, setVendorCustomRange] = useState([today, today]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorReport, setVendorReport] = useState(null);
  const [vendorError, setVendorError] = useState("");

  // Rapport détaillé par produit — sur la période choisie (semaine / mois /
  // trimestre / année / personnalisée).
  const genererRapportProduits = async () => {
    setProduitLoading(true);
    setProduitError("");
    try {
      const range = rangeForPeriod(produitPeriodType, today, produitMonth, produitCustomRange);
      const dates = daysList.filter((d) => inRange(d, range));
      const loaded = await store.getDaysInRange(dates);
      setProduitReport({ range, ...aggregateProductReport(loaded, range, products) });
    } catch (err) {
      console.error("Erreur génération rapport produits :", err);
      setProduitError(
        "Impossible de générer le rapport (" + (err?.message || "erreur inconnue") + "). Réessaie, et si ça persiste, réduis la période ou vérifie ta connexion."
      );
    } finally {
      setProduitLoading(false);
    }
  };

  // Rapport vendeurs — classement complet sur la période choisie, avec le
  // plus et le moins rentable mis en avant, l'évolution par rapport à la
  // période précédente, et une alerte si un vendeur reste "moins rentable"
  // plusieurs périodes de suite.
  const genererRapportVendeurs = async () => {
    setVendorLoading(true);
    setVendorError("");
    try {
      const range = rangeForPeriod(vendorPeriodType, today, vendorMonth, vendorCustomRange);
      const prevRange = previousRangeForPeriod(vendorPeriodType, today, vendorMonth, vendorCustomRange);

      const dates = daysList.filter((d) => inRange(d, range));
      const datesPrec = daysList.filter((d) => inRange(d, prevRange));
      const [loaded, loadedPrec] = await Promise.all([
        store.getDaysInRange(dates),
        store.getDaysInRange(datesPrec),
      ]);

      const base = aggregateVendorFullReport(loaded, range, vendors);
      const basePrec = aggregateVendorFullReport(loadedPrec, prevRange, vendors);
      const precParVendeur = Object.fromEntries(basePrec.rows.map((r) => [r.vendorId, r]));

      const rows = base.rows.map((r) => {
        const prec = precParVendeur[r.vendorId];
        let evolution = null;
        if (prec && prec.ca > 0) evolution = { type: "pct", value: Math.round(((r.ca - prec.ca) / prec.ca) * 100) };
        else if (r.ca > 0) evolution = { type: "nouveau" };
        return { ...r, evolution };
      });

      // Un même vendeur reste-t-il "le moins rentable" depuis plusieurs
      // périodes de suite ? On regarde jusqu'à 6 périodes en arrière.
      let streakMoinsRentable = 0;
      if (base.moinsRentable) {
        const cible = base.moinsRentable.vendorId;
        const plages = periodsBack(vendorPeriodType, today, vendorMonth, 6, vendorCustomRange);
        for (const plage of plages) {
          const datesPlage = daysList.filter((d) => inRange(d, plage));
          const joursPlage = await store.getDaysInRange(datesPlage);
          const rapportPlage = aggregateVendorFullReport(joursPlage, plage, vendors);
          if (rapportPlage.moinsRentable && rapportPlage.moinsRentable.vendorId === cible) streakMoinsRentable += 1;
          else break;
        }
      }

      setVendorReport({ range, rows, plusRentable: base.plusRentable, moinsRentable: base.moinsRentable, streakMoinsRentable });
    } catch (err) {
      console.error("Erreur génération rapport vendeurs :", err);
      setVendorError("Impossible de générer le rapport (" + (err?.message || "erreur inconnue") + "). Réessaie.");
    } finally {
      setVendorLoading(false);
    }
  };

  const generer = async () => {
    setLoading(true);
    setReportError("");
    try {
      const range = rangeForPeriod(periodType, today, month, customRange);
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
    } catch (err) {
      console.error("Erreur génération rapport mensuel :", err);
      setReportError("Impossible de générer le rapport (" + (err?.message || "erreur inconnue") + "). Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const rapportPrintRef = useRef(null);
  const produitPrintRef = useRef(null);
  const vendorPrintRef = useRef(null);

  // Rafraîchissement automatique : dès qu'une vente, un versement ou une
  // dépense modifie les données du jour, on relance silencieusement le
  // même rapport (même période/mois déjà choisis) s'il a déjà été généré
  // au moins une fois — pour éviter d'afficher des chiffres dépassés.
  useEffect(() => {
    if (report) generer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    if (produitReport) genererRapportProduits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Imprime uniquement la section ciblée : on marque l'élément juste avant
  // d'appeler window.print() (synchrone, dans le même clic), pour éviter
  // tout problème de timing avec le rendu React.
  const printSection = (ref) => {
    if (!ref.current) return;
    document.body.classList.add("printing-section");
    ref.current.setAttribute("data-print-active", "true");
    window.print();
    const cleanup = () => {
      ref.current?.removeAttribute("data-print-active");
      document.body.classList.remove("printing-section");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
  };

  return (
    <div>
      <style>{`
        @media print {
          body.printing-section * { visibility: hidden; }
          body.printing-section [data-print-active="true"],
          body.printing-section [data-print-active="true"] * { visibility: visible; }
          body.printing-section [data-print-active="true"] { position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Card title="Générer un rapport">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Label>Période</Label>
            <PeriodSelector
              value={periodType} onChange={setPeriodType}
              customRange={customRange} onCustomRangeChange={setCustomRange}
            />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {periodType === "mois" && (
              <div style={{ flex: "1 1 180px" }}>
                <Label>Mois</Label>
                <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
            )}
            <Button variant="primary" onClick={generer} disabled={loading}>
              {loading ? "Génération…" : "Générer"}
            </Button>
            {report && (
              <Button variant="gold" onClick={() => printSection(rapportPrintRef)}>
                <Printer size={15} /> Imprimer / Enregistrer en PDF
              </Button>
            )}
          </div>
        </div>
        {reportError && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#C1554A" }}>{reportError}</div>
        )}
      </Card>

      {report && (
        <div ref={rapportPrintRef}>
          <Card>
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 21, fontWeight: 700, color: "#1B2A4A", textTransform: "capitalize" }}>
                Rapport — {periodLabelFR(periodType, report.range, month)}
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

      <Card title="Rapport détaillé par produit">
        <div style={{ fontSize: 12.5, color: "#8A93A3", marginBottom: 12 }}>
          Stock, quantité remise (sortie), quantité invendue retournée (entrée), quantité vendue et
          chiffre d'affaires pour chaque produit, sur la période choisie.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Label>Période</Label>
            <PeriodSelector
              value={produitPeriodType} onChange={setProduitPeriodType}
              customRange={produitCustomRange} onCustomRangeChange={setProduitCustomRange}
            />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {produitPeriodType === "mois" && (
              <div style={{ flex: "1 1 180px" }}>
                <Label>Mois</Label>
                <TextInput type="month" value={produitMonth} onChange={(e) => setProduitMonth(e.target.value)} />
              </div>
            )}
            <Button variant="primary" onClick={genererRapportProduits} disabled={produitLoading}>
              {produitLoading ? "Génération…" : "Générer"}
            </Button>
            {produitReport && (
              <Button variant="gold" onClick={() => printSection(produitPrintRef)}>
                <Printer size={15} /> Imprimer / Enregistrer en PDF
              </Button>
            )}
          </div>
        </div>
        {produitError && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#C1554A" }}>{produitError}</div>
        )}

        {produitReport && (
          <div ref={produitPrintRef} style={{ marginTop: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 19, fontWeight: 700, color: "#1B2A4A" }}>
                Rapport détaillé par produit
              </div>
            </div>
            <ProductReportPeriod
              titre={periodLabelFR(produitPeriodType, produitReport.range, produitMonth)}
              data={produitReport}
            />
          </div>
        )}
      </Card>

      <Card title="Rapport vendeurs">
        <div style={{ fontSize: 12.5, color: "#8A93A3", marginBottom: 12 }}>
          Classement des vendeurs sur la période choisie, avec le plus et le moins rentable mis en avant.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Label>Période</Label>
            <PeriodSelector
              value={vendorPeriodType} onChange={setVendorPeriodType}
              customRange={vendorCustomRange} onCustomRangeChange={setVendorCustomRange}
            />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {vendorPeriodType === "mois" && (
              <div style={{ flex: "1 1 180px" }}>
                <Label>Mois</Label>
                <TextInput type="month" value={vendorMonth} onChange={(e) => setVendorMonth(e.target.value)} />
              </div>
            )}
            <Button variant="primary" onClick={genererRapportVendeurs} disabled={vendorLoading}>
              {vendorLoading ? "Génération…" : "Générer"}
            </Button>
            {vendorReport && (
              <Button variant="gold" onClick={() => printSection(vendorPrintRef)}>
                <Printer size={15} /> Imprimer / Enregistrer en PDF
              </Button>
            )}
          </div>
        </div>
        {vendorError && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#C1554A" }}>{vendorError}</div>
        )}

        {vendorReport && (
          <div ref={vendorPrintRef} style={{ marginTop: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 19, fontWeight: 700, color: "#1B2A4A" }}>
                Rapport vendeurs — {periodLabelFR(vendorPeriodType, vendorReport.range, vendorMonth)}
              </div>
            </div>

            {vendorReport.rows.length === 0 ? (
              <EmptyState text="Aucun vendeur pour le moment." />
            ) : (
              <>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                  {vendorReport.plusRentable && (
                    <div style={{ flex: "1 1 260px", padding: 16, borderRadius: 12, background: "#F3F9F4", border: "1px solid #CFE9D4" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#3F8361", letterSpacing: 0.4 }}>🏆 VENDEUR LE PLUS RENTABLE</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1B2A4A", marginTop: 4 }}>{vendorReport.plusRentable.nom}</div>
                      <div style={{ fontSize: 13, color: "#5B6472", marginTop: 2 }}>
                        {fmtMoney(vendorReport.plusRentable.ca)} · {vendorReport.plusRentable.vendu} vendu(s) sur {vendorReport.plusRentable.joursActifs} jour(s)
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <EvolutionBadge evolution={vendorReport.rows.find((r) => r.vendorId === vendorReport.plusRentable.vendorId)?.evolution} />
                        <span style={{ fontSize: 11.5, color: "#8A93A3", marginLeft: 6 }}>vs période précédente</span>
                      </div>
                    </div>
                  )}
                  {vendorReport.moinsRentable && (
                    <div style={{ flex: "1 1 260px", padding: 16, borderRadius: 12, background: "#FBF3F2", border: "1px solid #F0D3CF" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#C1554A", letterSpacing: 0.4 }}>⚠️ VENDEUR LE MOINS RENTABLE</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1B2A4A", marginTop: 4 }}>{vendorReport.moinsRentable.nom}</div>
                      <div style={{ fontSize: 13, color: "#5B6472", marginTop: 2 }}>
                        {fmtMoney(vendorReport.moinsRentable.ca)} · {vendorReport.moinsRentable.vendu} vendu(s) sur {vendorReport.moinsRentable.joursActifs} jour(s)
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <EvolutionBadge evolution={vendorReport.rows.find((r) => r.vendorId === vendorReport.moinsRentable.vendorId)?.evolution} />
                        <span style={{ fontSize: 11.5, color: "#8A93A3", marginLeft: 6 }}>vs période précédente</span>
                      </div>
                      {vendorReport.streakMoinsRentable >= 2 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0D3CF", fontSize: 12.5, color: "#C1554A", fontWeight: 600 }}>
                          🔁 Moins rentable depuis {vendorReport.streakMoinsRentable} périodes consécutives — une discussion avec lui pourrait aider à comprendre pourquoi.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Table
                  headers={["Vendeur", "Chiffre d'affaires", "Évolution", "Vendu", "Espèces", "Mobile", "Jours actifs", "CA / jour actif", "Fiabilité caisse", "Régularité", "Produit fétiche"]}
                  rows={vendorReport.rows.map((r) => [
                    r.nom, fmtMoney(r.ca), <EvolutionBadge key="ev" evolution={r.evolution} />, r.vendu, fmtMoney(r.especes), fmtMoney(r.mobile), r.joursActifs,
                    r.joursActifs > 0 ? fmtMoney(r.caParJour) : "—",
                    <FiabiliteCell key="fia" r={r} />,
                    regulariteLabel(r.regulariteCV),
                    r.produitFetiche ? `${r.produitFetiche.nom} (${r.produitFetiche.vendu})` : "—",
                  ])}
                />
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// Tableau d'une période (semaine / mois / année) pour le rapport détaillé par
// produit, avec mise en avant du ou des produit(s) le(s) plus vendu(s).
function ProductReportPeriod({ titre, data }) {
  const { rows, topVendus } = data;
  const topNames = new Set(topVendus.map((r) => r.productId));
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1B2A4A", marginBottom: 8 }}>{titre}</div>
      {rows.length === 0 ? (
        <EmptyState text="Aucune donnée sur cette période." />
      ) : (
        <>
          <Table
            headers={["Produit", "Stock actuel", "Entrée (retours)", "Sortie (remis)", "Vendu", "Chiffre d'affaires"]}
            rows={rows.map((r) => [
              topNames.has(r.productId) ? `⭐ ${r.nom}` : r.nom,
              r.stockActuel === null ? "—" : r.stockActuel,
              r.entree,
              r.sortie,
              r.vendu,
              fmtMoney(r.ca),
            ])}
          />
          {topVendus.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#8A93A3" }}>
              ⭐ Produit{topVendus.length > 1 ? "s" : ""} le{topVendus.length > 1 ? "s" : ""} plus vendu{topVendus.length > 1 ? "s" : ""} :{" "}
              <strong style={{ color: "#1B2A4A" }}>{topVendus.map((r) => r.nom).join(", ")}</strong> ({data.maxVendu} unités)
            </div>
          )}
        </>
      )}
    </div>
  );
}

function paymentModeInfo(summary) {
  const hasEspeces = summary.finalise && summary.montantVerseEspeces > 0;
  const hasMobile = summary.totalMobile > 0;
  if (hasEspeces && hasMobile) return { label: "Espèces + Mobile", color: "#1B2A4A" };
  if (hasEspeces) return { label: "Espèces", color: "#3F8361" };
  if (hasMobile) return { label: "Mobile", color: "#1B2A4A" };
  return { label: "Non finalisé", color: "#9AA2B1" };
}

// ---------------------------------------------------------------------------
// Fil d'actualité — paliers de vente atteints, anniversaires du jour et
// annonces admin/gestionnaire, avec réactions. Visible par toute l'équipe
// (sauf les comptes messagerie, volontairement limités à la Messagerie).
// ---------------------------------------------------------------------------

function timeAgoFR(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return fmtDateFr(iso.slice(0, 10));
}

function NewsFeedReactions({ item, onReact }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      {["👍", "❤️"].map((emoji) => {
        const count = item.reactions?.[emoji] || 0;
        const mine = item.myReaction === emoji;
        return (
          <button
            key={emoji}
            onClick={() => onReact(item, emoji)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999,
              border: `1px solid ${mine ? "#D9A441" : "#E4E7EC"}`, background: mine ? "#FBF3E1" : "#fff",
              cursor: "pointer", fontSize: 12.5, color: mine ? "#8A6410" : "#5B6472",
            }}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function NewsFeedItem({ item, onReact, onDelete }) {
  let icon, title, body, accent;
  if (item.type === "achievement") {
    icon = <Trophy size={18} color={PALIER_COLORS[item.palier]} />;
    title = `${item.vendorNom} a atteint l'objectif ${PALIER_LABELS[item.palier]?.toLowerCase() || item.palier}`;
    body = `Chiffre d'affaires du jour : ${fmtMoney(item.montant)}`;
    accent = PALIER_COLORS[item.palier];
  } else if (item.type === "birthday") {
    icon = <Cake size={18} color="#C1554A" />;
    title = `Joyeux anniversaire ${item.vendorPrenom ? `${item.vendorPrenom} ` : ""}${item.vendorNom} !`;
    body = item.age ? `${item.age} ans aujourd'hui 🎉` : "Aujourd'hui, c'est son anniversaire 🎉";
    accent = "#C1554A";
  } else {
    icon = <Newspaper size={18} color="#1B2A4A" />;
    title = item.createdBy ? `Annonce de ${item.createdBy}` : "Annonce";
    body = item.content;
    accent = "#1B2A4A";
  }

  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 4px", borderBottom: "1px solid #F0F1F4" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${accent}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1B2A4A" }}>{title}</div>
          <div style={{ fontSize: 11, color: "#9AA2B1", whiteSpace: "nowrap" }}>{timeAgoFR(item.createdAt)}</div>
        </div>
        <div style={{ fontSize: 13, color: "#5B6472", marginTop: 3, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{body}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <NewsFeedReactions item={item} onReact={onReact} />
          {item.type === "announcement" && item.canDelete && (
            <button onClick={() => onDelete(item)} title="Supprimer cette annonce" style={{ ...iconBtnStyle, color: "#C1554A" }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewsFeed({ currentUser }) {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerText, setComposerText] = useState("");
  const [posting, setPosting] = useState(false);

  const canPost = currentUser?.role === "admin" || currentUser?.role === "manager";

  const load = async () => {
    try {
      const data = await store.getNewsFeed();
      setItems(data);
      setError("");
    } catch (e) {
      setError(e.message || "Erreur lors du chargement du fil d'actualité.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReact = async (item, emoji) => {
    // Mise à jour optimiste pour une réaction instantanée, puis on
    // resynchronise avec le serveur (source de vérité pour les compteurs).
    setItems((prev) => prev.map((it) => {
      if (it.type !== item.type || it.key !== item.key) return it;
      const reactions = { ...it.reactions };
      if (it.myReaction) reactions[it.myReaction] = Math.max(0, (reactions[it.myReaction] || 0) - 1);
      const nextMine = it.myReaction === emoji ? null : emoji;
      if (nextMine) reactions[nextMine] = (reactions[nextMine] || 0) + 1;
      return { ...it, reactions, myReaction: nextMine };
    }));
    try {
      await store.reactToNewsItem(item.type, item.key, emoji);
    } catch (e) {
      showToast(e.message || "Erreur lors de l'envoi de la réaction.", "error");
      load();
    }
  };

  const handlePost = async () => {
    const content = composerText.trim();
    if (!content) return;
    setPosting(true);
    try {
      await store.postAnnouncement(content);
      setComposerText("");
      await load();
      showToast("Annonce publiée.", "success");
    } catch (e) {
      showToast(e.message || "Erreur lors de la publication.", "error");
    }
    setPosting(false);
  };

  const handleDelete = async (item) => {
    const ok = window.confirm("Supprimer cette annonce ?");
    if (!ok) return;
    try {
      await store.deleteAnnouncement(item.key);
      await load();
    } catch (e) {
      showToast(e.message || "Erreur lors de la suppression.", "error");
    }
  };

  return (
    <div>
      {canPost && (
        <Card title="Publier une annonce">
          <TextArea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder="Un message pour toute l'équipe…"
            rows={3}
          />
          <div style={{ marginTop: 10 }}>
            <Button onClick={handlePost} disabled={posting || !composerText.trim()}>
              <Send size={15} /> {posting ? "Publication…" : "Publier"}
            </Button>
          </div>
        </Card>
      )}

      <Card title="Fil d'actualité">
        {loading ? (
          <div style={{ fontSize: 13, color: "#8A93A3" }}>Chargement…</div>
        ) : error ? (
          <div style={{ fontSize: 13, color: "#C1554A" }}>{error}</div>
        ) : items.length === 0 ? (
          <EmptyState text="Rien à afficher pour l'instant — les paliers de vente atteints, anniversaires et annonces apparaîtront ici." />
        ) : (
          <div>
            {items.map((item) => (
              <NewsFeedItem key={`${item.type}:${item.key}`} item={item} onReact={handleReact} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Historique({ vendors, daysList, today, currentUser, reloadVendors }) {
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || "");
  const [allDays, setAllDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);
  const [ficheVendorId, setFicheVendorId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const loaded = await store.getDaysInRange(daysList || []);
      setAllDays(loaded);
      setLoading(false);
    })();
  }, [daysList]);

  useEffect(() => {
    if (!selectedVendorId && vendors[0]) setSelectedVendorId(vendors[0].id);
  }, [vendors]);

  if (vendors.length === 0) {
    return <Card title="Historique"><EmptyState text="Ajoute d'abord un vendeur dans l'onglet Vendeurs & comptes." /></Card>;
  }

  const vendor = vendors.find((v) => v.id === selectedVendorId) || vendors[0];

  // Jours où ce vendeur a eu de l'activité, du plus récent au plus ancien.
  const vendorDays = (allDays || [])
    .filter((d) => d.lines.some((l) => l.vendorId === vendor.id))
    .map((d) => {
      const lines = d.lines.filter((l) => l.vendorId === vendor.id);
      const summary = computeVersementSummary(d, vendor.id);
      const totalVendu = lines.reduce((s, l) => s + (l.quantiteVendue || 0), 0);
      return { date: d.date, lines, summary, totalVendu };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totaux = vendorDays.reduce((acc, d) => {
    acc.ca += d.summary.montantAttendu;
    acc.qte += d.totalVendu;
    acc.especes += d.summary.finalise ? d.summary.montantVerseEspeces : 0;
    acc.mobile += d.summary.totalMobile;
    return acc;
  }, { ca: 0, qte: 0, especes: 0, mobile: 0 });

  return (
    <div>
      <Card title="Vendeurs">
        <VendorPicker vendors={vendors} selectedId={vendor.id} onSelect={(id) => { setSelectedVendorId(id); setExpandedDate(null); }} />
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0F1F4", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <VendorMiniHeader vendor={vendor} />
          <Button variant="ghost" onClick={() => setFicheVendorId(vendor.id)}><UserCircle size={15} /> Voir sa fiche personnelle</Button>
        </div>
      </Card>

      {loading ? (
        <Card><EmptyState text="Chargement de l'historique…" /></Card>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="CHIFFRE D'AFFAIRES TOTAL" value={fmtMoney(totaux.ca)} accent="#D9A441" />
            <StatCard label="QUANTITÉ TOTALE VENDUE" value={totaux.qte} />
            <StatCard label="TOTAL REÇU EN ESPÈCES" value={fmtMoney(totaux.especes)} accent="#3F8361" />
            <StatCard label="TOTAL REÇU EN MOBILE" value={fmtMoney(totaux.mobile)} accent="#1B2A4A" />
          </div>

          <Card title={`Historique détaillé — ${vendorFullName(vendor)}`}>
            {vendorDays.length === 0 ? (
              <EmptyState text="Aucune activité enregistrée pour ce vendeur." />
            ) : (
              vendorDays.map((d) => {
                const isOpen = expandedDate === d.date;
                const mode = paymentModeInfo(d.summary);
                return (
                  <div key={d.date} style={{ borderBottom: "1px solid #F0F1F4" }}>
                    <button
                      onClick={() => setExpandedDate(isOpen ? null : d.date)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left", flexWrap: "wrap", gap: 6 }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#1B2A4A" }}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        {formatDateFR(d.date)}
                        {d.date === today && <span style={{ fontSize: 11, color: "#D9A441", fontWeight: 700 }}>AUJOURD'HUI</span>}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#5B6472" }}>
                        <span>{fmtMoney(d.summary.montantAttendu)} · {d.totalVendu} pièce{d.totalVendu > 1 ? "s" : ""}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: mode.color }}>{mode.label}</span>
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "4px 4px 18px 23px" }}>
                        <Table
                          headers={["Produit", "Remis", "Restant", "Vendu", "Montant attendu"]}
                          rows={d.lines.map((l) => [
                            l.productNom, l.quantiteRemise, l.quantiteRestante ?? "—", l.quantiteVendue ?? "—",
                            l.montantAttendu ? fmtMoney(l.montantAttendu) : "—",
                          ])}
                        />

                        {d.summary.mobilePayments.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <Label>Paiements mobiles reçus</Label>
                            <Table headers={["Numéro mobile", "Montant"]} rows={d.summary.mobilePayments.map((m) => [m.numero, fmtMoney(m.montant)])} />
                          </div>
                        )}

                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#5B6472" }}>
                          <span>Espèces versées : <strong style={{ color: "#1B2A4A" }}>{d.summary.finalise ? fmtMoney(d.summary.montantVerseEspeces) : "—"}</strong></span>
                          {d.summary.finalise ? (
                            <Badge ok={d.summary.statut === "equilibre"} okText="Équilibré" warnText={`${d.summary.ecart > 0 ? "+" : ""}${fmtMoney(d.summary.ecart)}`} />
                          ) : (
                            <span style={{ fontStyle: "italic", color: "#9AA2B1" }}>Versement non finalisé</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </>
      )}

      {ficheVendorId && (
        <VendorFiche
          vendor={vendors.find((v) => v.id === ficheVendorId)}
          onClose={() => setFicheVendorId(null)}
          currentUser={currentUser}
          reloadVendors={reloadVendors}
          daysList={daysList}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journal d'activité — connexions et actions de tous les comptes
// (visible uniquement par l'administrateur principal)
// ---------------------------------------------------------------------------

const EVENT_LABELS = {
  login: "Connexion",
  logout: "Déconnexion",
  claim_invite: "Compte créé via invitation",
  add_vendor: "Vendeur ajouté",
  delete_vendor: "Vendeur supprimé",
  upload_vendor_photo: "Photo vendeur",
  edit_vendor_registration_date: "Date d'enregistrement corrigée",
  convert_to_messenger: "Converti en messagerie",
  create_invite_link: "Lien d'invitation généré",
  revoke_invite_link: "Lien d'invitation révoqué",
  add_messenger: "Compte messagerie créé",
  delete_messenger: "Compte messagerie supprimé",
  add_manager: "Gestionnaire ajouté",
  delete_manager: "Gestionnaire supprimé",
  add_secondary_admin: "Admin secondaire créé",
  delete_secondary_admin: "Admin secondaire supprimé",
  add_product: "Produit ajouté",
  update_product_stock: "Stock modifié",
  update_product_category: "Catégorie modifiée",
  delete_product: "Produit supprimé",
  distribute: "Distribution",
  edit_distribution: "Distribution modifiée",
  cancel_distribution: "Distribution annulée",
  report_stock_invendu: "Stock invendu reporté",
  retour_du_soir: "Retour du soir validé",
  correction_retour_du_soir: "Correction d'un retour du soir",
  add_mobile_payment: "Paiement mobile ajouté",
  remove_mobile_payment: "Paiement mobile supprimé",
  enregistrer_versement: "Versement espèces",
  add_expense: "Dépense ajoutée",
  remove_expense: "Dépense supprimée",
  withdrawal_requested: "Retrait demandé",
  withdrawal_status: "Retrait : décision",
  set_attendance: "Pointage",
  set_attendance_bulk: "Pointage (groupé)",
  set_contract_statut: "Statut de contrat modifié",
  salary_paid: "Salaire versé",
  create_contestation: "Contestation envoyée",
  resolve_contestation: "Contestation résolue",
  set_sales_objectives: "Objectifs de vente modifiés",
  send_message: "Message envoyé",
  send_attachment: "Pièce jointe envoyée",
  edit_message: "Message modifié",
  delete_message: "Message supprimé",
};

function eventBadgeColor(eventType) {
  if (eventType === "login") return "#3F8361";
  if (eventType === "logout") return "#8A93A3";
  if (eventType.startsWith("delete") || eventType.startsWith("revoke")) return "#C1554A";
  return "#1B2A4A";
}

// Sélecteur de période pour le journal — mêmes options que Rapports, plus
// une option "Toutes les dates" par défaut (le journal n'a pas de raison
// d'être restreint tant que l'admin n'a pas choisi de filtrer).
const JOURNAL_PERIOD_OPTIONS = [
  { key: "toutes", label: "Toutes les dates" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "trimestre", label: "Trimestre" },
  { key: "annee", label: "Année" },
];

function JournalPeriodSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {JOURNAL_PERIOD_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: value === o.key ? "2px solid #D9A441" : "1px solid #D8DCE3",
            background: value === o.key ? "#FFF8EC" : "#fff", color: "#1B2A4A",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function JournalActivite() {
  const [entries, setEntries] = useState(null);
  const [filterUser, setFilterUser] = useState("");
  const [periodType, setPeriodType] = useState("toutes");
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  useEffect(() => {
    (async () => setEntries(await store.getActivityLog()))();
  }, []);

  if (entries === null) return <EmptyState text="Chargement du journal…" />;

  const today = todayISO();
  const range = periodType === "toutes" ? null : rangeForPeriod(periodType, today, month);

  const usernames = Array.from(new Set(entries.map((e) => e.username)));
  const filtered = entries.filter((e) => {
    if (filterUser && e.username !== filterUser) return false;
    // isoFromDate() convertit vers la date calendaire locale : on évite ainsi
    // qu'un événement proche de minuit (heure locale) tombe dans le mauvais
    // jour à cause du décalage avec l'horodatage UTC stocké en base.
    if (range && !inRange(isoFromDate(new Date(e.createdAt)), range)) return false;
    return true;
  });

  return (
    <Card
      title="Journal d'activité"
      right={
        usernames.length > 1 && (
          <Select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 200 }}>
            <option value="">Tous les comptes</option>
            {usernames.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        )
      }
    >
      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <Label>Période</Label>
          <JournalPeriodSelector value={periodType} onChange={setPeriodType} />
        </div>
        {periodType === "mois" && (
          <div style={{ maxWidth: 220 }}>
            <Label>Mois</Label>
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        )}
        {range && (
          <div style={{ fontSize: 12.5, color: "#8A93A3" }}>
            {periodLabelFR(periodType, range, month)} — {filtered.length} événement{filtered.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={range || filterUser ? "Aucune activité pour ces critères." : "Aucune activité enregistrée pour l'instant."} />
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

// -----------------------------------------------------------------------------
// Entreprises clientes de la plateforme (abonnements) — réservé au super-admin.
// La date de fin d'abonnement n'est jamais saisie à la main : on choisit une
// durée (1, 3, 6 ou 12 mois) et elle est calculée automatiquement, à la
// création comme au renouvellement.
// -----------------------------------------------------------------------------

const DUREES_ABONNEMENT = [
  { value: 1, label: "1 mois" },
  { value: 3, label: "3 mois" },
  { value: 6, label: "6 mois" },
  { value: 12, label: "12 mois" },
];

function joursRestants(dateFin, today) {
  if (!dateFin) return null; // pas de date de fin = accès illimité
  const d1 = new Date(today + "T00:00:00");
  const d2 = new Date(dateFin + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}

function EntreprisesAdmin({ currentUser }) {
  const { showToast } = useToast();
  const today = todayISO();
  const [entreprises, setEntreprises] = useState(null);
  const [saving, setSaving] = useState(false);

  const [nom, setNom] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactTelephone, setContactTelephone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [dureeMois, setDureeMois] = useState(1);
  const [montant, setMontant] = useState("");
  const [notes, setNotes] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const reload = async () => setEntreprises(await store.getEntreprises());
  useEffect(() => { reload(); }, []);

  const [zoomId, setZoomId] = useState(null);
  const [zoomData, setZoomData] = useState(null);
  const [zoomLoading, setZoomLoading] = useState(false);

  const voirDetail = async (entrepriseId) => {
    setZoomId(entrepriseId);
    setZoomData(null);
    setZoomLoading(true);
    try {
      const data = await store.getEntrepriseDetail(entrepriseId);
      setZoomData(data);
    } catch (e) {
      showToast(e.message || "Erreur lors du chargement du détail.", "error");
      setZoomId(null);
    }
    setZoomLoading(false);
  };

  const creer = async () => {
    if (!nom.trim()) { showToast("Le nom de l'entreprise est requis.", "error"); return; }
    if (!adminUsername.trim() || !adminPassword) { showToast("Le nom d'utilisateur et le mot de passe du premier admin sont requis.", "error"); return; }
    if (!isStrongPassword(adminPassword)) { showToast(PASSWORD_HELP_TEXT, "error"); return; }
    setSaving(true);
    try {
      const entreprise = await store.createEntreprise({
        nom: nom.trim(), contactNom: contactNom.trim(), contactTelephone: contactTelephone.trim(),
        contactEmail: contactEmail.trim(), dureeMois: Number(dureeMois),
        montant: montant ? Number(montant) : null, notes: notes.trim(),
        createdBy: currentUser?.id, today,
      });
      try {
        await store.createEntrepriseAdmin(entreprise.id, adminUsername.trim(), adminPassword);
      } catch (adminErr) {
        // L'entreprise a été créée mais pas son admin : on prévient
        // clairement plutôt que de laisser une entreprise sans compte utilisable.
        showToast(`Entreprise "${nom.trim()}" créée, mais le compte admin n'a pas pu être créé : ${adminErr.message || adminErr}. Réessaie depuis la fiche de l'entreprise.`, "error", 10000);
        setNom(""); setContactNom(""); setContactTelephone(""); setContactEmail(""); setMontant(""); setNotes(""); setDureeMois(1);
        await reload();
        setSaving(false);
        return;
      }
      showToast(`Entreprise "${nom.trim()}" créée et activée pour ${dureeMois} mois, avec son premier compte admin.`, "success");
      setNom(""); setContactNom(""); setContactTelephone(""); setContactEmail(""); setMontant(""); setNotes(""); setDureeMois(1);
      setAdminUsername(""); setAdminPassword("");
      await reload();
    } catch (err) {
      showToast("Erreur lors de la création : " + (err.message || err), "error");
    }
    setSaving(false);
  };

  const toggleStatut = async (ent) => {
    const nouveauStatut = ent.statut === "actif" ? "inactif" : "actif";
    try {
      await store.setEntrepriseStatut(ent.id, nouveauStatut);
      showToast(`${ent.nom} : accès ${nouveauStatut === "actif" ? "activé" : "désactivé"}.`, "success");
      await reload();
    } catch (err) {
      showToast("Erreur : " + (err.message || err), "error");
    }
  };

  const renouveler = async (ent, dureeChoisie) => {
    try {
      await store.renewEntreprise(ent.id, Number(dureeChoisie), today);
      showToast(`${ent.nom} : abonnement renouvelé de ${dureeChoisie} mois.`, "success");
      await reload();
    } catch (err) {
      showToast("Erreur : " + (err.message || err), "error");
    }
  };

  const supprimer = async (ent) => {
    const ok = window.confirm(`Supprimer définitivement "${ent.nom}" de la liste des entreprises ?\n\nCette action est irréversible.`);
    if (!ok) return;
    try {
      await store.deleteEntreprise(ent.id);
      showToast(`${ent.nom} supprimée.`, "success");
      await reload();
    } catch (err) {
      showToast("Erreur : " + (err.message || err), "error");
    }
  };

  if (entreprises === null) return <EmptyState text="Chargement…" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#8A93A3", fontSize: 12.5 }}>
        <Eye size={14} /> Visible uniquement par toi (super-admin) — les entreprises désactivées perdent l'accès à l'application, leurs données restent intactes.
      </div>

      <Card title="Ajouter une entreprise">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Label>Nom de l'entreprise</Label>
              <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Boutique Alpha" />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Durée de l'abonnement</Label>
              <Select value={dureeMois} onChange={(e) => setDureeMois(e.target.value)}>
                {DUREES_ABONNEMENT.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Label>Montant (optionnel)</Label>
              <TextInput type="number" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Ex : 25000" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <Label>Nom du contact</Label>
              <TextInput value={contactNom} onChange={(e) => setContactNom(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <Label>Téléphone</Label>
              <TextInput value={contactTelephone} onChange={(e) => setContactTelephone(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <Label>E-mail</Label>
              <TextInput type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes (optionnel)</Label>
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ paddingTop: 10, borderTop: "1px solid #F0F1F4" }}>
            <div style={{ fontSize: 12, color: "#8A93A3", fontStyle: "italic", marginBottom: 10 }}>
              Premier compte administrateur de cette entreprise (obligatoire) :
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <Label>Nom d'utilisateur</Label>
                <TextInput value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Ex : admin-alpha" />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <Label>Mot de passe (8 caractères minimum, avec lettres et chiffres)</Label>
                <TextInput type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <Button onClick={creer} disabled={saving}>
              <Plus size={15} /> Créer l'entreprise
            </Button>
          </div>
        </div>
      </Card>

      <Card title={`Entreprises (${entreprises.length})`}>
        {entreprises.length === 0 ? (
          <EmptyState text="Aucune entreprise enregistrée pour l'instant." />
        ) : (
          <Table
            headers={["Entreprise", "Statut", "Fin d'abonnement", "Jours restants", "Montant", "Contact", "Actions"]}
            rows={entreprises.map((ent) => {
              const jours = joursRestants(ent.dateFin, today);
              const expireBientot = jours !== null && jours >= 0 && jours <= 7;
              return [
                <div key="n">
                  <div style={{ fontWeight: 700 }}>{ent.nom}</div>
                  {ent.notes && <div style={{ fontSize: 11.5, color: "#8A93A3", marginTop: 2 }}>{ent.notes}</div>}
                </div>,
                <Badge key="s" ok={ent.statut === "actif"} okText="Actif" warnText="Inactif" />,
                ent.dateFin ? fmtDateFr(ent.dateFin) : "Illimité",
                jours === null ? "—" : (
                  <span style={{ fontWeight: 700, color: jours < 0 ? "#C1554A" : expireBientot ? "#D9A441" : "#3F8361" }}>
                    {jours < 0 ? `Expiré depuis ${Math.abs(jours)} j` : `${jours} j`}
                  </span>
                ),
                ent.montant != null ? fmtMoney(ent.montant) : "—",
                <div key="c" style={{ fontSize: 12.5 }}>
                  {ent.contactNom && <div>{ent.contactNom}</div>}
                  {ent.contactTelephone && <div style={{ color: "#8A93A3" }}>{ent.contactTelephone}</div>}
                  {!ent.contactNom && !ent.contactTelephone && "—"}
                </div>,
                <div key="a" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
                  <Toggle on={ent.statut === "actif"} onChange={() => toggleStatut(ent)} label={ent.statut === "actif" ? "Actif" : "Inactif"} />
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Select
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) { renouveler(ent, e.target.value); e.target.value = ""; } }}
                    >
                      <option value="">Renouveler…</option>
                      {DUREES_ABONNEMENT.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </Select>
                    <button onClick={() => supprimer(ent)} style={iconBtnStyle} title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <Button onClick={() => voirDetail(ent.id)} style={{ padding: "5px 10px", fontSize: 12 }}>
                    <Eye size={13} /> Voir les données
                  </Button>
                </div>,
              ];
            })}
          />
        )}
      </Card>

      {zoomId && (
        <Card title={zoomLoading ? "Chargement…" : `Données de ${zoomData?.entreprise?.nom || ""}`}>
          <button onClick={() => { setZoomId(null); setZoomData(null); }} style={{ ...iconBtnStyle, float: "right" }} title="Fermer">
            <X size={16} />
          </button>
          {zoomLoading ? (
            <div style={{ fontSize: 13, color: "#8A93A3" }}>Chargement…</div>
          ) : zoomData ? (
            <div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                <StatCard label="VENDEURS" value={zoomData.vendors.length} />
                <StatCard label="PRODUITS" value={zoomData.products.length} />
                <StatCard label="STOCK TOTAL" value={zoomData.products.reduce((s, p) => s + (Number(p.stock) || 0), 0)} />
                <StatCard label="CA (30 DERNIERS JOURS ACTIFS)" value={fmtMoney(zoomData.caTrenteJours)} accent="#3F8361" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A", marginBottom: 8 }}>Comptes admin/gestionnaire</div>
                  {zoomData.admins.length === 0 ? (
                    <EmptyState text="Aucun compte." />
                  ) : (
                    <Table
                      headers={["Utilisateur", "Rôle", "En ligne"]}
                      rows={zoomData.admins.map((a) => [
                        a.username + (a.is_primary ? " (principal)" : ""),
                        a.role === "admin" ? "Admin" : "Gestionnaire",
                        a.is_online ? "🟢" : "⚪",
                      ])}
                    />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A", marginBottom: 8 }}>Vendeurs ({zoomData.vendors.length})</div>
                  {zoomData.vendors.length === 0 ? (
                    <EmptyState text="Aucun vendeur." />
                  ) : (
                    <Table
                      headers={["Nom", "Contrat"]}
                      rows={zoomData.vendors.map((v) => [`${v.nom} ${v.prenom || ""}`, v.contract_statut || "actif"])}
                    />
                  )}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2A4A", marginBottom: 8 }}>Produits ({zoomData.products.length})</div>
                {zoomData.products.length === 0 ? (
                  <EmptyState text="Aucun produit." />
                ) : (
                  <Table
                    headers={["Produit", "Stock", "Prix"]}
                    rows={zoomData.products.map((p) => [p.nom, p.stock, fmtMoney(p.prix)])}
                  />
                )}
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
