import { useState, useEffect } from 'react';
import {
  signin, getToken, saveToken, removeToken,
  getSalesmen, getAllTrackingStatus, getLatestLocations,
  getVisits, getDeliveries, getNotPaidInvoices, getPaidInvoices,
  approvePayment, getNotifications, markNotificationsRead,
  createSalesman, deleteSalesman, getSalesmanCredentials,
  getSalesLog, getNotPaidSales, approveSalePayment,
  getSalesTarget, setSalesTarget, getSalesmanSummary,
  adminMarkPaid, approveVisitEdit, approveDeliveryEdit,
} from './api.js';

const COLORS = ['#8E44AD','#2980B9','#16A085','#D35400','#1A5276','#7D6608'];

function asUTC(ts) {
  if (!ts) return null;
  const iso = /[Zz]|[+-]\d\d:\d\d$/.test(ts) ? ts : ts + 'Z';
  return new Date(iso);
}

function formatDate(ts) {
  const src = asUTC(ts);
  if (!src) return '';
  const d = new Date(src.getTime() + (4 * 60 * 60 * 1000));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = d.getUTCHours().toString().padStart(2,'0');
  const mm = d.getUTCMinutes().toString().padStart(2,'0');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${hh}:${mm}`;
}

function formatDateFull(ts) {
  const src = asUTC(ts);
  if (!src) return '';
  const d = new Date(src.getTime() + (4 * 60 * 60 * 1000));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const hh = d.getUTCHours().toString().padStart(2,'0');
  const mm = d.getUTCMinutes().toString().padStart(2,'0');
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${hh}:${mm}`;
}

function timeAgo(ts) {
  const src = asUTC(ts);
  if (!src) return '';
  const diff = Math.floor((Date.now() - src.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name) {
  return (name || '').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

function pmLabel(pm) {
  if (pm === 'bank') return 'Bank Transfer';
  if (pm === 'not_paid') return 'Not Paid';
  if (!pm) return '—';
  return pm.charAt(0).toUpperCase() + pm.slice(1);
}

function salesmanColor(id, fallbackName, salesmen) {
  const idx = salesmen.findIndex(s => s.id === id);
  if (idx >= 0) return COLORS[idx % COLORS.length];
  if (fallbackName) {
    let hash = 0;
    for (let i = 0; i < fallbackName.length; i++) hash += fallbackName.charCodeAt(i);
    return COLORS[hash % COLORS.length];
  }
  return '#AAB7C4';
}

const TABS = ['Salesmen','Visits','Deliveries','Sales Log','Not Paid','Paid'];
const FILTERS = [
  { key:'today', label:'Today' },
  { key:'yesterday', label:'Yesterday' },
  { key:'week', label:'This Week' },
  { key:'month', label:'This Month' },
  { key:'older', label:'Older' },
];

function FilterBar({ selected, onSelect, filters = FILTERS }) {
  return (
    <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'10px 0 6px' }}>
      {filters.map(f => (
        <button key={f.key} onClick={() => onSelect(f.key)}
          style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid',
            borderColor: selected===f.key ? '#C0392B' : '#DDD',
            background: selected===f.key ? '#C0392B' : '#fff',
            color: selected===f.key ? '#fff' : '#5D6D7E',
            fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Search…'}
      style={{ width:'100%', padding:'10px 14px', borderRadius:12,
        border:'1px solid #E8EAED', fontSize:13, outline:'none',
        background:'#F4F5F7', color:'#1A252F', boxSizing:'border-box' }} />
  );
}

function Badge({ color, bg, children }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px',
      borderRadius:20, background:bg, color, fontSize:11, fontWeight:700 }}>
      {children}
    </span>
  );
}

function Card({ children, leftColor }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, padding:14, marginBottom:10,
      borderLeft: leftColor ? `4px solid ${leftColor}` : 'none',
      boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
      {children}
    </div>
  );
}

function ModalSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
      display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:24,
        width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:38, height:4, background:'#DDD', borderRadius:2, margin:'0 auto 14px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#C0392B', margin:0 }}>{title}</h2>
          <button onClick={onClose}
            style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#5D6D7E' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#5D6D7E', marginBottom:6 }}>
        {label}{required && <span style={{ color:'#C0392B' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type='text', style={} }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} type={type}
      style={{ width:'100%', padding:'10px 14px', borderRadius:12,
        border:'1px solid #E8EAED', fontSize:14, outline:'none',
        background:'#F4F5F7', color:'#1A252F', boxSizing:'border-box', ...style }} />
  );
}

function Btn({ onClick, children, color='#C0392B', disabled, style={} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width:'100%', height:50, background: disabled ? '#ccc' : color,
        color:'#fff', border:'none', borderRadius:14, fontSize:15, fontWeight:800,
        cursor: disabled ? 'not-allowed' : 'pointer', marginTop:8, ...style }}>
      {children}
    </button>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{ background:'#FFF8E1', borderRadius:10, padding:10,
      marginTop:8, fontSize:12, color:'#7D6608', lineHeight:1.6 }}>
      {children}
    </div>
  );
}

