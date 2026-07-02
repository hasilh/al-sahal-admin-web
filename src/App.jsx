import React, { useState, useEffect } from 'react';
import {
  signin, getToken, saveToken, removeToken,
  getSalesmen, getAllTrackingStatus, getLatestLocations,
  getVisits, getDeliveries, getNotPaidInvoices, getPaidInvoices,
  approvePayment, getNotifications, markNotificationsRead,
  createSalesman, deleteSalesman, getSalesmanCredentials,
  getSalesLog, getNotPaidSales, approveSalePayment,
  getSalesTarget, setSalesTarget, getSalesmanSummary,
  setTrackingStatus, pingLocation, logVisit, logDelivery,
  requestPayment, logSale, requestSalePayment,
} from './api.js';

const COLORS = ['#8E44AD','#2980B9','#16A085','#D35400','#1A5276','#7D6608'];

// Supabase returns "timestamp without time zone" values with no Z/offset suffix
// (e.g. "2026-07-02T05:00:00"). Browsers then wrongly parse that as *local*
// browser time instead of UTC. Force it to be read as UTC before converting
// to Oman time (UTC+4, no DST) for display.
function asUTC(ts) {
  if (!ts) return null;
  const iso = /[Zz]|[+-]\d\d:\d\d$/.test(ts) ? ts : ts + 'Z';
  return new Date(iso);
}

function formatDate(ts) {
  const d = asUTC(ts);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Asia/Muscat',
  }).format(d).replace(',', ',');
}
function timeAgo(ts) {
  const d = asUTC(ts);
  if (!d) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function initials(name) {
  return (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function pmLabel(pm) {
  if (pm === 'bank') return 'Bank Transfer';
  if (pm === 'not_paid') return 'Not Paid';
  if (!pm) return '—';
  return pm.charAt(0).toUpperCase() + pm.slice(1);
}

const TABS = [
  { key: 'salesmen', label: 'Salesmen' },
  { key: 'visits', label: 'Visits' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'saleslog', label: 'Sales Log' },
  { key: 'notpaid', label: 'Not Paid' },
  { key: 'paid', label: 'Paid' },
];
const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'older', label: 'Older' },
];

// Defined at module scope (not inside a component) so React treats them as
// stable component types across re-renders. Defining these inline inside a
// component body causes React to remount the <input> on every keystroke,
// which drops focus and makes typing feel like only one letter registers.
function FilterBar({ selected, onSelect, filters = FILTERS }) {
  return (
    <div className="filter-row">
      {filters.map(f => (
        <button key={f.key} className={`filter-pill ${selected === f.key ? 'on' : ''}`} onClick={() => onSelect(f.key)}>
          {f.label}
        </button>
      ))}
    </div>
  );
}
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="search-bar">
      <span>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setRole(payload.role);
        setLoggedIn(true);
      } catch { removeToken(); }
    }
    setChecking(false);
  }, []);

  const handleLoginSuccess = (r) => {
    setRole(r);
    setLoggedIn(true);
  };
  const handleLogout = () => {
    removeToken();
    setLoggedIn(false);
    setRole(null);
  };

  if (checking) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!loggedIn) return <Login onSuccess={handleLoginSuccess} />;
  return role === 'admin'
    ? <AdminDashboard onLogout={handleLogout} />
    : <SalesmanView onLogout={handleLogout} />;
}

