"use client";
import { useState, useEffect, useRef } from "react";

// ── API ───────────────────────────────────────────────────────────────────────
const API = typeof window !== "undefined" ? window.location.origin : "";

async function loadFromStorage() {
  try {
    const r = await fetch(`${API}/api/shopify-apps`);
    const d = await r.json();
    return d;
  } catch { return { apps: [], storeName: "" }; }
}

async function saveToStorage(apps, storeName, settings) {
  try {
    await fetch(`${API}/api/shopify-apps`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps, storeName, ...(settings || {}) }),
    });
  } catch {}
}

// ── AI Description Generator ──────────────────────────────────────────────────
async function fetchAppDescription(url, name) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 120,
        messages: [{ role: "user", content: `What does the Shopify app "${name}" (at "${url}") do? Write ONE sentence max 100 characters for a Shopify store manager. Be specific. Return ONLY the sentence.` }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  "Sales Channel", "Email & SMS", "Reviews", "SEO",
  "Inventory", "Shipping", "Loyalty & Rewards", "Analytics",
  "Customer Support", "Store Design", "Upsell & Cross-sell",
  "Automation", "Other"
];
const DEFAULT_STATUSES = ["Active", "Inactive", "Cancelled", "Trial", "Pending"];

// Sunbeams brand palette-inspired category colors
const CAT_COLORS = {
  "Sales Channel":       { color: "#CB0033", bg: "#fff0f3" },
  "Email & SMS":         { color: "#0284c7", bg: "#e0f2fe" },
  "Reviews":             { color: "#d97706", bg: "#fef3c7" },
  "SEO":                 { color: "#059669", bg: "#d1fae5" },
  "Inventory":           { color: "#7c3aed", bg: "#ede9fe" },
  "Shipping":            { color: "#0891b2", bg: "#cffafe" },
  "Loyalty & Rewards":   { color: "#db2777", bg: "#fce7f3" },
  "Analytics":           { color: "#A47860", bg: "#fdf5f2" },
  "Customer Support":    { color: "#2563eb", bg: "#dbeafe" },
  "Store Design":        { color: "#CB0033", bg: "#fff0f3" },
  "Upsell & Cross-sell": { color: "#b45309", bg: "#fef3c7" },
  "Automation":          { color: "#4f46e5", bg: "#eef2ff" },
  "Other":               { color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_COLORS = {
  "Active":    { color: "#059669", bg: "#d1fae5" },
  "Inactive":  { color: "#6b7280", bg: "#f3f4f6" },
  "Cancelled": { color: "#dc2626", bg: "#fee2e2" },
  "Trial":     { color: "#d97706", bg: "#fef3c7" },
  "Pending":   { color: "#0284c7", bg: "#e0f2fe" },
};

const catColor  = l => CAT_COLORS[l]    || { color: "#6b7280", bg: "#f3f4f6" };
const statColor = s => STATUS_COLORS[s] || { color: "#6b7280", bg: "#f3f4f6" };
const makeId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const EMPTY_FORM = {
  name: "", url: "", description: "",
  categories: ["Other"],
  customCategory: "",
  billing: "monthly", amount: "", currency: "USD",
  status: "Active",
  customStatus: "",
  endDate: "",
  isTrial: false,
  trialEndDate: "",
  developer: "",
  notes: ""
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ShopifyAppsTracker() {
  const [apps, setApps]                   = useState([]);
  const [storeName, setStoreName]         = useState("My Store");
  const [editingName, setEditingName]     = useState(false);
  const [adding, setAdding]               = useState(false);
  const [inlineEditId, setInlineEditId]   = useState(null);
  const [isAuthed, setIsAuthed]           = useState(false);
  const [showPwModal, setShowPwModal]     = useState(false);
  const [pwInput, setPwInput]             = useState("");
  const [pwError, setPwError]             = useState(false);
  const [pwAction, setPwAction]           = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [editPassword]                    = useState("sl2026");
  const [editId, setEditId]               = useState(null);
  const [syncStatus, setSyncStatus]       = useState("");
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [filterCat, setFilterCat]         = useState("all");
  const [filterStatus, setFilterStatus]   = useState("all");
  const [groupBy, setGroupBy]             = useState("none");
  const [searchQ, setSearchQ]             = useState("");
  const [groupOrder, setGroupOrder]       = useState([]);
  const [fetchingDesc, setFetchingDesc]   = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");
  const [customStatInput, setCustomStatInput] = useState("");
  const urlTimer  = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadFromStorage().then(d => {
      if (d.apps) setApps(d.apps);
      if (d.storeName) setStoreName(d.storeName);
      if (d.filterCat) setFilterCat(d.filterCat);
      if (d.filterStatus) setFilterStatus(d.filterStatus);
      if (d.groupBy) setGroupBy(d.groupBy);
      if (d.searchQ) setSearchQ(d.searchQ);
      if (d.groupOrder) setGroupOrder(d.groupOrder);
    });
  }, []);

  const save = (updated, name) => {
    setApps(updated);
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveToStorage(updated, name !== undefined ? name : storeName, { filterCat, filterStatus, groupBy, searchQ, groupOrder });
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 2000);
    }, 600);
  };

  const saveName = (name) => {
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveToStorage(apps, name, { filterCat, filterStatus, groupBy, searchQ, groupOrder });
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 2000);
    }, 600);
  };

  const saveSettings = (overrides) => {
    const settings = {
      filterCat: overrides.filterCat !== undefined ? overrides.filterCat : filterCat,
      filterStatus: overrides.filterStatus !== undefined ? overrides.filterStatus : filterStatus,
      groupBy: overrides.groupBy !== undefined ? overrides.groupBy : groupBy,
      searchQ: overrides.searchQ !== undefined ? overrides.searchQ : searchQ,
      groupOrder: overrides.groupOrder !== undefined ? overrides.groupOrder : groupOrder,
    };
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveToStorage(apps, storeName, settings);
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus(""), 2000);
    }, 600);
  };

  const moveGroup = (label, dir) => {
    const order = [...groupOrder];
    const idx = order.indexOf(label);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    setGroupOrder(order);
    saveSettings({ groupOrder: order });
  };

  // Auth gate
  const requireAuth = (action, payload) => {
    if (isAuthed) {
      if (action === "add") setAdding(true);
      if (action === "edit") startEditDirect(payload);
      if (action === "delete") deleteApp(payload);
      return;
    }
    setPwAction(action);
    setPendingAction(payload);
    setPwInput("");
    setPwError(false);
    setShowPwModal(true);
  };

  const submitPassword = () => {
    if (pwInput === editPassword) {
      setIsAuthed(true);
      setShowPwModal(false);
      setPwInput("");
      setPwError(false);
      setTimeout(() => {
        if (pwAction === "add") setAdding(true);
        if (pwAction === "edit" && pendingAction) startEditDirect(pendingAction);
        if (pwAction === "delete" && pendingAction) {
          if (confirm("Delete this app?")) deleteApp(pendingAction);
        }
      }, 50);
    } else {
      setPwError(true);
      setPwInput("");
    }
  };

  const handleUrl = (url) => {
    setForm(f => ({ ...f, url }));
    if (urlTimer.current) clearTimeout(urlTimer.current);
    if (url.length > 8) {
      urlTimer.current = setTimeout(async () => {
        setFetchingDesc(true);
        const name = form.name || url.replace(/https?:\/\/(www\.)?/, "").split(".")[0];
        const p = await fetchAppDescription(url, name);
        if (p) setForm(f => ({ ...f, description: p }));
        setFetchingDesc(false);
      }, 900);
    }
  };

  const toggleCategory = (cat) => {
    setForm(f => {
      const cats = f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat];
      return { ...f, categories: cats.length ? cats : ["Other"] };
    });
  };

  const addCustomCategory = () => {
    const val = customCatInput.trim();
    if (!val) return;
    setForm(f => ({ ...f, categories: [...f.categories.filter(c => c !== val), val] }));
    setCustomCatInput("");
  };

  const addCustomStatus = () => {
    const val = customStatInput.trim();
    if (!val) return;
    setForm(f => ({ ...f, status: val }));
    setCustomStatInput("");
  };

  const resetForm = () => { setForm(EMPTY_FORM); setAdding(false); setEditId(null); setCustomCatInput(""); setCustomStatInput(""); };

  const saveApp = () => {
    if (!form.name.trim()) return;
    const app = { ...form };
    const customCat = (form.customCategory || "").trim();
    if (customCat) app.categories = [...new Set([...(form.categories || []), customCat])];
    const customStat = (form.customStatus || "").trim();
    if (customStat) app.status = customStat;
    delete app.customCategory;
    delete app.customStatus;
    if (!Array.isArray(app.categories)) app.categories = ["Other"];
    const updated = editId
      ? apps.map(t => t.id === editId ? { ...t, ...app } : t)
      : [...apps, { id: makeId(), ...app, addedAt: new Date().toISOString() }];
    save(updated);
    resetForm();
  };

  const deleteApp = (id) => save(apps.filter(t => t.id !== id));

  const moveApp = (id, dir) => {
    const idx = apps.findIndex(t => t.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= apps.length) return;
    const updated = [...apps];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    save(updated);
  };

  const startEditDirect = (t) => {
    setForm({
      name: t.name, url: t.url || "", description: t.description || "",
      categories: t.categories || ["Other"],
      customCategory: "",
      billing: t.billing, amount: t.amount, currency: t.currency || "USD",
      status: t.status || "Active",
      customStatus: "",
      endDate: t.endDate || "",
      isTrial: t.isTrial || false,
      trialEndDate: t.trialEndDate || "",
      developer: t.developer || "",
      notes: t.notes || ""
    });
    setEditId(t.id);
    setInlineEditId(t.id);
    setAdding(false);
  };

  // Cost helpers — USD base, PHP display
  const RATES = { PHP: 1 / 56, USD: 1, EUR: 1.09, GBP: 1.27 };
  const toUSD = (amount, currency) => (parseFloat(amount) || 0) * (RATES[currency] || 1);
  const toMonthlyUSD = t => { const a = toUSD(t.amount, t.currency); return t.billing === "annual" ? a / 12 : t.billing === "monthly" ? a : 0; };
  const toAnnualUSD  = t => { const a = toUSD(t.amount, t.currency); return t.billing === "monthly" ? a * 12 : t.billing === "annual" ? a : 0; };
  const totalMonthly = apps.filter(a => a.status === "Active" || a.status === "Trial").reduce((s, t) => s + toMonthlyUSD(t), 0);
  const totalAnnual  = apps.filter(a => a.status === "Active" || a.status === "Trial").reduce((s, t) => s + toAnnualUSD(t), 0);
  const fmtUSD = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtAmt = (amount, currency) => {
    const sym = currency === "USD" ? "$" : currency === "PHP" ? "₱" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency + " ";
    return sym + (parseFloat(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const byCat = {};
  apps.filter(a => a.status === "Active" || a.status === "Trial").forEach(t => {
    const cats = t.categories || ["Other"];
    cats.forEach(cat => {
      if (!byCat[cat]) byCat[cat] = { monthly: 0, count: 0 };
      byCat[cat].monthly += toMonthlyUSD(t) / cats.length;
      byCat[cat].count++;
    });
  });

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp  = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "9px 12px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none", color: "#0f172a", background: "#f8fafc" };
  const lbl  = { fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", display: "block", marginBottom: 6 };
  const btnP = { padding: "10px 22px", background: "linear-gradient(135deg,#CB0033,#A47860)", color: "#fff", border: "none", borderRadius: 7, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const btnS = { padding: "9px 16px", background: "none", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: 7, fontFamily: "'DM Sans',sans-serif", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#F4F0EC", minHeight: "100vh", color: "#0f172a", fontSize: 14 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media (max-width: 600px) {
          .app-card { flex-wrap: wrap; }
          .app-cost { width: 100%; text-align: left !important; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#CB0033 0%,#8a0022 60%,#A47860 100%)", padding: "28px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", bottom: -30, left: 60, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        {/* Shopify-bag icon SVG watermark */}
        <div style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", opacity: 0.1, fontSize: 80, lineHeight: 1 }}>🛍</div>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
            {storeName} · Shopify Apps
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            {editingName ? (
              <input value={storeName} autoFocus onChange={e => setStoreName(e.target.value)}
                onBlur={() => { setEditingName(false); saveName(storeName); }}
                onKeyDown={e => { if (e.key === "Enter") { setEditingName(false); saveName(storeName); } }}
                style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 6, padding: "2px 10px", outline: "none", minWidth: 200 }} />
            ) : (
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 700, color: "#fff" }}>
                {storeName} <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 400 }}>Apps Tracker</span>
              </div>
            )}
            <button onClick={() => setEditingName(true)} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 4, padding: "3px 10px", color: "#fff", fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>✏ Edit</button>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 22 }}>All installed Shopify apps & plugins — costs tracked in one place</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, maxWidth: 500 }}>
            {[
              { label: "Installed Apps", value: apps.length },
              { label: "Monthly Cost (Active)", value: fmtUSD(totalMonthly) },
              { label: "Annual Cost (Active)", value: fmtUSD(totalAnnual) }
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, padding: "10px 16px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Sora',sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {syncStatus && <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em" }}>{syncStatus === "saving" ? "Syncing…" : "✓ Saved"}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 14px 80px" }}>

        {/* Add button */}
        {!adding && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
            <button style={{ ...btnP, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(203,0,51,0.3)" }} onClick={() => {
              if (isAuthed) { setAdding(true); return; }
              setPwAction("add"); setPendingAction(null); setPwInput(""); setPwError(false); setShowPwModal(true);
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Shopify App
            </button>
          </div>
        )}

        {/* FORM */}
        {adding && (
          <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 22, boxShadow: "0 4px 24px rgba(15,23,42,0.08)" }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 20, color: "#CB0033" }}>
              {editId ? `✏ Editing: ${form.name}` : "Add New Shopify App"}
            </div>

            {/* Name + URL + Developer */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>App Name *</label>
                <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Klaviyo, Judge.me" />
              </div>
              <div>
                <label style={lbl}>App Store URL</label>
                <div style={{ position: "relative" }}>
                  <input style={inp} value={form.url} onChange={e => handleUrl(e.target.value)} placeholder="https://apps.shopify.com/…" />
                  {fetchingDesc && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#CB0033" }}>Fetching…</span>}
                </div>
              </div>
              <div>
                <label style={lbl}>Developer</label>
                <input style={inp} value={form.developer} onChange={e => setForm(f => ({ ...f, developer: e.target.value }))} placeholder="e.g. Shopify, Klaviyo Inc." />
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Description <span style={{ color: "#94a3b8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— auto-generated from URL</span></label>
              <textarea style={{ ...inp, resize: "vertical", background: form.description ? "#f0fdf4" : "#f8fafc" }} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this app do?" />
            </div>

            {/* Categories */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Category <span style={{ color: "#94a3b8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— select multiple</span></label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                {DEFAULT_CATS.map(cat => {
                  const sel = form.categories.includes(cat);
                  const ci = catColor(cat);
                  return (
                    <button key={cat} onClick={() => toggleCategory(cat)}
                      style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${sel ? ci.color : "#e2e8f0"}`, background: sel ? ci.bg : "#f8fafc", color: sel ? ci.color : "#64748b", fontSize: 12, fontWeight: sel ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}>
                      {sel ? "✓ " : ""}{cat}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inp, flex: 1 }} value={customCatInput} onChange={e => setCustomCatInput(e.target.value)}
                  placeholder="Add custom category…" onKeyDown={e => e.key === "Enter" && addCustomCategory()} />
                <button onClick={addCustomCategory} style={{ ...btnS, whiteSpace: "nowrap" }}>+ Add</button>
              </div>
              {form.categories.filter(c => !DEFAULT_CATS.includes(c)).map(c => (
                <span key={c} style={{ display: "inline-block", marginTop: 6, marginRight: 6, padding: "3px 10px", background: "#fff0f3", color: "#CB0033", border: "1px solid #CB003344", borderRadius: 20, fontSize: 12 }}>
                  {c} <button onClick={() => toggleCategory(c)} style={{ border: "none", background: "none", color: "#CB0033", cursor: "pointer", fontSize: 11, padding: 0, marginLeft: 4 }}>✕</button>
                </span>
              ))}
            </div>

            {/* Status */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Status</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                {DEFAULT_STATUSES.map(s => {
                  const sel = form.status === s;
                  const sc = statColor(s);
                  return (
                    <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                      style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${sel ? sc.color : "#e2e8f0"}`, background: sel ? sc.bg : "#f8fafc", color: sel ? sc.color : "#64748b", fontSize: 12, fontWeight: sel ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}>
                      {sel ? "✓ " : ""}{s}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inp, flex: 1 }} value={customStatInput} onChange={e => setCustomStatInput(e.target.value)}
                  placeholder="Add custom status…" onKeyDown={e => e.key === "Enter" && addCustomStatus()} />
                <button onClick={addCustomStatus} style={{ ...btnS, whiteSpace: "nowrap" }}>+ Add</button>
              </div>
            </div>

            {/* Billing + Amount + Currency + End Date */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Billing Cycle</label>
                <select style={inp} value={form.billing} onChange={e => setForm(f => ({ ...f, billing: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (yearly)</option>
                  <option value="usage">Usage-based</option>
                  <option value="free">Free</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Subscription Ends</label>
                <input type="date" style={inp} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Currency</label>
                <select style={inp} value={form.currency} onChange={e => {
                  const newCur = e.target.value;
                  const rates = { PHP: 1 / 56, USD: 1, EUR: 1.09, GBP: 1.27 };
                  const amt = parseFloat(form.amount) || 0;
                  if (amt > 0 && form.currency !== newCur) {
                    const inUSD = amt * (rates[form.currency] || 1);
                    const converted = (inUSD / (rates[newCur] || 1)).toFixed(2);
                    setForm(f => ({ ...f, currency: newCur, amount: converted }));
                  } else {
                    setForm(f => ({ ...f, currency: newCur }));
                  }
                }}>
                  {["USD", "PHP", "EUR", "GBP"].map(cur => <option key={cur}>{cur}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Amount</label>
                <input type="number" style={inp} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            {/* Trial toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, padding: "10px 14px", background: form.isTrial ? "#fff4e6" : "#f8fafc", border: `1.5px solid ${form.isTrial ? "#d97706" : "#e2e8f0"}`, borderRadius: 8, transition: "all 0.18s" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                <input type="checkbox" checked={form.isTrial} onChange={e => setForm(f => ({ ...f, isTrial: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "#d97706", cursor: "pointer" }} />
                <span style={{ fontSize: 13, fontWeight: form.isTrial ? 600 : 400, color: form.isTrial ? "#d97706" : "#64748b" }}>Currently on free trial</span>
              </label>
              {form.isTrial && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#d97706", letterSpacing: "0.08em", textTransform: "uppercase" }}>Trial ends:</span>
                  <input type="date" style={{ ...inp, width: 160, padding: "6px 10px" }} value={form.trialEndDate} onChange={e => setForm(f => ({ ...f, trialEndDate: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Notes</label>
              <input style={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Plan name, account email, login details…" />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnP} onClick={saveApp}>{editId ? "Save Changes" : "Add App"}</button>
              <button style={btnS} onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* FILTER / GROUP TOOLBAR */}
        {apps.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 14px" }}>
            <input value={searchQ} onChange={e => { setSearchQ(e.target.value); saveSettings({ searchQ: e.target.value }); }} placeholder="Search apps…"
              style={{ flex: 1, minWidth: 140, border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, outline: "none", background: "#f8fafc", color: "#0f172a" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>Category:</span>
              <select value={filterCat} onChange={e => { setFilterCat(e.target.value); saveSettings({ filterCat: e.target.value }); }}
                style={{ border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, outline: "none", background: "#f8fafc", color: "#0f172a" }}>
                <option value="all">All</option>
                {[...new Set([...DEFAULT_CATS, ...apps.flatMap(t => t.categories || ["Other"])])].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>Status:</span>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); saveSettings({ filterStatus: e.target.value }); }}
                style={{ border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, outline: "none", background: "#f8fafc", color: "#0f172a" }}>
                <option value="all">All</option>
                {[...new Set([...DEFAULT_STATUSES, ...apps.map(t => t.status || "Active")])].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>Group:</span>
              <select value={groupBy} onChange={e => { setGroupBy(e.target.value); saveSettings({ groupBy: e.target.value }); }}
                style={{ border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, outline: "none", background: "#f8fafc", color: "#0f172a" }}>
                <option value="none">None</option>
                <option value="category">By Category</option>
                <option value="status">By Status</option>
                <option value="billing">By Billing</option>
              </select>
            </div>

            {(filterCat !== "all" || filterStatus !== "all" || groupBy !== "none" || searchQ) && (
              <button onClick={() => { setFilterCat("all"); setFilterStatus("all"); setGroupBy("none"); setSearchQ(""); setGroupOrder([]); saveSettings({ filterCat: "all", filterStatus: "all", groupBy: "none", searchQ: "", groupOrder: [] }); }}
                style={{ fontSize: 11, color: "#CB0033", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", textDecoration: "underline" }}>Clear</button>
            )}
          </div>
        )}

        {/* APPS LIST */}
        {apps.length === 0 && !adding ? (
          <div style={{ textAlign: "center", padding: "70px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🛍️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>No apps added yet</div>
            <div style={{ fontSize: 13 }}>Click "Add Shopify App" to start tracking your installed apps</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {(() => {
                let filtered = apps.filter(t => {
                  const cats = t.categories || ["Other"];
                  const matchCat = filterCat === "all" || cats.includes(filterCat);
                  const matchStatus = filterStatus === "all" || (t.status || "Active") === filterStatus;
                  const matchSearch = !searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase()) || (t.description || "").toLowerCase().includes(searchQ.toLowerCase()) || (t.developer || "").toLowerCase().includes(searchQ.toLowerCase());
                  return matchCat && matchStatus && matchSearch;
                });

                let groups = [];
                if (groupBy === "none") {
                  groups = [{ label: null, items: filtered }];
                } else if (groupBy === "category") {
                  const map = {};
                  filtered.forEach(t => {
                    const cats = t.categories || ["Other"];
                    cats.forEach(cat => {
                      if (!map[cat]) map[cat] = [];
                      map[cat].push(t);
                    });
                  });
                  const labels = groupOrder.length
                    ? [...groupOrder.filter(l => map[l]), ...Object.keys(map).filter(l => !groupOrder.includes(l))]
                    : Object.keys(map).sort();
                  groups = labels.map(l => ({ label: l, items: map[l] }));
                } else if (groupBy === "status") {
                  const map = {};
                  filtered.forEach(t => {
                    const s = t.status || "Active";
                    if (!map[s]) map[s] = [];
                    map[s].push(t);
                  });
                  groups = Object.keys(map).map(l => ({ label: l, items: map[l] }));
                } else if (groupBy === "billing") {
                  const map = {};
                  filtered.forEach(t => {
                    const b = t.billing || "monthly";
                    if (!map[b]) map[b] = [];
                    map[b].push(t);
                  });
                  groups = Object.keys(map).map(l => ({ label: l, items: map[l] }));
                }

                return groups.map(({ label, items }, gi) => (
                  <div key={label || "all"}>
                    {label && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, marginTop: gi > 0 ? 12 : 0 }}>
                        {groupBy === "category" && (() => { const ci = catColor(label); return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 4, background: ci.bg, color: ci.color }}>{label}</span>; })()}
                        {groupBy === "status" && (() => { const sc = statColor(label); return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 4, background: sc.bg, color: sc.color }}>{label}</span>; })()}
                        {groupBy === "billing" && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 4, background: "#f1f5f9", color: "#475569" }}>{label}</span>}
                        {groupBy === "category" && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => moveGroup(label, -1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14, padding: "0 4px" }}>↑</button>
                            <button onClick={() => moveGroup(label, 1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14, padding: "0 4px" }}>↓</button>
                          </div>
                        )}
                        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{items.length} app{items.length !== 1 ? "s" : ""}</span>
                      </div>
                    )}

                    {items.map((t, idx) => {
                      const cats = t.categories || ["Other"];
                      const primaryCat = cats[0];
                      const ci = catColor(primaryCat);
                      const sc = statColor(t.status || "Active");
                      const monthlyUSD = toMonthlyUSD(t);
                      const isEditing = inlineEditId === t.id;
                      const billingLabel = t.billing === "annual" ? "/yr" : t.billing === "monthly" ? "/mo" : t.billing === "usage" ? " usage" : "";

                      return (
                        <div key={t.id} className="app-card"
                          style={{ background: "#fff", border: `1.5px solid ${isEditing ? "#CB0033" : "#e2e8f0"}`, borderRadius: 10, padding: "14px 16px", transition: "border-color 0.15s", boxShadow: isEditing ? "0 0 0 3px #CB003318" : "none" }}>

                          {!isEditing ? (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                              {/* Left: color bar */}
                              <div style={{ width: 4, minHeight: 52, borderRadius: 2, background: ci.color, flexShrink: 0, marginTop: 2 }} />

                              {/* Center: info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{t.name}</span>
                                  {cats.map(cat => {
                                    const cci = catColor(cat);
                                    return <span key={cat} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 3, background: cci.bg, color: cci.color }}>{cat}</span>;
                                  })}
                                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 3, background: sc.bg, color: sc.color }}>{t.status || "Active"}</span>
                                  {t.isTrial && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 3, background: "#fef3c7", color: "#d97706" }}>TRIAL{t.trialEndDate ? ` · ends ${t.trialEndDate}` : ""}</span>}
                                </div>
                                {t.developer && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>by {t.developer}</div>}
                                {t.description && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, lineHeight: 1.5 }}>{t.description}</div>}
                                {t.notes && <div style={{ fontSize: 11, color: "#A47860", fontStyle: "italic" }}>📝 {t.notes}</div>}
                                {t.endDate && <div style={{ fontSize: 11, color: "#CB0033", marginTop: 2 }}>⚠ Expires {t.endDate}</div>}
                              </div>

                              {/* Right: cost + actions */}
                              <div className="app-cost" style={{ textAlign: "right", flexShrink: 0, minWidth: 100 }}>
                                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 700, color: t.billing === "free" ? "#059669" : "#CB0033", marginBottom: 2 }}>
                                  {t.billing === "free" ? "Free" : t.amount ? fmtAmt(t.amount, t.currency || "USD") + billingLabel : "—"}
                                </div>
                                {t.billing !== "free" && monthlyUSD > 0 && t.billing === "annual" && (
                                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmtUSD(monthlyUSD)}/mo equiv.</div>
                                )}
                                <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
                                  <button onClick={() => moveApp(t.id, -1)} style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#64748b" }}>↑</button>
                                  <button onClick={() => moveApp(t.id, 1)} style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#64748b" }}>↓</button>
                                  <button onClick={() => requireAuth("edit", t)} style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: "#475569" }}>Edit</button>
                                  <button onClick={() => requireAuth("delete", t.id)} style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: "#dc2626" }}>✕</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* INLINE EDIT */
                            <div>
                              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#CB0033" }}>✏ Editing: {t.name}</div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 14 }}>
                                <div><label style={lbl}>App Name</label><input style={inp} defaultValue={t.name || ""} id={`edit-name-${t.id}`} /></div>
                                <div><label style={lbl}>URL</label><input style={inp} defaultValue={t.url || ""} id={`edit-url-${t.id}`} /></div>
                                <div><label style={lbl}>Developer</label><input style={inp} defaultValue={t.developer || ""} id={`edit-developer-${t.id}`} /></div>
                              </div>

                              <div style={{ marginBottom: 14 }}>
                                <label style={lbl}>Description</label>
                                <textarea style={{ ...inp, resize: "vertical" }} rows={2} defaultValue={t.description || ""} id={`edit-description-${t.id}`} />
                              </div>

                              {/* Categories */}
                              <div style={{ marginBottom: 14 }}>
                                <label style={lbl}>Categories</label>
                                <div id={`cat-container-${t.id}`} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                                  {[...new Set([...DEFAULT_CATS, ...(t.categories || [])])].map(cat => {
                                    const isSel = (t.categories || ["Other"]).includes(cat);
                                    const cci = catColor(cat);
                                    return (
                                      <button key={cat} data-cat={cat} data-sel={isSel ? "1" : "0"}
                                        onClick={e => { const btn = e.currentTarget; const nowSel = btn.getAttribute("data-sel") === "1"; btn.setAttribute("data-sel", nowSel ? "0" : "1"); btn.style.background = nowSel ? "#f8fafc" : cci.bg; btn.style.color = nowSel ? "#64748b" : cci.color; btn.style.borderColor = nowSel ? "#e2e8f0" : cci.color; btn.style.fontWeight = nowSel ? "400" : "600"; btn.textContent = (nowSel ? "" : "✓ ") + cat; }}
                                        style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${isSel ? cci.color : "#e2e8f0"}`, background: isSel ? cci.bg : "#f8fafc", color: isSel ? cci.color : "#64748b", fontSize: 12, fontWeight: isSel ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                                        {isSel ? "✓ " : ""}{cat}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Status */}
                              <div style={{ marginBottom: 14 }}>
                                <label style={lbl}>Status</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                                  {DEFAULT_STATUSES.map(s => {
                                    const isSel = (t.status || "Active") === s;
                                    const sc2 = statColor(s);
                                    return (
                                      <button key={s} className={`stat-btn-${t.id}`} data-status={s} data-sel={isSel ? "1" : "0"}
                                        onClick={e => {
                                          document.querySelectorAll(`.stat-btn-${t.id}`).forEach(b => { const bs = statColor(b.getAttribute("data-status")); b.setAttribute("data-sel", "0"); b.style.background = "#f8fafc"; b.style.color = "#64748b"; b.style.borderColor = "#e2e8f0"; b.style.fontWeight = "400"; b.textContent = b.getAttribute("data-status"); });
                                          e.currentTarget.setAttribute("data-sel", "1"); e.currentTarget.style.background = sc2.bg; e.currentTarget.style.color = sc2.color; e.currentTarget.style.borderColor = sc2.color; e.currentTarget.style.fontWeight = "600"; e.currentTarget.textContent = "✓ " + s;
                                        }}
                                        style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${isSel ? sc2.color : "#e2e8f0"}`, background: isSel ? sc2.bg : "#f8fafc", color: isSel ? sc2.color : "#64748b", fontSize: 12, fontWeight: isSel ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                                        {isSel ? "✓ " : ""}{s}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Billing */}
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 14 }}>
                                <div>
                                  <label style={lbl}>Billing</label>
                                  <select style={inp} defaultValue={t.billing || "monthly"} id={`edit-billing-${t.id}`}>
                                    <option value="monthly">Monthly</option>
                                    <option value="annual">Annual</option>
                                    <option value="usage">Usage-based</option>
                                    <option value="free">Free</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={lbl}>Subscription Ends</label>
                                  <input type="date" style={inp} defaultValue={t.endDate || ""} id={`edit-enddate-${t.id}`} />
                                </div>
                                <div>
                                  <label style={lbl}>Currency</label>
                                  <select style={inp} defaultValue={t.currency || "USD"} id={`edit-currency-${t.id}`}>
                                    {["USD", "PHP", "EUR", "GBP"].map(cur => <option key={cur}>{cur}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={lbl}>Amount</label>
                                  <input type="number" style={inp} defaultValue={t.amount || ""} id={`edit-amount-${t.id}`} />
                                </div>
                              </div>

                              {/* Trial */}
                              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, padding: "10px 14px", background: t.isTrial ? "#fff4e6" : "#f8fafc", border: `1.5px solid ${t.isTrial ? "#d97706" : "#e2e8f0"}`, borderRadius: 8 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                                  <input type="checkbox" defaultChecked={t.isTrial || false} id={`edit-trial-${t.id}`}
                                    style={{ width: 16, height: 16, accentColor: "#d97706", cursor: "pointer" }}
                                    onChange={e => {
                                      const wrap = e.target.closest("div[style]");
                                      const dw = document.getElementById(`trial-date-wrap-${t.id}`);
                                      if (e.target.checked) { wrap.style.background = "#fff4e6"; wrap.style.borderColor = "#d97706"; if (dw) dw.style.display = "flex"; }
                                      else { wrap.style.background = "#f8fafc"; wrap.style.borderColor = "#e2e8f0"; if (dw) dw.style.display = "none"; }
                                    }} />
                                  <span style={{ fontSize: 13, fontWeight: t.isTrial ? 600 : 400, color: t.isTrial ? "#d97706" : "#64748b" }}>Currently on free trial</span>
                                </label>
                                <div id={`trial-date-wrap-${t.id}`} style={{ display: t.isTrial ? "flex" : "none", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: "#d97706", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ends:</span>
                                  <input type="date" style={{ ...inp, width: 160, padding: "6px 10px" }} defaultValue={t.trialEndDate || ""} id={`edit-trialdate-${t.id}`} />
                                </div>
                              </div>

                              <div style={{ marginBottom: 16 }}>
                                <label style={lbl}>Notes</label>
                                <input style={inp} defaultValue={t.notes || ""} id={`edit-notes-${t.id}`} />
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                <button style={btnP} onClick={() => {
                                  const getId = (field) => document.getElementById(`edit-${field}-${t.id}`)?.value || "";
                                  const name = getId("name");
                                  if (!name.trim()) return;
                                  const catBtns = document.querySelectorAll(`#cat-container-${t.id} button`);
                                  const cats2 = Array.from(catBtns).filter(b => b.getAttribute("data-sel") === "1").map(b => b.getAttribute("data-cat"));
                                  const statBtn = document.querySelector(`.stat-btn-${t.id}[data-sel="1"]`);
                                  const status = statBtn?.getAttribute("data-status") || t.status || "Active";
                                  const isTrial = document.getElementById(`edit-trial-${t.id}`)?.checked || false;
                                  const trialEndDate = document.getElementById(`edit-trialdate-${t.id}`)?.value || "";
                                  const updated = apps.map(x => x.id === t.id ? {
                                    ...x,
                                    name, url: getId("url"),
                                    description: getId("description"),
                                    developer: getId("developer"),
                                    categories: cats2.length ? cats2 : ["Other"],
                                    status,
                                    billing: getId("billing"),
                                    endDate: getId("enddate"),
                                    currency: getId("currency"),
                                    amount: getId("amount"),
                                    isTrial, trialEndDate,
                                    notes: getId("notes"),
                                  } : x);
                                  save(updated);
                                  setInlineEditId(null);
                                  setEditId(null);
                                }}>Save Changes</button>
                                <button style={btnS} onClick={() => { setInlineEditId(null); setEditId(null); }}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>

            {/* COST SUMMARY */}
            <div style={{ background: "linear-gradient(135deg,#CB0033 0%,#8a0022 60%,#A47860 100%)", borderRadius: 12, padding: "24px 28px" }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 18 }}>💰 App Cost Summary (Active only)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                {Object.entries(byCat).sort((a, b) => b[1].monthly - a[1].monthly).map(([cat, { monthly, count }]) => {
                  const pct = totalMonthly > 0 ? (monthly / totalMonthly) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 3, background: "rgba(255,255,255,0.2)", color: "#fff" }}>{cat}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{count} app{count > 1 ? "s" : ""}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'Sora',sans-serif" }}>{fmtUSD(monthly)}/mo</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
                        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.8)", width: `${pct}%`, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 18, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { label: "Total Apps", value: apps.length },
                  { label: "Monthly (Active)", value: fmtUSD(totalMonthly) },
                  { label: "Annual (Active)", value: fmtUSD(totalAnnual) }
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>{s.value}</div>
                    <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* PASSWORD MODAL */}
      {showPwModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowPwModal(false)}>
          <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 32, maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(15,23,42,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>🔒 Editor Access</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              {pwAction === "add" ? "Enter password to add a new app" : pwAction === "edit" ? "Enter password to edit this app" : "Enter password to delete this app"}
            </div>
            <input type="password" autoFocus value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={e => e.key === "Enter" && submitPassword()}
              placeholder="Enter password"
              style={{ width: "100%", border: `1.5px solid ${pwError ? "#CB0033" : "#e2e8f0"}`, borderRadius: 6, padding: "11px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", background: pwError ? "#fff5f5" : "#f8fafc", color: "#0f172a", marginBottom: 8 }} />
            {pwError && <div style={{ fontSize: 12, color: "#CB0033", fontWeight: 500, marginBottom: 12 }}>Incorrect password — try again.</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowPwModal(false)} style={{ padding: "9px 18px", background: "none", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: 7, fontFamily: "'DM Sans',sans-serif", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={submitPassword} style={{ padding: "9px 20px", background: "linear-gradient(135deg,#CB0033,#A47860)", color: "#fff", border: "none", borderRadius: 7, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Unlock</button>
            </div>
            {isAuthed && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                Session active — you won't be asked again until you refresh.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