function PayTypeSelector({ type, setType, cashT, setCashT }) {
  return (
    <div>
      <div style={{ display:'flex', gap:8 }}>
        {[['cash','Cash'],['credit','Credit'],['not_paid','Not Paid']].map(([val,lbl]) => (
          <button key={val} onClick={() => setType(val)}
            style={{ flex:1, padding:'9px 4px', borderRadius:10,
              border:`1.5px solid ${type===val ? '#C0392B' : '#DDD'}`,
              background: type===val ? '#FADBD8' : '#fff',
              color: type===val ? '#C0392B' : '#5D6D7E',
              fontWeight:700, fontSize:12, cursor:'pointer' }}>
            {lbl}
          </button>
        ))}
      </div>
      {type === 'cash' && (
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          {[['cash','Cash'],['bank','Bank Transfer']].map(([val,lbl]) => (
            <button key={val} onClick={() => setCashT(val)}
              style={{ flex:1, padding:'9px 4px', borderRadius:10,
                border:`1.5px solid ${cashT===val ? '#C0392B' : '#DDD'}`,
                background: cashT===val ? '#FADBD8' : '#fff',
                color: cashT===val ? '#C0392B' : '#5D6D7E',
                fontWeight:700, fontSize:12, cursor:'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return setLoginError('Please fill all fields');
    setLoginLoading(true); setLoginError('');
    try {
      const data = await signin(email, password);
      saveToken(data.token);
      setAuthed(true);
    } catch (e) {
      setLoginError(e.data?.error || 'Invalid email or password');
    } finally { setLoginLoading(false); }
  };

  const handleLogout = () => { removeToken(); setAuthed(false); };

  if (!authed) {
    return (
      <div style={{ minHeight:'100vh', background:'#F4F5F7',
        display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ background:'#fff', borderRadius:20, padding:32,
          width:'100%', maxWidth:400, boxShadow:'0 4px 24px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ width:72, height:72, background:'#C0392B', borderRadius:20,
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 12px' }}>
              <span style={{ color:'#fff', fontSize:26, fontWeight:900 }}>AS</span>
            </div>
            <h1 style={{ fontSize:24, fontWeight:900, color:'#C0392B', margin:0 }}>Al Sahal</h1>
            <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 0' }}>
              Sales Tracker · Web Dashboard
            </p>
          </div>
          {loginError && (
            <div style={{ background:'#FADBD8', borderRadius:10, padding:'10px 14px',
              color:'#A93226', fontSize:13, marginBottom:12 }}>
              {loginError}
            </div>
          )}
          <FormField label="Email" required>
            <Input value={email} onChange={setEmail} placeholder="you@alsahal.com" type="email" />
          </FormField>
          <FormField label="Password" required>
            <Input value={password} onChange={setPassword} placeholder="••••••••" type="password" />
          </FormField>
          <Btn onClick={handleLogin} disabled={loginLoading}>
            {loginLoading ? 'Signing in…' : 'Sign In'}
          </Btn>
          <p style={{ textAlign:'center', color:'#AAB7C4', fontSize:12, marginTop:16 }}>
            Contact your admin if you don't have access
          </p>
        </div>
      </div>
    );
  }

  return <Dashboard onLogout={handleLogout} />;
}

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState('Salesmen');
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
  const [refreshing, setRefreshing] = useState(false);

  const [visitFilter, setVisitFilter] = useState('today');
  const [deliveryFilter, setDeliveryFilter] = useState('today');
  const [salesLogFilter, setSalesLogFilter] = useState('today');
  const [paidFilter, setPaidFilter] = useState('month');
  const [visitSearch, setVisitSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [salesLogSearch, setSalesLogSearch] = useState('');
  const [notPaidSearch, setNotPaidSearch] = useState('');
  const [paidSearch, setPaidSearch] = useState('');

  const [notifOpen, setNotifOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [salesmanVisits, setSalesmanVisits] = useState([]);
  const [salesmanDeliveries, setSalesmanDeliveries] = useState([]);
  const [detailFilter, setDetailFilter] = useState('today');
  const [credentials, setCredentials] = useState(null);
  const [credLoading, setCredLoading] = useState(false);
  const [salesmanTarget, setSalesmanTarget] = useState({ target_amount:0, achieved_amount:0 });
  const [targetInput, setTargetInput] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const [salesmanSummary, setSalesmanSummary] = useState(null);

  const [adminPayOpen, setAdminPayOpen] = useState(false);
  const [adminPayInv, setAdminPayInv] = useState(null);
  const [adminPayType, setAdminPayType] = useState('cash');
  const [adminCashType, setAdminCashType] = useState('cash');

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { loadVisits(); }, [visitFilter]);
  useEffect(() => { loadDeliveries(); }, [deliveryFilter]);
  useEffect(() => { loadSalesLogAll(); }, [salesLogFilter]);
  useEffect(() => { loadPaid(); }, [paidFilter]);
  useEffect(() => {
    if (selectedSalesman?.id) {
      loadSalesmanDetail();
      loadSalesmanSummary();
      loadSalesmanTarget();
    }
  }, [detailFilter, selectedSalesman?.id]);

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
      console.log('loadAll error:', e);
      if (e.status === 401) { removeToken(); window.location.reload(); }
    }
  };

  const loadVisits = async () => {
    try { setAllVisits(await getVisits(visitFilter)); } catch {}
  };
  const loadDeliveries = async () => {
    try { setAllDeliveries(await getDeliveries(deliveryFilter)); } catch {}
  };
  const loadSalesLogAll = async () => {
    try { setAllSalesLog(await getSalesLog(salesLogFilter)); } catch {}
  };
  const loadPaid = async () => {
    try { setPaid(await getPaidInvoices(paidFilter)); } catch {}
  };

  const loadSalesmanDetail = async () => {
    if (!selectedSalesman) return;
    try {
      const [v, d] = await Promise.all([
        getVisits(detailFilter === 'all' ? undefined : detailFilter, selectedSalesman.id),
        getDeliveries(detailFilter === 'all' ? undefined : detailFilter, selectedSalesman.id),
      ]);
      setSalesmanVisits(v || []); setSalesmanDeliveries(d || []);
    } catch (e) { console.log(e); }
  };

  const loadSalesmanSummary = async () => {
    if (!selectedSalesman) return;
    try { setSalesmanSummary(await getSalesmanSummary(selectedSalesman.id)); } catch {}
  };

  const loadSalesmanTarget = async () => {
    if (!selectedSalesman) return;
    try {
      const data = await getSalesTarget(selectedSalesman.id);
      setSalesmanTarget(data);
      setTargetInput(String(data.target_amount || ''));
    } catch {}
  };

  const handleSaveTarget = async () => {
    const amount = Number(targetInput);
    if (isNaN(amount) || amount < 0) return alert('Enter a valid target amount');
    setTargetSaving(true);
    try {
      const month = new Date().toISOString().slice(0,7) + '-01';
      await setSalesTarget(selectedSalesman.id, month, amount);
      await loadSalesmanTarget();
    } catch { alert('Failed to save target'); }
    finally { setTargetSaving(false); }
  };

  const handleOpenNotifs = async () => {
    setNotifOpen(true);
    await markNotificationsRead();
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read:true })));
  };

  const handleAddSalesman = async () => {
    if (!newName || !newEmail || !newPassword) return alert('All fields required');
    setAddLoading(true);
    try {
      const res = await createSalesman(newName, newEmail, newPassword);
      if (newTarget && Number(newTarget) > 0) {
        const month = new Date().toISOString().slice(0,7) + '-01';
        await setSalesTarget(res.user.id, month, Number(newTarget));
      }
      setAddOpen(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewTarget('');
      await loadAll();
    } catch (e) { alert(e.data?.error || 'Failed to create account'); }
    finally { setAddLoading(false); }
  };

  const handleDeleteSalesman = async (s) => {
    if (!window.confirm(`Delete ${s.name}? Their records will be kept.`)) return;
    try {
      await deleteSalesman(s.id);
      setDetailOpen(false);
      await loadAll();
    } catch { alert('Failed to delete'); }
  };

  const handleViewCredentials = async (s) => {
    setCredLoading(true); setCredentials(null);
    try { setCredentials(await getSalesmanCredentials(s.id)); }
    catch { alert('Could not load credentials'); }
    finally { setCredLoading(false); }
  };

const handleAdminMarkPaid = async () => {
    const pm = adminPayType === 'cash' ? adminCashType : adminPayType;
    try {
      if (adminPayInv._source === 'sales') {
        await adminMarkPaidSale(adminPayInv.id, pm);
      } else {
        await adminMarkPaid(adminPayInv.id, pm);
      }
      setNotPaid(p => p.filter(i => i.id !== adminPayInv.id));
      setNotPaidSales(p => p.filter(i => i.id !== adminPayInv.id));
      setAdminPayOpen(false);
      loadPaid(); loadAll();
    } catch { alert('Failed to mark as paid'); }
  };

  const handleApproveEdit = async (type, id, approve) => {
    try {
      if (type === 'visit') await approveVisitEdit(id, approve);
      else await approveDeliveryEdit(id, approve);
      await loadVisits(); await loadDeliveries();
    } catch { alert('Failed to process edit'); }
  };

  const handleApprove = async (inv) => {
    if (!window.confirm(`Approve ${inv.invoice_number}?`)) return;
    try {
      if (inv._source === 'sales') {
        await approveSalePayment(inv.id);
        setNotPaidSales(p => p.filter(i => i.id !== inv.id));
      } else {
        await approvePayment(inv.id);
        setNotPaid(p => p.filter(i => i.id !== inv.id));
      }
      loadPaid(); loadAll();
    } catch { alert('Failed to approve'); }
  };

  const openMap = (lat, lng, label) =>
    window.open(`https://www.google.com/maps?q=${lat},${lng}&label=${label}`, '_blank');

  const getTracking = (id) => trackingStatus.find(t => t.user_id === id);
  const getLocation = (id) => locations.find(l => l.user_id === id);

  function searchFilter(list, term, keys) {
    if (!term.trim()) return list;
    const t = term.toLowerCase();
    return list.filter(item =>
      keys.some(k => (item[k] || item.users?.name || '').toLowerCase().includes(t))
    );
  }

  function EditPendingSection({ item, type }) {
    if (item.edit_status !== 'pending') return null;
    let pending = {};
    try { pending = JSON.parse(item.pending_edit || '{}'); } catch {}
    return (
      <div style={{ background:'#FFF8E1', borderRadius:10, padding:10, marginTop:8 }}>
        <p style={{ fontSize:11, fontWeight:700, color:'#7D6608', margin:'0 0 4px' }}>
          ⏳ Edit requested by {pending.requested_by}
        </p>
        {Object.entries(pending.proposed || {}).map(([k,v]) => (
          <p key={k} style={{ fontSize:11, color:'#5D6D7E', margin:'2px 0' }}>
            {k.replace(/_/g,' ')}: {String(v)}
          </p>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={() => handleApproveEdit(type, item.id, true)}
            style={{ flex:1, padding:'8px 0', background:'#27AE60', color:'#fff',
              border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:12 }}>
            ✓ Approve Edit
          </button>
          <button onClick={() => handleApproveEdit(type, item.id, false)}
            style={{ flex:1, padding:'8px 0', background:'#EA4335', color:'#fff',
              border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:12 }}>
            ✗ Reject
          </button>
        </div>
      </div>
    );
  }

  const filteredVisits = searchFilter(allVisits, visitSearch, ['company_name','contact_name','mobile','email_id']);
  const filteredDeliveries = searchFilter(allDeliveries, deliverySearch, ['invoice_number','company_name','delivered_person','payment_method']);
  const filteredSalesLog = searchFilter(allSalesLog, salesLogSearch, ['invoice_number','delivered_to','payment_method']);
  const mergedNotPaid = [
    ...notPaid.map(i => ({ ...i, _source:'delivery', _to: i.delivered_person })),
    ...notPaidSales.map(i => ({ ...i, _source:'sales', _to: i.delivered_to })),
  ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const filteredNotPaid = searchFilter(mergedNotPaid, notPaidSearch, ['invoice_number','_to']);
  const filteredPaid = searchFilter(paid, paidSearch, ['invoice_number','delivered_person','payment_method']);

  const notPaidCount = notPaid.filter(i => i.status==='not_paid').length
    + notPaidSales.filter(i => i.status==='not_paid').length;

  return (
    <div style={{ minHeight:'100vh', background:'#F4F5F7',
      fontFamily:'-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>

      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #EBEBEB',
        padding:'20px 24px', display:'flex', alignItems:'center',
        justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:'#1A252F' }}>Admin Dashboard</h1>
          <p style={{ margin:0, fontSize:12, color:'#5D6D7E' }}>Al Sahal Printing Press</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={handleOpenNotifs}
            style={{ position:'relative', background:'none', border:'none', fontSize:24, cursor:'pointer' }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position:'absolute', top:0, right:0, background:'#C0392B',
                color:'#fff', borderRadius:8, minWidth:16, height:16,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:800, border:'2px solid #fff' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={onLogout}
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #DDD',
              background:'none', color:'#EA4335', fontWeight:700, fontSize:12, cursor:'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'flex', gap:12, padding:'16px 24px',
        background:'#fff', borderBottom:'1px solid #EBEBEB' }}>
        {[
          { label:'Salesmen', val: salesmen.length, color:'#2C3E50' },
          { label:'Active Now', val: trackingStatus.filter(t => t.is_tracking).length, color:'#27AE60' },
          { label:'Not Paid', val: notPaidCount, color:'#C0392B' },
        ].map(s => (
          <div key={s.label} style={{ flex:1, background:'#F4F5F7', borderRadius:14,
            padding:'14px 16px', borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'#5D6D7E',
              textTransform:'uppercase', letterSpacing:0.5, marginTop:3 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ background:'#fff', borderBottom:'1px solid #EBEBEB',
        display:'flex', overflowX:'auto', padding:'0 24px' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'12px 16px', border:'none',
              borderBottom: tab===t ? '2.5px solid #C0392B' : '2.5px solid transparent',
              background:'none', fontWeight:700, fontSize:13,
              color: tab===t ? '#C0392B' : '#5D6D7E',
              cursor:'pointer', whiteSpace:'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding:'16px 24px', maxWidth:1200, margin:'0 auto' }}>

        {/* ── Salesmen ── */}
        {tab === 'Salesmen' && (
          <>
            <button onClick={() => setAddOpen(true)}
              style={{ width:'100%', height:48, background:'#C0392B', color:'#fff',
                border:'none', borderRadius:14, fontWeight:800, fontSize:14,
                cursor:'pointer', marginBottom:16 }}>
              + Add New Salesman
            </button>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:12 }}>
              {salesmen.map((s, i) => {
                const tr = getTracking(s.id);
                const loc = getLocation(s.id);
                const isOn = tr?.is_tracking;
                const col = COLORS[i % COLORS.length];
                return (
                  <div key={s.id}
                    onClick={() => { setSelectedSalesman(s); setDetailFilter('today'); setDetailOpen(true); }}
                    style={{ background:'#fff', borderRadius:14, padding:16,
                      borderLeft:`4px solid ${col}`,
                      boxShadow:'0 2px 10px rgba(0,0,0,0.07)', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'center', marginBottom:10 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:col,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'#fff', fontWeight:800, fontSize:13 }}>
                        {initials(s.name)}
                      </div>
                      <div style={{ width:22, height:22, borderRadius:'50%',
                        background: isOn ? '#D5F5E3' : '#FADBD8',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%',
                          background: isOn ? '#27AE60' : '#EA4335' }} />
                      </div>
                    </div>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1A252F' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'#5D6D7E', marginTop:2 }}>
                      {isOn ? 'Tracking ON' : 'Tracking OFF'}
                    </div>
                    {loc && isOn && (
                      <button onClick={e => { e.stopPropagation(); openMap(loc.lat, loc.lng, s.name); }}
                        style={{ marginTop:8, padding:'5px 10px', background:'#F4F5F7',
                          border:'1px solid #DDD', borderRadius:8, fontSize:11,
                          fontWeight:700, color:'#C0392B', cursor:'pointer' }}>
                        📍 Live location
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Visits ── */}
        {tab === 'Visits' && (
          <>
            <FilterBar selected={visitFilter} onSelect={setVisitFilter} />
            <SearchInput value={visitSearch} onChange={setVisitSearch}
              placeholder="Search company, salesman, contact…" />
            <p style={{ fontSize:11, color:'#5D6D7E', margin:'8px 0' }}>
              {filteredVisits.length} visits
            </p>
            {filteredVisits.map(v => {
              const col = salesmanColor(v.user_id, v.salesman_name, salesmen);
              return (
                <Card key={v.id} leftColor={col}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <strong style={{ fontSize:14, color:'#1A252F' }}>{v.company_name}</strong>
                    <span style={{ padding:'3px 8px', borderRadius:20,
                      background:col+'22', color:col, fontSize:10, fontWeight:800, marginLeft:8 }}>
                      {v.users?.name?.split(' ')[0] || v.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>
                    {v.contact_name} · {v.mobile}
                  </p>
                  {v.email_id && <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>{v.email_id}</p>}
                  {v.quotation && (
                    <Badge color="#1A5276" bg="#EAF0FB">Quotation: {v.quotation_description}</Badge>
                  )}
                  {v.lat && v.lng && (
                    <button onClick={() => openMap(v.lat, v.lng, v.company_name)}
                      style={{ marginTop:8, padding:'5px 10px', background:'#F4F5F7',
                        border:'1px solid #DDD', borderRadius:8, fontSize:11,
                        fontWeight:700, color:'#C0392B', cursor:'pointer', display:'block' }}>
                      📍 View visit location
                    </button>
                  )}
                  <EditPendingSection item={v} type="visit" />
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(v.visited_at)}
                  </p>
                </Card>
              );
            })}
            {filteredVisits.length === 0 && (
              <p style={{ textAlign:'center', color:'#AAB7C4', marginTop:40 }}>No visits found</p>
            )}
          </>
        )}

        {/* ── Deliveries ── */}
        {tab === 'Deliveries' && (
          <>
            <FilterBar selected={deliveryFilter} onSelect={setDeliveryFilter} />
            <SearchInput value={deliverySearch} onChange={setDeliverySearch}
              placeholder="Search invoice, salesman, company…" />
            <p style={{ fontSize:11, color:'#5D6D7E', margin:'8px 0' }}>
              {filteredDeliveries.length} deliveries
            </p>
            {filteredDeliveries.map(d => {
              const col = salesmanColor(d.user_id, d.salesman_name, salesmen);
              const sc = d.status==='paid'
                ? { bg:'#D5F5E3', txt:'#145A32', lbl:'✓ Paid' }
                : d.status==='pending_approval'
                ? { bg:'#FDEBD0', txt:'#784212', lbl:'⏳ Pending' }
                : { bg:'#FADBD8', txt:'#922B21', lbl:'✗ Not Paid' };
              return (
                <Card key={d.id} leftColor={col}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <strong style={{ fontSize:14, color:'#1A252F' }}>{d.invoice_number}</strong>
                    <span style={{ padding:'3px 8px', borderRadius:20,
                      background:col+'22', color:col, fontSize:10, fontWeight:800, marginLeft:8 }}>
                      {d.users?.name?.split(' ')[0] || d.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  {d.company_name && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>
                      Company: {d.company_name}
                    </p>
                  )}
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Delivered to: {d.delivered_person}
                  </p>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Payment: {pmLabel(d.payment_method)}
                  </p>
                  <Badge color={sc.txt} bg={sc.bg}>{sc.lbl}</Badge>
                  {d.lat && d.lng && (
                    <button onClick={() => openMap(d.lat, d.lng, d.invoice_number)}
                      style={{ marginTop:8, padding:'5px 10px', background:'#F4F5F7',
                        border:'1px solid #DDD', borderRadius:8, fontSize:11,
                        fontWeight:700, color:'#C0392B', cursor:'pointer', display:'block' }}>
                      📍 View delivery location
                    </button>
                  )}
                  <EditPendingSection item={d} type="delivery" />
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(d.created_at)}
                  </p>
                </Card>
              );
            })}
            {filteredDeliveries.length === 0 && (
              <p style={{ textAlign:'center', color:'#AAB7C4', marginTop:40 }}>No deliveries found</p>
            )}
          </>
        )}

        {/* ── Sales Log ── */}
        {tab === 'Sales Log' && (
          <>
            <FilterBar selected={salesLogFilter} onSelect={setSalesLogFilter} />
            <SearchInput value={salesLogSearch} onChange={setSalesLogSearch}
              placeholder="Search invoice, salesman, recipient…" />
            <p style={{ fontSize:11, color:'#5D6D7E', margin:'8px 0' }}>
              {filteredSalesLog.length} sales
            </p>
            {filteredSalesLog.map(s => {
              const col = salesmanColor(s.user_id, s.salesman_name, salesmen);
              const sc = s.status==='paid'
                ? { bg:'#D5F5E3', txt:'#145A32', lbl:'✓ Paid' }
                : s.status==='pending_approval'
                ? { bg:'#FDEBD0', txt:'#784212', lbl:'⏳ Pending' }
                : { bg:'#FADBD8', txt:'#922B21', lbl:'✗ Not Paid' };
              return (
                <Card key={s.id} leftColor={col}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <strong style={{ fontSize:14, color:'#1A252F' }}>{s.invoice_number}</strong>
                      {s.source === 'delivery' && (
                        <Badge color="#5B2C6F" bg="#F4ECFB">From Delivery</Badge>
                      )}
                    </div>
                    <span style={{ padding:'3px 8px', borderRadius:20,
                      background:col+'22', color:col, fontSize:10, fontWeight:800 }}>
                      {s.users?.name?.split(' ')[0] || s.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
{s.company_name && <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>Company: {s.company_name}</p>}
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>Delivered to: {s.delivered_to}</p>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Amount: {Number(s.amount||0).toFixed(2)} OMR
                  </p>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Payment: {pmLabel(s.payment_method)}
                  </p>
                  <Badge color={sc.txt} bg={sc.bg}>{sc.lbl}</Badge>
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(s.created_at)}
                  </p>
                </Card>
              );
            })}
            {filteredSalesLog.length === 0 && (
              <p style={{ textAlign:'center', color:'#AAB7C4', marginTop:40 }}>No sales found</p>
            )}
          </>
        )}

        {/* ── Not Paid ── */}
        {tab === 'Not Paid' && (
          <>
            <SearchInput value={notPaidSearch} onChange={setNotPaidSearch}
              placeholder="Search invoice, salesman, company…" />
            <p style={{ fontSize:11, color:'#5D6D7E', margin:'8px 0' }}>
              {filteredNotPaid.length} unpaid invoices
            </p>
            {filteredNotPaid.map(inv => {
              const isPending = inv.status === 'pending_approval';
              const col = salesmanColor(inv.user_id, inv.salesman_name, salesmen);
              return (
                <Card key={`${inv._source}-${inv.id}`} leftColor={isPending ? '#F39C12' : '#C0392B'}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <strong style={{ fontSize:14, color:'#1A252F' }}>{inv.invoice_number}</strong>
                      <Badge
                        color={inv._source==='sales' ? '#1A5276' : '#5B2C6F'}
                        bg={inv._source==='sales' ? '#EAF0FB' : '#F4ECFB'}>
                        {inv._source==='sales' ? 'Sale' : 'Delivery'}
                      </Badge>
                    </div>
                    <span style={{ padding:'3px 8px', borderRadius:20,
                      background:col+'22', color:col, fontSize:10, fontWeight:800 }}>
                      {inv.users?.name?.split(' ')[0] || inv.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  {inv.company_name && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>
                      Company: {inv.company_name}
                    </p>
                  )}
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Delivered to: {inv._to}
                  </p>
                  {inv.amount > 0 && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                      Amount: {Number(inv.amount).toFixed(2)} OMR
                    </p>
                  )}
                  {isPending && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                      Method claimed: {pmLabel(inv.payment_method)}
                    </p>
                  )}
                  <div style={{ marginTop:8 }}>
                    <Badge
                      color={isPending ? '#784212' : '#922B21'}
                      bg={isPending ? '#FDEBD0' : '#FADBD8'}>
                      {isPending ? '⏳ Pending approval' : '✗ Not Paid'}
                    </Badge>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    {isPending && (
                      <button onClick={() => handleApprove(inv)}
                        style={{ flex:1, padding:'9px 0', background:'#27AE60', color:'#fff',
                          border:'none', borderRadius:10, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                        ✓ Approve
                      </button>
                    )}
                    {true && (
                      <button
                        onClick={() => {
                          setAdminPayInv(inv);
                          setAdminPayType('cash');
                          setAdminCashType('cash');
                          setAdminPayOpen(true);
                        }}
                        style={{ flex:1, padding:'9px 0', background:'#2C3E50', color:'#fff',
                          border:'none', borderRadius:10, fontWeight:800, fontSize:13, cursor:'pointer' }}>
                        💳 Mark Paid
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(inv.created_at)}
                  </p>
                </Card>
              );
            })}
            {filteredNotPaid.length === 0 && (
              <p style={{ textAlign:'center', color:'#AAB7C4', marginTop:40 }}>
                No unpaid invoices 🎉
              </p>
            )}
          </>
        )}

        {/* ── Paid ── */}
        {tab === 'Paid' && (
          <>
            <FilterBar selected={paidFilter} onSelect={setPaidFilter}
              filters={[
                { key:'week', label:'This Week' },
                { key:'month', label:'This Month' },
                { key:'older', label:'Older' },
              ]} />
            <SearchInput value={paidSearch} onChange={setPaidSearch}
              placeholder="Search invoice, salesman, method…" />
            <p style={{ fontSize:11, color:'#5D6D7E', margin:'8px 0' }}>
              {filteredPaid.length} paid invoices
            </p>
            {filteredPaid.map(inv => {
              const col = salesmanColor(inv.user_id, inv.salesman_name, salesmen);
              return (
                <Card key={inv.id} leftColor="#27AE60">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <strong style={{ fontSize:14, color:'#1A252F' }}>{inv.invoice_number}</strong>
                    <span style={{ padding:'3px 8px', borderRadius:20,
                      background:col+'22', color:col, fontSize:10, fontWeight:800 }}>
                      {inv.users?.name?.split(' ')[0] || inv.salesman_name?.split(' ')[0] || 'Deleted'}
                    </span>
                  </div>
                  {inv.company_name && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>
                      Company: {inv.company_name}
                    </p>
                  )}
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Delivered to: {inv.delivered_person}
                  </p>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Payment: {pmLabel(inv.payment_method)}
                  </p>
                  {inv.approved_at && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                      Approved: {formatDate(inv.approved_at)}
                    </p>
                  )}
                  <Badge color="#145A32" bg="#D5F5E3">✓ Paid & Approved</Badge>
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(inv.created_at)}
                  </p>
                </Card>
              );
            })}
            {filteredPaid.length === 0 && (
              <p style={{ textAlign:'center', color:'#AAB7C4', marginTop:40 }}>
                No paid invoices found
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Notifications Modal ── */}
      <ModalSheet open={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications">
        {notifications.length === 0 && (
          <p style={{ color:'#AAB7C4', textAlign:'center' }}>No notifications</p>
        )}
        {notifications.slice(0, 15).map(n => (
          <div key={n.id} style={{ padding:12, borderRadius:12, marginBottom:8,
            background: n.is_read ? '#F9F9F9' : '#FFF5F5',
            borderLeft:`3px solid ${
              n.type==='tracking_on' ? '#27AE60'
              : n.type==='tracking_off' ? '#EA4335'
              : n.type==='edit_request' ? '#2C3E50'
              : '#F39C12'
            }` }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#1A252F' }}>{n.message}</p>
            <p style={{ margin:'4px 0 0', fontSize:10, color:'#AAB7C4' }}>
              {formatDateFull(n.created_at)}  ·  {timeAgo(n.created_at)}
            </p>
          </div>
        ))}
        {notifications.length > 15 && (
          <p style={{ textAlign:'center', color:'#5D6D7E', fontSize:12, fontWeight:600 }}>
            + {notifications.length - 15} older notifications
          </p>
        )}
      </ModalSheet>

      {/* ── Add Salesman Modal ── */}
      <ModalSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Salesman">
        <FormField label="Full Name" required>
          <Input value={newName} onChange={setNewName} placeholder="Full name" />
        </FormField>
        <FormField label="Email" required>
          <Input value={newEmail} onChange={setNewEmail} placeholder="email@alsahal.com" type="email" />
        </FormField>
        <FormField label="Password" required>
          <Input value={newPassword} onChange={setNewPassword} placeholder="••••••••" type="password" />
        </FormField>
        <FormField label="Sales Target — this month (OMR)">
          <Input value={newTarget} onChange={setNewTarget} placeholder="Optional" type="number" />
        </FormField>
        <InfoBox>Only admin can create salesman accounts.</InfoBox>
        <Btn onClick={handleAddSalesman} disabled={addLoading}>
          {addLoading ? 'Creating…' : 'Create Account'}
        </Btn>
      </ModalSheet>

      {/* ── Salesman Detail Modal ── */}
      <ModalSheet open={detailOpen} onClose={() => { setDetailOpen(false); setCredentials(null); }}
        title={selectedSalesman?.name || ''}>
        {selectedSalesman && (() => {
          const col = COLORS[salesmen.findIndex(s => s.id === selectedSalesman.id) % COLORS.length] || '#8E44AD';
          const tr = getTracking(selectedSalesman.id);
          const loc = getLocation(selectedSalesman.id);
          const isOn = tr?.is_tracking;
          const uniqueCompanies = [...new Set(salesmanVisits.map(v => v.company_name))].length;
          return (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:col,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontWeight:800, fontSize:18 }}>
                  {initials(selectedSalesman.name)}
                </div>
                <div>
                  <p style={{ margin:0, fontSize:16, fontWeight:800, color:'#1A252F' }}>
                    {selectedSalesman.name}
                  </p>
                  <p style={{ margin:'2px 0 0', fontSize:11, color:'#5D6D7E' }}>
                    {selectedSalesman.email}
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%',
                      background: isOn ? '#27AE60' : '#EA4335' }} />
                    <span style={{ fontSize:11, fontWeight:700,
                      color: isOn ? '#27AE60' : '#EA4335' }}>
                      {isOn ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <button onClick={() => handleViewCredentials(selectedSalesman)}
                style={{ width:'100%', padding:10, background:'#EAF0FB',
                  border:'1px solid #D0E4F7', borderRadius:10, fontSize:12,
                  fontWeight:700, color:'#2C3E50', cursor:'pointer', marginBottom:12 }}>
                {credLoading ? 'Loading…'
                  : credentials
                  ? `📧 ${credentials.email}   🔑 ${credentials.password_plain || '(not stored)'}`
                  : '👁 View Login Credentials'}
              </button>

              {/* Target */}
              <div style={{ background:'#F4F5F7', borderRadius:12, padding:14,
                marginBottom:12, border:'1px solid #EBEBEB' }}>
                <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700,
                  color:'#5D6D7E', letterSpacing:0.8 }}>
                  SALES TARGET · THIS MONTH
                </p>
                <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginTop:2 }}>
                  <span style={{ fontSize:22, fontWeight:800, color:'#2C3E50' }}>
                    {Number(salesmanTarget.achieved_amount||0).toFixed(0)}
                  </span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#5D6D7E', marginBottom:2 }}>
                    / {Number(salesmanTarget.target_amount||0).toFixed(0)} OMR
                  </span>
                </div>
                <div style={{ height:8, background:'#E8EAED', borderRadius:4,
                  marginTop:10, overflow:'hidden' }}>
                  <div style={{ height:8, background:'#27AE60', borderRadius:4,
                    width:`${salesmanTarget.target_amount > 0
                      ? Math.min(100,(salesmanTarget.achieved_amount/salesmanTarget.target_amount)*100)
                      : 0}%` }} />
                </div>
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <input value={targetInput} onChange={e => setTargetInput(e.target.value)}
                    placeholder="Set target (OMR)" type="number"
                    style={{ flex:1, padding:'8px 12px', borderRadius:10,
                      border:'1px solid #E8EAED', fontSize:13, outline:'none',
                      background:'#fff', color:'#1A252F' }} />
                  <button onClick={handleSaveTarget} disabled={targetSaving}
                    style={{ padding:'8px 18px', background:'#C0392B', color:'#fff',
                      border:'none', borderRadius:10, fontWeight:700, cursor:'pointer' }}>
                    {targetSaving ? '…' : 'Save'}
                  </button>
                </div>
              </div>

              {salesmanSummary && (
                <div style={{ marginBottom:12 }}>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    Today: {salesmanSummary.visits_today} visits · {salesmanSummary.deliveries_today} deliveries
                  </p>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    All-time: {salesmanSummary.visits_total} visits · {salesmanSummary.deliveries_total} deliveries
                  </p>
                </div>
              )}

              {/* Stats */}
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                {[
                  { label:'Visits', val: salesmanVisits.length, color:'#2C3E50' },
                  { label:'Companies', val: uniqueCompanies, color:'#27AE60' },
                  { label:'Deliveries', val: salesmanDeliveries.length, color:'#C0392B' },
                ].map(s => (
                  <div key={s.label} style={{ flex:1, background:'#F4F5F7',
                    borderRadius:12, padding:12, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:10, fontWeight:700, color:'#5D6D7E',
                      textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {isOn && (
                <button
                  onClick={() => loc
                    ? openMap(loc.lat, loc.lng, selectedSalesman.name)
                    : alert('No location data yet')}
                  style={{ width:'100%', padding:10, background:'#D5F5E3',
                    border:'1px solid #A9DFBF', borderRadius:10, fontSize:12,
                    fontWeight:700, color:'#145A32', cursor:'pointer', marginBottom:10 }}>
                  📍 Live Location {loc ? `· ${timeAgo(loc.recorded_at)}` : '· No data yet'}
                </button>
              )}

              <FilterBar selected={detailFilter} onSelect={setDetailFilter}
                filters={[
                  { key:'today', label:'Today' },
                  { key:'yesterday', label:'Yesterday' },
                  { key:'week', label:'This Week' },
                  { key:'month', label:'This Month' },
                  { key:'all', label:'All Time' },
                ]} />

              {salesmanVisits.length === 0 && salesmanDeliveries.length === 0 && (
                <p style={{ textAlign:'center', color:'#AAB7C4', marginTop:20 }}>No activity found</p>
              )}

              {salesmanVisits.map(v => (
                <Card key={v.id} leftColor={col}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <strong style={{ fontSize:13, color:'#1A252F' }}>{v.company_name}</strong>
                    <Badge color="#1A5276" bg="#EAF0FB">Visit</Badge>
                  </div>
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>
                    {v.contact_name} · {v.mobile}
                  </p>
                  {v.email_id && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>{v.email_id}</p>
                  )}
                  {v.quotation && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                      Quotation: {v.quotation_description}
                    </p>
                  )}
                  {v.lat && v.lng && (
                    <button onClick={() => openMap(v.lat, v.lng, v.company_name)}
                      style={{ marginTop:6, padding:'5px 10px', background:'#F4F5F7',
                        border:'1px solid #DDD', borderRadius:8, fontSize:11,
                        fontWeight:700, color:'#C0392B', cursor:'pointer' }}>
                      📍 View visit location
                    </button>
                  )}
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(v.visited_at)}
                  </p>
                </Card>
              ))}

              {salesmanDeliveries.map(d => (
                <Card key={d.id} leftColor={col}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <strong style={{ fontSize:13, color:'#1A252F' }}>{d.invoice_number}</strong>
                    <Badge color="#145A32" bg="#D5F5E3">Delivery</Badge>
                  </div>
                  {d.company_name && (
                    <p style={{ fontSize:12, color:'#5D6D7E', margin:'4px 0 2px' }}>
                      Company: {d.company_name}
                    </p>
                  )}
                  <p style={{ fontSize:12, color:'#5D6D7E', margin:'2px 0' }}>
                    To: {d.delivered_person} · {pmLabel(d.payment_method)}
                  </p>
                  {d.lat && d.lng && (
                    <button onClick={() => openMap(d.lat, d.lng, d.invoice_number)}
                      style={{ marginTop:6, padding:'5px 10px', background:'#F4F5F7',
                        border:'1px solid #DDD', borderRadius:8, fontSize:11,
                        fontWeight:700, color:'#C0392B', cursor:'pointer' }}>
                      📍 View delivery location
                    </button>
                  )}
                  <p style={{ fontSize:10, color:'#AAB7C4', marginTop:8, marginBottom:0 }}>
                    {formatDate(d.created_at)}
                  </p>
                </Card>
              ))}

              <button onClick={() => handleDeleteSalesman(selectedSalesman)}
                style={{ width:'100%', height:48, background:'#EA4335', color:'#fff',
                  border:'none', borderRadius:14, fontWeight:800, fontSize:14,
                  cursor:'pointer', marginTop:16 }}>
                Delete Salesman Account
              </button>
            </>
          );
        })()}
      </ModalSheet>

      {/* ── Admin Direct Mark Paid Modal ── */}
      <ModalSheet open={adminPayOpen} onClose={() => setAdminPayOpen(false)} title="Mark as Paid">
        <p style={{ fontSize:13, color:'#5D6D7E', textAlign:'center', marginTop:-8, marginBottom:16 }}>
          {adminPayInv?.invoice_number} · Admin override
        </p>
        <FormField label="Payment Method" required>
          <PayTypeSelector
            type={adminPayType} setType={setAdminPayType}
            cashT={adminCashType} setCashT={setAdminCashType} />
        </FormField>
        <InfoBox>
          This will immediately move the invoice to Paid without salesman action.
        </InfoBox>
        <Btn onClick={handleAdminMarkPaid}>Confirm & Move to Paid</Btn>
      </ModalSheet>

    </div>
  );
}