function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError('Please fill all fields');
    setLoading(true); setError('');
    try {
      const data = await signin(email, password);
      saveToken(data.token);
      onSuccess(data.role);
    } catch (err) {
      setError(err.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo-box"><img src="/icon.png" alt="Al Sahal" className="logo-img" /></div>
        <div className="brand-name">Al Sahal</div>
        <div className="brand-tag">Sales Tracker Portal</div>
        <form onSubmit={handleSignIn}>
          <label className="field-label">Email</label>
          <input className="field-input" type="email" autoCapitalize="none"
            value={email} onChange={e => setEmail(e.target.value)} placeholder="you@alsahal.com" />
          <label className="field-label">Password</label>
          <input className="field-input" type="password"
            value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          {error && <div style={{ color: '#C0392B', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('salesmen');
  const [salesmen, setSalesmen] = useState([]);
  const [trackingStatus, setTrackingStatus] = useState([]);
  const [locations, setLocations] = useState([]);
  const [allVisits, setAllVisits] = useState([]);
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [allSalesLog, setAllSalesLog] = useState([]);
  const [notPaid, setNotPaid] = useState([]);
  const [notPaidSales, setNotPaidSales] = useState([]);
  const [paid, setPaid] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [visitFilter, setVisitFilter] = useState('today');
  const [deliveryFilter, setDeliveryFilter] = useState('today');
  const [salesLogFilter, setSalesLogFilter] = useState('today');
  const [visitSearch, setVisitSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [salesLogSearch, setSalesLogSearch] = useState('');
  const [notPaidSearch, setNotPaidSearch] = useState('');
  const [paidSearch, setPaidSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState('month');

  const [notifModal, setNotifModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [credLoading, setCredLoading] = useState(false);

  const loadAll = async () => {
    try {
      const [sm, ts, locs, np, nps, notifs] = await Promise.all([
        getSalesmen(), getAllTrackingStatus(), getLatestLocations(),
        getNotPaidInvoices(), getNotPaidSales(), getNotifications(),
      ]);
      setSalesmen(sm); setTrackingStatus(ts); setLocations(locs);
      setNotPaid(np); setNotPaidSales(nps); setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (e) {
      if (e.status === 401) { removeToken(); onLogout(); }
    }
  };

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { getVisits(visitFilter).then(setAllVisits).catch(() => {}); }, [visitFilter]);
  useEffect(() => { getDeliveries(deliveryFilter).then(setAllDeliveries).catch(() => {}); }, [deliveryFilter]);
  useEffect(() => { getSalesLog(salesLogFilter).then(setAllSalesLog).catch(() => {}); }, [salesLogFilter]);
  useEffect(() => { getPaidInvoices(paidFilter).then(setPaid).catch(() => {}); }, [paidFilter]);

  const handleOpenNotifs = async () => {
    setNotifModal(true);
    await markNotificationsRead();
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleAddSalesman = async (e) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return alert('All fields are required');
    setAddLoading(true);
    try {
      const res = await createSalesman(newName, newEmail, newPassword);
      if (newTarget && Number(newTarget) > 0) {
        const month = new Date().toISOString().slice(0, 7) + '-01';
        await setSalesTarget(res.user.id, month, Number(newTarget));
      }
      setAddModal(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewTarget('');
      setSalesmen(await getSalesmen());
      setTrackingStatus(await getAllTrackingStatus());
      alert(`Account created for ${newName}`);
    } catch (e) {
      alert(e.data?.error || 'Failed to create account');
    } finally { setAddLoading(false); }
  };

  const handleDeleteSalesman = async (s) => {
    if (!confirm(`Delete ${s.name}? Their visit and delivery records will be kept.`)) return;
    try {
      await deleteSalesman(s.id);
      setSalesmen(await getSalesmen());
      setTrackingStatus(await getAllTrackingStatus());
      setDetailModal(false);
    } catch { alert('Failed to delete salesman'); }
  };

  const handleViewCredentials = async (s) => {
    setCredLoading(true); setCredentials(null);
    try { setCredentials(await getSalesmanCredentials(s.id)); }
    catch { alert('Could not load credentials'); }
    finally { setCredLoading(false); }
  };

  const handleApprove = async (inv) => {
    if (!confirm(`Approve ${inv.invoice_number}?`)) return;
    try {
      if (inv._source === 'sales') {
        await approveSalePayment(inv.id);
        setNotPaidSales(prev => prev.filter(i => i.id !== inv.id));
      } else {
        await approvePayment(inv.id);
        setNotPaid(prev => prev.filter(i => i.id !== inv.id));
      }
      getPaidInvoices(paidFilter).then(setPaid);
      loadAll();
    } catch { alert('Failed to approve'); }
  };

  const openMap = (lat, lng, name) =>
    window.open(`https://www.google.com/maps?q=${lat},${lng}&label=${name}`, '_blank');

  const getTracking = (id) => trackingStatus.find(t => t.user_id === id);
  const getLocation = (id) => locations.find(l => l.user_id === id);

  const searchFilter = (list, term, keys) => {
    if (!term.trim()) return list;
    const t = term.toLowerCase();
    return list.filter(item => keys.some(k => (item[k] || item.users?.name || '').toLowerCase().includes(t)));
  };
  const filteredVisits = searchFilter(allVisits, visitSearch, ['company_name','contact_name','mobile','email_id']);
  const filteredDeliveries = searchFilter(allDeliveries, deliverySearch, ['invoice_number','delivered_person','payment_method']);
  const filteredSalesLog = searchFilter(allSalesLog, salesLogSearch, ['invoice_number','delivered_to','payment_method']);
  const mergedNotPaid = [
    ...notPaid.map(i => ({ ...i, _source: 'delivery', _to: i.delivered_person })),
    ...notPaidSales.map(i => ({ ...i, _source: 'sales', _to: i.delivered_to })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const filteredNotPaid = searchFilter(mergedNotPaid, notPaidSearch, ['invoice_number','_to']);
  const filteredPaid = searchFilter(paid, paidSearch, ['invoice_number','delivered_person','payment_method']);

  const salesmanColor = (id, fallbackName) => {
    const idx = salesmen.findIndex(s => s.id === id);
    if (idx >= 0) return COLORS[idx % COLORS.length];
    if (fallbackName) {
      let hash = 0;
      for (let i = 0; i < fallbackName.length; i++) hash += fallbackName.charCodeAt(i);
      return COLORS[hash % COLORS.length];
    }
    return '#AAB7C4';
  };

  return (
    <div className="app-container">
      <div className="header">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="sub">Al Sahal Printing Press</div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={handleOpenNotifs}>
            🔔
            {unreadCount > 0 && <span className="badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button className="logout-btn" onClick={() => {
            if (confirm('Sign out?')) { removeToken(); onLogout(); }
          }}>Sign Out</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card" style={{ borderTopColor: '#2C3E50' }}>
          <div className="stat-val" style={{ color: '#2C3E50' }}>{salesmen.length}</div>
          <div className="stat-lbl">Salesmen</div>
        </div>
        <div className="stat-card" style={{ borderTopColor: '#27AE60' }}>
          <div className="stat-val" style={{ color: '#27AE60' }}>{trackingStatus.filter(t => t.is_tracking).length}</div>
          <div className="stat-lbl">Active</div>
        </div>
        <div className="stat-card" style={{ borderTopColor: '#C0392B' }}>
          <div className="stat-val" style={{ color: '#C0392B' }}>
            {notPaid.filter(i => i.status === 'not_paid').length + notPaidSales.filter(i => i.status === 'not_paid').length}
          </div>
          <div className="stat-lbl">Not Paid</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="content">
        {tab === 'salesmen' && (
          <>
            <button className="add-sales-btn" onClick={() => setAddModal(true)}>+ Add New Salesman</button>
            <div className="sales-grid">
              {salesmen.map((s, i) => {
                const tr = getTracking(s.id);
                const loc = getLocation(s.id);
                const isOn = tr?.is_tracking;
                const col = COLORS[i % COLORS.length];
                return (
                  <button key={s.id} className="sales-card" style={{ borderLeftColor: col }}
                    onClick={() => { setSelectedSalesman(s); setDetailModal(true); setCredentials(null); }}>
                    <div className="sales-card-top">
                      <div className="av" style={{ background: col }}>{initials(s.name)}</div>
                      <div className="track-dot-wrap" style={{ background: isOn ? '#D5F5E3' : '#FADBD8' }}>
                        <div className="track-dot" style={{ background: isOn ? '#27AE60' : '#EA4335' }} />
                      </div>
                    </div>
                    <div className="sales-name">{s.name}</div>
                    <div className="sales-sub">{isOn ? 'Tracking ON' : 'Tracking OFF'}</div>
                    {loc && isOn && (
                      <span className="map-btn" onClick={(e) => { e.stopPropagation(); openMap(loc.lat, loc.lng, s.name); }}>📍 Live location</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'visits' && (
          <>
            <FilterBar selected={visitFilter} onSelect={setVisitFilter} />
            <SearchBar value={visitSearch} onChange={setVisitSearch} placeholder="Search company, salesman, contact…" />
            <div className="result-count">{filteredVisits.length} visits</div>
            {filteredVisits.map(v => {
              const col = salesmanColor(v.user_id, v.salesman_name);
              return (
                <div key={v.id} className="card" style={{ borderLeftColor: col }}>
                  <div className="card-top-row">
                    <div className="card-title">{v.company_name}</div>
                    <span className="tag-badge" style={{ background: col + '22', color: col }}>
                      {v.users?.name?.split(' ')[0] || v.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  <div className="card-detail">{v.contact_name} · {v.mobile}</div>
                  {v.email_id && <div className="card-detail">{v.email_id}</div>}
                  {v.quotation && (
                    <span className="status-badge" style={{ background: '#EAF0FB', color: '#1A5276' }}>
                      Quotation: {v.quotation_description}
                    </span>
                  )}
                  {v.lat && v.lng && (
                    <div><span className="map-btn" onClick={() => openMap(v.lat, v.lng, v.company_name)}>📍 View visit location</span></div>
                  )}
                  <div className="card-time">{formatDate(v.visited_at)}</div>
                </div>
              );
            })}
            {filteredVisits.length === 0 && <div className="empty">No visits found</div>}
          </>
        )}

        {tab === 'deliveries' && (
          <>
            <FilterBar selected={deliveryFilter} onSelect={setDeliveryFilter} />
            <SearchBar value={deliverySearch} onChange={setDeliverySearch} placeholder="Search invoice, salesman, company…" />
            <div className="result-count">{filteredDeliveries.length} deliveries</div>
            {filteredDeliveries.map(d => {
              const col = salesmanColor(d.user_id, d.salesman_name);
              const sc = d.status === 'paid' ? { bg: '#D5F5E3', txt: '#145A32', lbl: '✓ Paid' }
                : d.status === 'pending_approval' ? { bg: '#FDEBD0', txt: '#784212', lbl: '⏳ Pending' }
                : { bg: '#FADBD8', txt: '#A93226', lbl: '✗ Not Paid' };
              return (
                <div key={d.id} className="card" style={{ borderLeftColor: col }}>
                  <div className="card-top-row">
                    <div className="card-title">{d.invoice_number}</div>
                    <span className="tag-badge" style={{ background: col + '22', color: col }}>
                      {d.users?.name?.split(' ')[0] || d.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  <div className="card-detail">Delivered to: {d.delivered_person}</div>
                  <div className="card-detail">Payment: {pmLabel(d.payment_method)}</div>
                  <span className="status-badge" style={{ background: sc.bg, color: sc.txt }}>{sc.lbl}</span>
                  {d.lat && d.lng && (
                    <div><span className="map-btn" onClick={() => openMap(d.lat, d.lng, d.invoice_number)}>📍 View delivery location</span></div>
                  )}
                  <div className="card-time">{formatDate(d.created_at)}</div>
                </div>
              );
            })}
            {filteredDeliveries.length === 0 && <div className="empty">No deliveries found</div>}
          </>
        )}

        {tab === 'saleslog' && (
          <>
            <FilterBar selected={salesLogFilter} onSelect={setSalesLogFilter} />
            <SearchBar value={salesLogSearch} onChange={setSalesLogSearch} placeholder="Search invoice, salesman, recipient…" />
            <div className="result-count">{filteredSalesLog.length} sales</div>
            {filteredSalesLog.map(s => {
              const col = salesmanColor(s.user_id, s.salesman_name);
              const sc = s.status === 'paid' ? { bg: '#D5F5E3', txt: '#145A32', lbl: '✓ Paid' }
                : s.status === 'pending_approval' ? { bg: '#FDEBD0', txt: '#784212', lbl: '⏳ Pending' }
                : { bg: '#FADBD8', txt: '#A93226', lbl: '✗ Not Paid' };
              return (
                <div key={s.id} className="card" style={{ borderLeftColor: col }}>
                  <div className="card-top-row">
                    <div className="card-title">
                      {s.invoice_number}
                      {s.source === 'delivery' && (
                        <span className="tag-badge" style={{ background: '#F4ECFB', color: '#5B2C6F', marginLeft: 8 }}>From Delivery</span>
                      )}
                    </div>
                    <span className="tag-badge" style={{ background: col + '22', color: col }}>
                      {s.users?.name?.split(' ')[0] || s.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  <div className="card-detail">Delivered to: {s.delivered_to}</div>
                  <div className="card-detail">Amount: {Number(s.amount || 0).toFixed(2)} OMR</div>
                  <div className="card-detail">Payment: {pmLabel(s.payment_method)}</div>
                  <span className="status-badge" style={{ background: sc.bg, color: sc.txt }}>{sc.lbl}</span>
                  <div className="card-time">{formatDate(s.created_at)}</div>
                </div>
              );
            })}
            {filteredSalesLog.length === 0 && <div className="empty">No sales found</div>}
          </>
        )}

        {tab === 'notpaid' && (
          <>
            <SearchBar value={notPaidSearch} onChange={setNotPaidSearch} placeholder="Search invoice, salesman, company…" />
            <div className="result-count">{filteredNotPaid.length} unpaid invoices</div>
            {filteredNotPaid.map(inv => {
              const isPending = inv.status === 'pending_approval';
              const col = salesmanColor(inv.user_id, inv.salesman_name);
              return (
                <div key={`${inv._source}-${inv.id}`} className="card" style={{ borderLeftColor: isPending ? '#F39C12' : '#C0392B' }}>
                  <div className="card-top-row">
                    <div className="card-title">
                      {inv.invoice_number}
                      <span className="tag-badge" style={{ background: inv._source === 'sales' ? '#EAF0FB' : '#F4ECFB', color: inv._source === 'sales' ? '#1A5276' : '#5B2C6F', marginLeft: 8 }}>
                        {inv._source === 'sales' ? 'Sale' : 'Delivery'}
                      </span>
                    </div>
                    <span className="tag-badge" style={{ background: col + '22', color: col }}>
                      {inv.users?.name?.split(' ')[0] || inv.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  <div className="card-detail">Delivered to: {inv._to}</div>
                  {inv.amount ? <div className="card-detail">Amount: {Number(inv.amount).toFixed(2)} OMR</div> : null}
                  {isPending && <div className="card-detail">Method claimed: {pmLabel(inv.payment_method)}</div>}
                  <span className="status-badge" style={{ background: isPending ? '#FDEBD0' : '#FADBD8', color: isPending ? '#784212' : '#A93226' }}>
                    {isPending ? '⏳ Pending approval' : '✗ Not Paid'}
                  </span>
                  {isPending && <button className="approve-btn" onClick={() => handleApprove(inv)}>✓ Approve Payment</button>}
                  <div className="card-time">{formatDate(inv.created_at)}</div>
                </div>
              );
            })}
            {filteredNotPaid.length === 0 && <div className="empty">No unpaid invoices 🎉</div>}
          </>
        )}

        {tab === 'paid' && (
          <>
            <FilterBar selected={paidFilter} onSelect={setPaidFilter}
              filters={[{ key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'older', label: 'Older' }]} />
            <SearchBar value={paidSearch} onChange={setPaidSearch} placeholder="Search invoice, salesman, method…" />
            <div className="result-count">{filteredPaid.length} paid invoices</div>
            {filteredPaid.map(inv => {
              const col = salesmanColor(inv.user_id, inv.salesman_name);
              return (
                <div key={inv.id} className="card" style={{ borderLeftColor: '#27AE60' }}>
                  <div className="card-top-row">
                    <div className="card-title">{inv.invoice_number}</div>
                    <span className="tag-badge" style={{ background: col + '22', color: col }}>
                      {inv.users?.name?.split(' ')[0] || inv.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  <div className="card-detail">Delivered to: {inv.delivered_person}</div>
                  <div className="card-detail">Payment: {pmLabel(inv.payment_method)}</div>
                  {inv.approved_at && <div className="card-detail">Approved: {formatDate(inv.approved_at)}</div>}
                  <span className="status-badge" style={{ background: '#D5F5E3', color: '#145A32' }}>✓ Paid & Approved</span>
                  <div className="card-time">{formatDate(inv.created_at)}</div>
                </div>
              );
            })}
            {filteredPaid.length === 0 && <div className="empty">No paid invoices found</div>}
          </>
        )}
      </div>

      {notifModal && (
        <div className="overlay" onClick={() => setNotifModal(false)}>
          <div className="sheet" style={{ maxHeight: '82vh' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="sheet-title" style={{ marginBottom: 0 }}>Notifications</div>
              <button className="close-x" onClick={() => setNotifModal(false)}>✕</button>
            </div>
            {notifications.length === 0 && <div className="empty">No notifications</div>}
            {notifications.slice(0, 15).map(n => (
              <div key={n.id} className={`notif-item ${!n.is_read ? 'notif-unread' : ''}`}
                style={{ borderLeftColor: n.type === 'tracking_on' ? '#27AE60' : n.type === 'tracking_off' ? '#EA4335' : '#F39C12' }}>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{formatDate(n.created_at)} · {timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {addModal && (
        <div className="overlay" onClick={() => setAddModal(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Add Salesman</div>
            <form onSubmit={handleAddSalesman}>
              <label className="field-label">Full Name *</label>
              <input className="field-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" />
              <label className="field-label">Email *</label>
              <input className="field-input" type="email" autoCapitalize="none" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@alsahal.com" />
              <label className="field-label">Password *</label>
              <input className="field-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
              <label className="field-label">Sales Target — this month (OMR)</label>
              <input className="field-input" type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Optional, can be set later" />
              <div className="info-box">Only admin can create salesman accounts. Salesmen cannot sign up themselves.</div>
              <button className="btn-primary" style={{ marginTop: 14 }} type="submit" disabled={addLoading}>
                {addLoading ? 'Creating…' : 'Create Account'}
              </button>
            </form>
            <button style={{ width: '100%', textAlign: 'center', marginTop: 12, background: 'none', color: '#5D6D7E', fontSize: 14, fontWeight: 600 }}
              onClick={() => setAddModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {detailModal && selectedSalesman && (
        <SalesmanDetail
          salesman={selectedSalesman}
          color={COLORS[salesmen.findIndex(s => s.id === selectedSalesman.id) % COLORS.length] || '#8E44AD'}
          tracking={getTracking(selectedSalesman.id)}
          location={getLocation(selectedSalesman.id)}
          credentials={credentials}
          credLoading={credLoading}
          onViewCredentials={() => handleViewCredentials(selectedSalesman)}
          onDelete={() => handleDeleteSalesman(selectedSalesman)}
          onClose={() => { setDetailModal(false); setCredentials(null); }}
          onMap={openMap}
        />
      )}
    </div>
  );
}

function SalesmanDetail({ salesman, color, tracking, location, credentials, credLoading, onViewCredentials, onDelete, onClose, onMap }) {
  const [detailFilter, setDetailFilter] = useState('today');
  const [visits, setVisits] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [target, setTarget] = useState({ target_amount: 0, achieved_amount: 0 });
  const [targetInput, setTargetInput] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const DETAIL_FILTERS = [
    { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }, { key: 'all', label: 'All Time' },
  ];

  useEffect(() => {
    Promise.all([
      getVisits(detailFilter === 'all' ? undefined : detailFilter, salesman.id),
      getDeliveries(detailFilter === 'all' ? undefined : detailFilter, salesman.id),
    ]).then(([v, d]) => { setVisits(v || []); setDeliveries(d || []); }).catch(() => {});
  }, [detailFilter, salesman.id]);

  useEffect(() => {
    getSalesmanSummary(salesman.id).then(setSummary).catch(() => {});
    getSalesTarget(salesman.id).then(t => { setTarget(t); setTargetInput(String(t.target_amount || '')); }).catch(() => {});
  }, [salesman.id]);

  const handleSaveTarget = async () => {
    const amount = Number(targetInput);
    if (isNaN(amount) || amount < 0) return alert('Enter a valid target amount');
    setTargetSaving(true);
    try {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      await setSalesTarget(salesman.id, month, amount);
      const t = await getSalesTarget(salesman.id);
      setTarget(t); setTargetInput(String(t.target_amount || ''));
      alert('Sales target updated');
    } catch { alert('Failed to save target'); }
    finally { setTargetSaving(false); }
  };

  const isOn = tracking?.is_tracking;
  const uniqueCompanies = [...new Set(visits.map(v => v.company_name))].length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet sheet-flex" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="detail-header">
          <div className="av" style={{ background: color, width: 48, height: 48, borderRadius: 24, fontSize: 18 }}>{initials(salesman.name)}</div>
          <div style={{ flex: 1 }}>
            <div className="detail-name">{salesman.name}</div>
            <div style={{ fontSize: 11, color: '#5D6D7E' }}>{salesman.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <div className="track-dot" style={{ background: isOn ? '#27AE60' : '#EA4335' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: isOn ? '#27AE60' : '#EA4335' }}>{isOn ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          <button className="close-x" onClick={onClose}>✕</button>
        </div>

        {/* Everything below scrolls in its own region; the delete button
            sits outside it as a fixed footer so it never moves regardless
            of how much activity history exists. */}
        <div className="detail-scroll">
          <button className="cred-btn" onClick={onViewCredentials}>
            {credLoading ? 'Loading…' : credentials ? `📧 ${credentials.email}   🔑 ${credentials.password_plain || '(not stored)'}` : '👁 View Login Credentials'}
          </button>

          <div className="target-box">
            <div className="section-label-sm">SALES TARGET · THIS MONTH</div>
            <div className="target-numbers">
              <span className="target-achieved">{Number(target.achieved_amount || 0).toFixed(0)}</span>
              <span className="target-slash">/ {Number(target.target_amount || 0).toFixed(0)} OMR</span>
            </div>
            <div className="target-bar-bg">
              <div className="target-bar-fill" style={{
                width: `${target.target_amount > 0 ? Math.min(100, (target.achieved_amount / target.target_amount) * 100) : 0}%`
              }} />
            </div>
            <div className="target-edit-row">
              <input className="field-input" style={{ marginBottom: 0, height: 40 }} type="number"
                value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="Set new target (OMR)" />
              <button className="target-save-btn" onClick={handleSaveTarget} disabled={targetSaving}>
                {targetSaving ? '…' : 'Save'}
              </button>
            </div>
          </div>

          {summary && (
            <div className="summary-row">
              <div className="summary-txt">Today: {summary.visits_today} visits · {summary.deliveries_today} deliveries</div>
              <div className="summary-txt">All-time: {summary.visits_total} visits · {summary.deliveries_total} deliveries</div>
            </div>
          )}

          <div className="stats-row" style={{ background: 'transparent', border: 'none', padding: '0 0 8px' }}>
            <div className="stat-card"><div className="stat-val" style={{ color: '#2C3E50', fontSize: 20 }}>{visits.length}</div><div className="stat-lbl">Visits</div></div>
            <div className="stat-card"><div className="stat-val" style={{ color: '#27AE60', fontSize: 20 }}>{uniqueCompanies}</div><div className="stat-lbl">Companies</div></div>
            <div className="stat-card"><div className="stat-val" style={{ color: '#C0392B', fontSize: 20 }}>{deliveries.length}</div><div className="stat-lbl">Deliveries</div></div>
          </div>

          {isOn && (
            <button className="live-loc-btn" onClick={() => location ? onMap(location.lat, location.lng, salesman.name) : alert('No location data yet')}>
              📍 Live Location {location ? `· ${timeAgo(location.recorded_at)}` : '· No data yet'}
            </button>
          )}

          <div className="filter-row">
            {DETAIL_FILTERS.map(f => (
              <button key={f.key} className={`filter-pill ${detailFilter === f.key ? 'on' : ''}`} onClick={() => setDetailFilter(f.key)}>{f.label}</button>
            ))}
          </div>

          {visits.length === 0 && deliveries.length === 0 && <div className="empty">No activity found</div>}

          {visits.map(v => (
            <div key={v.id} className="card" style={{ borderLeftColor: color }}>
              <div className="card-top-row">
                <div className="card-title">{v.company_name}</div>
                <span className="tag-badge" style={{ background: '#EAF0FB', color: '#1A5276' }}>Visit</span>
              </div>
              <div className="card-detail">{v.contact_name} · {v.mobile}</div>
              {v.email_id && <div className="card-detail">{v.email_id}</div>}
              {v.quotation && <div className="card-detail">Quotation: {v.quotation_description}</div>}
              {v.lat && v.lng && <div><span className="map-btn" onClick={() => onMap(v.lat, v.lng, v.company_name)}>📍 View visit location</span></div>}
              <div className="card-time">{formatDate(v.visited_at)}</div>
            </div>
          ))}
          {deliveries.map(d => (
            <div key={d.id} className="card" style={{ borderLeftColor: color }}>
              <div className="card-top-row">
                <div className="card-title">{d.invoice_number}</div>
                <span className="tag-badge" style={{ background: '#D5F5E3', color: '#145A32' }}>Delivery</span>
              </div>
              <div className="card-detail">To: {d.delivered_person} · {pmLabel(d.payment_method)}</div>
              {d.lat && d.lng && <div><span className="map-btn" onClick={() => onMap(d.lat, d.lng, d.invoice_number)}>📍 View delivery location</span></div>}
              <div className="card-time">{formatDate(d.created_at)}</div>
            </div>
          ))}
        </div>

        <button className="btn-primary" style={{ background: '#EA4335', marginTop: 10, flexShrink: 0 }} onClick={onDelete}>
          Delete Salesman Account
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  SALESMAN WEB VIEW — mirrors the mobile SalesmanDashboard's tabs
// ══════════════════════════════════════════════════════════════════
const SALES_TABS = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'visits', label: 'Visits', icon: '📍' },
  { key: 'delivery', label: 'Delivery', icon: '🚚' },
  { key: 'saleslog', label: 'Sales Log', icon: '💰' },
  { key: 'notpaid', label: 'Not Paid', icon: '🧾' },
];

const PAY_OPTIONS = [
  { key: 'cash', label: 'Cash' },
  { key: 'bank', label: 'Bank Transfer' },
  { key: 'credit', label: 'Credit' },
  { key: 'not_paid', label: 'Not Paid' },
];

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function SalesmanView({ onLogout }) {
  const [name, setName] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [tracking, setTracking] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);

  const [visits, setVisits] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [salesLog, setSalesLog] = useState([]);
  const [notPaid, setNotPaid] = useState([]);
  const [notPaidSales, setNotPaidSales] = useState([]);
  const [target, setTarget] = useState({ target_amount: 0, achieved_amount: 0 });

  const [visitFilter, setVisitFilter] = useState('today');
  const [deliveryFilter, setDeliveryFilter] = useState('today');
  const [salesLogFilter, setSalesLogFilter] = useState('today');

  const [visitModal, setVisitModal] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [saleModal, setSaleModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setName(payload.name || '');
    } catch {}
    loadNotPaid();
    loadTarget();
  }, []);

  useEffect(() => { getVisits(visitFilter).then(setVisits).catch(() => {}); }, [visitFilter]);
  useEffect(() => { getDeliveries(deliveryFilter).then(setDeliveries).catch(() => {}); }, [deliveryFilter]);
  useEffect(() => { getSalesLog(salesLogFilter).then(setSalesLog).catch(() => {}); }, [salesLogFilter]);

  // Ping location every 60s while tracking is on (browser tab must stay open)
  useEffect(() => {
    if (!tracking) return;
    const iv = setInterval(async () => {
      const loc = await getBrowserLocation();
      if (loc) pingLocation(loc.lat, loc.lng).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, [tracking]);

  const loadNotPaid = () => {
    getNotPaidInvoices().then(setNotPaid).catch(() => {});
    getNotPaidSales().then(setNotPaidSales).catch(() => {});
  };
  const loadTarget = () => getSalesTarget().then(setTarget).catch(() => {});

  const toggleTracking = async () => {
    setTrackingBusy(true);
    try {
      const next = !tracking;
      await setTrackingStatus(next);
      setTracking(next);
      if (next) {
        const loc = await getBrowserLocation();
        if (loc) pingLocation(loc.lat, loc.lng).catch(() => {});
      }
    } catch { alert('Failed to update tracking status'); }
    finally { setTrackingBusy(false); }
  };

  const mergedNotPaid = [
    ...notPaid.map(i => ({ ...i, _source: 'delivery', _to: i.delivered_person })),
    ...notPaidSales.map(i => ({ ...i, _source: 'sales', _to: i.delivered_to })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const handleRequestPayment = async (pm) => {
    try {
      if (selectedInv._source === 'sales') await requestSalePayment(selectedInv.id, pm);
      else await requestPayment(selectedInv.id, pm);
      setPayModal(false);
      loadNotPaid();
    } catch { alert('Failed to submit payment request'); }
  };

  return (
    <div className="app-container">
      <div className="header">
        <div>
          <h1>Al Sahal</h1>
          <div className="sub">{name || 'Salesman'} · Sales Tracker</div>
        </div>
        <div className="header-actions">
          <button className="logout-btn" onClick={() => { if (confirm('Sign out?')) onLogout(); }}>Sign Out</button>
        </div>
      </div>

      <div className="track-toggle-row">
        <button className={`track-toggle-btn ${tracking ? 'on' : ''}`} onClick={toggleTracking} disabled={trackingBusy}>
          {trackingBusy ? '…' : tracking ? '● Work Started — Tap to Stop' : '○ Tap to Start Work'}
        </button>
      </div>

      <div className="tabs">
        {SALES_TABS.map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'on' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="content">
        {activeTab === 'home' && (
          <div style={{ padding: 16 }}>
            <div className="target-box">
              <div className="section-label-sm">SALES TARGET · THIS MONTH</div>
              <div className="target-numbers">
                <span className="target-achieved">{Number(target.achieved_amount || 0).toFixed(0)}</span>
                <span className="target-slash">/ {Number(target.target_amount || 0).toFixed(0)} OMR</span>
              </div>
              <div className="target-bar-bg">
                <div className="target-bar-fill" style={{
                  width: `${target.target_amount > 0 ? Math.min(100, (target.achieved_amount / target.target_amount) * 100) : 0}%`
                }} />
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-val" style={{ color: '#2C3E50' }}>{visits.length}</div><div className="stat-lbl">Visits</div></div>
              <div className="stat-card"><div className="stat-val" style={{ color: '#EA4335' }}>{mergedNotPaid.filter(i => i.status === 'not_paid').length}</div><div className="stat-lbl">Not Paid</div></div>
              <div className="stat-card"><div className="stat-val" style={{ color: '#27AE60' }}>{deliveries.length}</div><div className="stat-lbl">Deliveries</div></div>
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <>
            <FilterBar selected={visitFilter} onSelect={setVisitFilter} />
            <div className="result-count">{visits.length} visits</div>
            {visits.map(v => (
              <div key={v.id} className="card" style={{ borderLeftColor: '#8E44AD' }}>
                <div className="card-title">{v.company_name}</div>
                <div className="card-detail">{v.contact_name} · {v.mobile}</div>
                {v.email_id && <div className="card-detail">{v.email_id}</div>}
                {v.quotation && <div className="card-detail">Quotation: {v.quotation_description}</div>}
                <div className="card-time">{formatDate(v.visited_at)}</div>
              </div>
            ))}
            {visits.length === 0 && <div className="empty">No visits found</div>}
            <button className="web-fab" onClick={() => setVisitModal(true)}>+</button>
          </>
        )}

        {activeTab === 'delivery' && (
          <>
            <FilterBar selected={deliveryFilter} onSelect={setDeliveryFilter} />
            <div className="result-count">{deliveries.length} deliveries</div>
            {deliveries.map(d => (
              <div key={d.id} className="card" style={{ borderLeftColor: '#27AE60' }}>
                <div className="card-title">{d.invoice_number}</div>
                <div className="card-detail">To: {d.delivered_person} · {pmLabel(d.payment_method)}</div>
                {d.amount ? <div className="card-detail">Amount: {Number(d.amount).toFixed(2)} OMR</div> : null}
                <div className="card-time">{formatDate(d.created_at)}</div>
              </div>
            ))}
            {deliveries.length === 0 && <div className="empty">No deliveries found</div>}
            <button className="web-fab" onClick={() => setDeliveryModal(true)}>+</button>
          </>
        )}

        {activeTab === 'saleslog' && (
          <>
            <FilterBar selected={salesLogFilter} onSelect={setSalesLogFilter} />
            <div className="result-count">{salesLog.length} sales</div>
            {salesLog.map(s => (
              <div key={s.id} className="card" style={{ borderLeftColor: '#1A5276' }}>
                <div className="card-title">{s.invoice_number}</div>
                <div className="card-detail">Delivered to: {s.delivered_to}</div>
                <div className="card-detail">Amount: {Number(s.amount || 0).toFixed(2)} OMR · {pmLabel(s.payment_method)}</div>
                <div className="card-time">{formatDate(s.created_at)}</div>
              </div>
            ))}
            {salesLog.length === 0 && <div className="empty">No sales logged</div>}
            <button className="web-fab" onClick={() => setSaleModal(true)}>+</button>
          </>
        )}

        {activeTab === 'notpaid' && (
          <>
            <div className="result-count">{mergedNotPaid.length} unpaid invoices</div>
            {mergedNotPaid.map(inv => {
              const isPending = inv.status === 'pending_approval';
              return (
                <div key={`${inv._source}-${inv.id}`} className="card" style={{ borderLeftColor: isPending ? '#F39C12' : '#C0392B' }}>
                  <div className="card-title">{inv.invoice_number}</div>
                  <div className="card-detail">Delivered to: {inv._to}</div>
                  <span className="status-badge" style={{ background: isPending ? '#FDEBD0' : '#FADBD8', color: isPending ? '#784212' : '#A93226' }}>
                    {isPending ? '⏳ Waiting for admin approval' : '✗ Not Paid'}
                  </span>
                  {!isPending && (
                    <button className="approve-btn" style={{ background: '#EAF0FB', color: '#1A5276' }}
                      onClick={() => { setSelectedInv(inv); setPayModal(true); }}>
                      Mark as Paid
                    </button>
                  )}
                  <div className="card-time">{formatDate(inv.created_at)}</div>
                </div>
              );
            })}
            {mergedNotPaid.length === 0 && <div className="empty">No unpaid invoices 🎉</div>}
          </>
        )}
      </div>

      {/* Visit modal */}
      {visitModal && (
        <VisitFormModal
          onClose={() => setVisitModal(false)}
          onSaved={() => { setVisitModal(false); getVisits(visitFilter).then(setVisits); }}
        />
      )}

      {/* Delivery modal */}
      {deliveryModal && (
        <DeliveryFormModal
          onClose={() => setDeliveryModal(false)}
          onSaved={() => {
            setDeliveryModal(false);
            getDeliveries(deliveryFilter).then(setDeliveries);
            loadNotPaid(); loadTarget();
          }}
        />
      )}

      {/* Sale modal */}
      {saleModal && (
        <SaleFormModal
          onClose={() => setSaleModal(false)}
          onSaved={() => {
            setSaleModal(false);
            getSalesLog(salesLogFilter).then(setSalesLog);
            loadNotPaid(); loadTarget();
          }}
        />
      )}

      {/* Payment modal */}
      {payModal && selectedInv && (
        <div className="overlay" onClick={() => setPayModal(false)}>
          <div className="sheet" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Mark {selectedInv.invoice_number} as Paid</div>
            <div className="field-label" style={{ marginBottom: 8 }}>How was it paid?</div>
            {PAY_OPTIONS.filter(o => o.key !== 'not_paid').map(o => (
              <button key={o.key} className="pay-option-btn" onClick={() => handleRequestPayment(o.key)}>{o.label}</button>
            ))}
            <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setPayModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitFormModal({ onClose, onSaved }) {
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [mobile, setMobile] = useState('');
  const [emailId, setEmailId] = useState('');
  const [quotation, setQuotation] = useState(false);
  const [quotationDesc, setQuotationDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!company.trim()) return alert('Company name is required');
    setSaving(true);
    try {
      const loc = await getBrowserLocation();
      await logVisit({
        company_name: company.trim(), contact_name: contact.trim(), mobile: mobile.trim(),
        email_id: emailId.trim(), quotation, quotation_description: quotationDesc.trim(),
        lat: loc?.lat, lng: loc?.lng,
      });
      onSaved();
    } catch { alert('Failed to save visit'); }
    finally { setSaving(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">New Visit</div>
        <label className="field-label">Company Name *</label>
        <input className="field-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" />
        <label className="field-label">Contact Person</label>
        <input className="field-input" value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact name" />
        <label className="field-label">Mobile</label>
        <input className="field-input" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile number" />
        <label className="field-label">Email</label>
        <input className="field-input" value={emailId} onChange={e => setEmailId(e.target.value)} placeholder="Email address" />
        <label className="check-row">
          <input type="checkbox" checked={quotation} onChange={e => setQuotation(e.target.checked)} /> Quotation given
        </label>
        {quotation && (
          <>
            <label className="field-label">Quotation Details</label>
            <textarea className="field-input" rows={3} value={quotationDesc} onChange={e => setQuotationDesc(e.target.value)} />
          </>
        )}
        <div className="info-box">Your current browser location will be saved with this visit, if allowed.</div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Visit'}
        </button>
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function DeliveryFormModal({ onClose, onSaved }) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [deliveredPerson, setDeliveredPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [isMySale, setIsMySale] = useState(false);
  const [pm, setPm] = useState('cash');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!invoiceNo.trim() || !deliveredPerson.trim()) return alert('Invoice number and delivered to are required');
    setSaving(true);
    try {
      const loc = await getBrowserLocation();
      await logDelivery({
        invoice_number: invoiceNo.trim(), delivered_person: deliveredPerson.trim(),
        payment_method: pm, amount: Number(amount) || 0, is_sale: isMySale,
        lat: loc?.lat, lng: loc?.lng,
      });
      onSaved();
    } catch { alert('Failed to save delivery'); }
    finally { setSaving(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">New Delivery</div>
        <label className="field-label">Invoice Number *</label>
        <input className="field-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-2026-XXXX" />
        <label className="field-label">Delivered To *</label>
        <input className="field-input" value={deliveredPerson} onChange={e => setDeliveredPerson(e.target.value)} placeholder="Person name" />
        <label className="field-label">Amount (OMR)</label>
        <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        <label className="check-row">
          <input type="checkbox" checked={isMySale} onChange={e => setIsMySale(e.target.checked)} /> My Sales — also log this as a sale
        </label>
        <label className="field-label">Payment Method *</label>
        <select className="field-input" value={pm} onChange={e => setPm(e.target.value)}>
          {PAY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <div className="info-box">Your current browser location will be saved with this delivery, if allowed.</div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Delivery'}
        </button>
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function SaleFormModal({ onClose, onSaved }) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [amount, setAmount] = useState('');
  const [pm, setPm] = useState('cash');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!invoiceNo.trim() || !deliveredTo.trim()) return alert('Invoice number and delivered to are required');
    setSaving(true);
    try {
      await logSale({
        invoice_number: invoiceNo.trim(), delivered_to: deliveredTo.trim(),
        amount: Number(amount) || 0, payment_method: pm,
      });
      onSaved();
    } catch { alert('Failed to save sale'); }
    finally { setSaving(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">New Sale Log</div>
        <label className="field-label">Invoice Number *</label>
        <input className="field-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-2026-XXXX" />
        <label className="field-label">Delivered To *</label>
        <input className="field-input" value={deliveredTo} onChange={e => setDeliveredTo(e.target.value)} placeholder="Person / company name" />
        <label className="field-label">Amount (OMR)</label>
        <input className="field-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        <label className="field-label">Payment Method *</label>
        <select className="field-input" value={pm} onChange={e => setPm(e.target.value)}>
          {PAY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Sale'}
        </button>
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
