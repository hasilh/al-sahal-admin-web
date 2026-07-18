import { useState, useEffect } from 'react';
import {
  getVisits, logVisit, requestVisitEdit,
  getDeliveries, logDelivery, requestPayment, requestDeliveryEdit,
  getSalesLog, logSale, requestSalePayment, requestSaleEdit, 
  getNotPaidInvoices, getNotPaidSales,
  getSalesTarget, setTrackingStatus,
} from './api.js';
import {
  FilterBar, SearchInput, Badge, Card, ModalSheet,
  FormField, Input, Btn, InfoBox, PayTypeSelector, formatDate,
} from './App.jsx';

export default function SalesmanDashboard({ onLogout }) {
  const [tab, setTab] = useState('home');
  const [tracking, setTracking] = useState(false);

  const [startWorkModal, setStartWorkModal] = useState(false);
  const [endWorkModal, setEndWorkModal] = useState(false);
  const [vehicle, setVehicle] = useState('');
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [totalKm, setTotalKm] = useState(null);

  const [visits, setVisits] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [salesLog, setSalesLog] = useState([]);
  const [notPaid, setNotPaid] = useState([]);
  const [notPaidSales, setNotPaidSales] = useState([]);
  const [salesTarget, setSalesTargetState] = useState({ target_amount: 0, achieved_amount: 0 });

  const [visitFilter, setVisitFilter] = useState('today');
  const [deliveryFilter, setDeliveryFilter] = useState('today');
  const [salesLogFilter, setSalesLogFilter] = useState('today');
  const [visitSearch, setVisitSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [salesLogSearch, setSalesLogSearch] = useState('');
  const [notPaidSearch, setNotPaidSearch] = useState('');

  useEffect(() => { loadVisits(); }, [visitFilter]);
  useEffect(() => { loadDeliveries(); }, [deliveryFilter]);
  useEffect(() => { loadSalesLog(); }, [salesLogFilter]);
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    await Promise.all([loadVisits(), loadDeliveries(), loadSalesLog(), loadNotPaid(), loadTarget()]);
  };
  const loadVisits = async () => { try { setVisits(await getVisits(visitFilter)); } catch (e) {} };
  const loadDeliveries = async () => { try { setDeliveries(await getDeliveries(deliveryFilter)); } catch (e) {} };
  const loadSalesLog = async () => { try { setSalesLog(await getSalesLog(salesLogFilter)); } catch (e) {} };
  const loadTarget = async () => { try { setSalesTargetState(await getSalesTarget()); } catch (e) {} };
  const loadNotPaid = async () => {
    try {
      const [d, s] = await Promise.all([getNotPaidInvoices(), getNotPaidSales()]);
      setNotPaid(d); setNotPaidSales(s);
    } catch (e) {}
  };

  // ── Start/End Work ────────────────────────────────────────────
  const toggleTracking = () => {
    if (tracking) { setEndKm(''); setTotalKm(null); setEndWorkModal(true); }
    else { setVehicle(''); setStartKm(''); setStartWorkModal(true); }
  };
  const confirmStartWork = async () => {
    if (!vehicle.trim() || !startKm.trim()) return alert('Please enter the vehicle and starting KM.');
    try {
      await setTrackingStatus({ is_tracking: true, vehicle: vehicle.trim(), start_km: Number(startKm) });
      setTracking(true);
      setStartWorkModal(false);
    } catch (e) { alert('Failed to start work'); }
  };
  const confirmEndWork = async () => {
    if (!endKm.trim()) return alert('Please enter the ending KM.');
    try {
      await setTrackingStatus({ is_tracking: false, vehicle, start_km: Number(startKm), end_km: Number(endKm) });
      setTracking(false);
      setEndWorkModal(false);
    } catch (e) { alert('Failed to end work'); }
  };
  const handleEndKmBlur = () => {
    if (endKm.trim() && startKm.trim()) setTotalKm(Number(endKm) - Number(startKm));
    else setTotalKm(null);
  };

  // ── Visit modal ────────────────────────────────────────────────
  const [visitModal, setVisitModal] = useState(false);
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobile, setMobile] = useState('');
  const [emailId, setEmailId] = useState('');
  const [quotation, setQuotation] = useState(false);
  const [quotationDesc, setQuotationDesc] = useState('');

  const getLoc = () => new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null })
    );
  });

  const handleLogVisit = async () => {
    if (!company || !contactName || !mobile) return alert('Company name, contact name and mobile are required.');
    if (quotation && !quotationDesc) return alert('Please fill in quotation details.');
    try {
      const { lat, lng } = await getLoc();
      await logVisit({ company_name: company, contact_name: contactName, mobile, email_id: emailId, quotation, quotation_description: quotationDesc, lat, lng });
      setVisitModal(false);
      setCompany(''); setContactName(''); setMobile(''); setEmailId(''); setQuotation(false); setQuotationDesc('');
      loadVisits();
    } catch (e) { alert('Failed to save visit'); }
  };

  // ── Delivery modal ─────────────────────────────────────────────
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [deliveryCompany, setDeliveryCompany] = useState('');
  const [deliveredPerson, setDeliveredPerson] = useState('');
  const [deliveryAmount, setDeliveryAmount] = useState('');
  const [isMySale, setIsMySale] = useState(false);
  const [payType, setPayType] = useState('cash');
  const [cashType, setCashType] = useState('cash');

  const handleLogDelivery = async () => {
    if (!invoiceNo.trim() || !deliveredPerson.trim()) return alert('Invoice number and delivered person are required.');
    const pm = payType === 'cash' ? cashType : payType;
    try {
      const { lat, lng } = await getLoc();
      await logDelivery({
        invoice_number: invoiceNo.trim(), company_name: deliveryCompany.trim() || null,
        delivered_person: deliveredPerson.trim(), payment_method: pm,
        amount: Number(deliveryAmount) || 0, is_sale: isMySale, lat, lng,
      });
      setDeliveryModal(false);
      setInvoiceNo(''); setDeliveryCompany(''); setDeliveredPerson(''); setDeliveryAmount('');
      setIsMySale(false); setPayType('cash'); setCashType('cash');
      await loadDeliveries(); await loadNotPaid();
      if (isMySale) await loadSalesLog();
      if (pm !== 'not_paid') await loadTarget();
    } catch (e) { alert(e?.data?.error || 'Failed to save delivery'); }
  };

  // ── Sale modal ─────────────────────────────────────────────────
  const [saleModal, setSaleModal] = useState(false);
  const [saleInvoiceNo, setSaleInvoiceNo] = useState('');
  const [saleCompany, setSaleCompany] = useState('');
  const [saleDeliveredTo, setSaleDeliveredTo] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [salePayType, setSalePayType] = useState('cash');
  const [saleCashType, setSaleCashType] = useState('cash');

  const handleLogSale = async () => {
    if (!saleInvoiceNo.trim() || !saleDeliveredTo.trim()) return alert('Invoice number and delivered to are required.');
    const pm = salePayType === 'cash' ? saleCashType : salePayType;
    try {
      await logSale({
        invoice_number: saleInvoiceNo.trim(), company_name: saleCompany.trim() || null,
        delivered_to: saleDeliveredTo.trim(), amount: Number(saleAmount) || 0, payment_method: pm,
      });
      setSaleModal(false);
      setSaleInvoiceNo(''); setSaleCompany(''); setSaleDeliveredTo(''); setSaleAmount('');
      setSalePayType('cash'); setSaleCashType('cash');
      await loadSalesLog(); await loadNotPaid();
      if (pm !== 'not_paid') await loadTarget();
    } catch (e) { alert(e?.data?.error || 'Failed to save sale'); }
  };

  // ── Mark as paid (request) ──────────────────────────────────────
  const [payModal, setPayModal] = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [newPayType, setNewPayType] = useState('cash');
  const [newCashType, setNewCashType] = useState('cash');

  const handleRequestPayment = async () => {
    const pm = newPayType === 'cash' ? newCashType : newPayType;
    try {
      if (selectedInv._source === 'sales') await requestSalePayment(selectedInv.id, pm);
      else await requestPayment(selectedInv.id, pm);
      setPayModal(false);
      loadNotPaid();
    } catch (e) { alert('Failed to submit payment request'); }
  };

  const search = (list, term, keys) => {
    if (!term.trim()) return list;
    const t = term.toLowerCase();
    return list.filter(item => keys.some(k => (item[k] || '').toLowerCase().includes(t)));
  };
  const filteredVisits = search(visits, visitSearch, ['company_name','contact_name','mobile']);
  const filteredDeliveries = search(deliveries, deliverySearch, ['invoice_number','company_name','delivered_person']);
  const filteredSalesLog = search(salesLog, salesLogSearch, ['invoice_number','company_name','delivered_to']);
  const mergedNotPaid = [
    ...notPaid.map(i => ({ ...i, _source:'delivery', _to:i.delivered_person })),
    ...notPaidSales.map(i => ({ ...i, _source:'sales', _to:i.delivered_to })),
  ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const filteredNotPaid = search(mergedNotPaid, notPaidSearch, ['invoice_number','_to']);

  const TABS = [
    { key:'home', label:'Home', icon:'🏠' },
    { key:'visits', label:'Visits', icon:'📍' },
    { key:'delivery', label:'Delivery', icon:'🚚' },
    { key:'saleslog', label:'Sales Log', icon:'💰' },
    { key:'notpaid', label:'Not Paid', icon:'🧾' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#F4F5F7' }}>
      <div style={{ background:'#fff', borderBottom:'1px solid #EBEBEB', padding:'16px 20px',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:900, color:'#1A252F' }}>Al Sahal · Salesman</h1>
        </div>
        <button onClick={onLogout} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #DDD',
          background:'#fff', color:'#EA4335', fontWeight:700, fontSize:12, cursor:'pointer' }}>Sign Out</button>
      </div>

      <div style={{ display:'flex', gap:8, padding:'14px 20px 0', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer',
              background: tab===t.key ? '#C0392B' : '#fff', color: tab===t.key ? '#fff' : '#5D6D7E',
              fontWeight:700, fontSize:13, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:20 }}>
        {tab === 'home' && (
          <>
            <Card>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#5D6D7E', letterSpacing:0.8, marginBottom:10 }}>WORK STATUS</div>
                <button onClick={toggleTracking}
                  style={{ width:'100%', height:56, borderRadius:28, border:'none', cursor:'pointer',
                    background: tracking ? '#C0392B' : '#27AE60', color:'#fff', fontWeight:800, fontSize:15 }}>
                  {tracking ? 'Work Started — Click to Stop' : 'Start Work'}
                </button>
              </div>
            </Card>
            <Card>
              <div style={{ fontSize:10, fontWeight:700, color:'#5D6D7E', letterSpacing:0.8, marginBottom:6 }}>SALES TARGET · THIS MONTH</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                <span style={{ fontSize:22, fontWeight:800, color:'#2C3E50' }}>{Number(salesTarget.achieved_amount||0).toFixed(0)}</span>
                <span style={{ fontSize:13, color:'#5D6D7E' }}>/ {Number(salesTarget.target_amount||0).toFixed(0)} OMR</span>
              </div>
              <div style={{ height:8, background:'#E8EAED', borderRadius:4, marginTop:10, overflow:'hidden' }}>
                <div style={{ height:8, background:'#27AE60', borderRadius:4,
                  width:`${salesTarget.target_amount>0 ? Math.min(100,(salesTarget.achieved_amount/salesTarget.target_amount)*100) : 0}%` }} />
              </div>
            </Card>
          </>
        )}

        {tab === 'visits' && (
          <>
            <FilterBar selected={visitFilter} onSelect={setVisitFilter} />
            <SearchInput value={visitSearch} onChange={setVisitSearch} placeholder="Search company, contact, mobile…" />
            <div style={{ marginTop:12 }}>
              {filteredVisits.map(v => (
                <Card key={v.id}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{v.company_name}</div>
                  <div style={{ fontSize:12, color:'#5D6D7E', marginTop:4 }}>{v.contact_name} · {v.mobile}</div>
                  {v.quotation && <div style={{ marginTop:6 }}><Badge color="#1A5276" bg="#EAF0FB">Quotation sent</Badge></div>}
                  <div style={{ fontSize:10, color:'#AAB7C4', marginTop:8 }}>{formatDate(v.visited_at)}</div>
                </Card>
              ))}
              {filteredVisits.length === 0 && <p style={{ textAlign:'center', color:'#AAB7C4' }}>No visits found</p>}
            </div>
            <Btn onClick={() => setVisitModal(true)} style={{ marginTop:12 }}>+ New Visit</Btn>
          </>
        )}

        {tab === 'delivery' && (
          <>
            <FilterBar selected={deliveryFilter} onSelect={setDeliveryFilter} />
            <SearchInput value={deliverySearch} onChange={setDeliverySearch} placeholder="Search invoice, company, recipient…" />
            <div style={{ marginTop:12 }}>
              {filteredDeliveries.map(d => (
                <Card key={d.id}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{d.invoice_number}</div>
                  {d.company_name && <div style={{ fontSize:12, color:'#5D6D7E' }}>Company: {d.company_name}</div>}
                  <div style={{ fontSize:12, color:'#5D6D7E' }}>Delivered to: {d.delivered_person}</div>
                  <div style={{ fontSize:10, color:'#AAB7C4', marginTop:8 }}>{formatDate(d.created_at)}</div>
                </Card>
              ))}
              {filteredDeliveries.length === 0 && <p style={{ textAlign:'center', color:'#AAB7C4' }}>No deliveries found</p>}
            </div>
            <Btn onClick={() => setDeliveryModal(true)} style={{ marginTop:12 }}>+ New Delivery</Btn>
          </>
        )}

        {tab === 'saleslog' && (
          <>
            <FilterBar selected={salesLogFilter} onSelect={setSalesLogFilter} />
            <SearchInput value={salesLogSearch} onChange={setSalesLogSearch} placeholder="Search invoice, company, recipient…" />
            <div style={{ marginTop:12 }}>
              {filteredSalesLog.map(s => (
                <Card key={s.id}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{s.invoice_number}</div>
                  {s.company_name && <div style={{ fontSize:12, color:'#5D6D7E' }}>Company: {s.company_name}</div>}
                  <div style={{ fontSize:12, color:'#5D6D7E' }}>Delivered to: {s.delivered_to}</div>
                  <div style={{ fontSize:12, color:'#5D6D7E' }}>Amount: {Number(s.amount||0).toFixed(2)} OMR</div>
                  <div style={{ fontSize:10, color:'#AAB7C4', marginTop:8 }}>{formatDate(s.created_at)}</div>
                </Card>
              ))}
              {filteredSalesLog.length === 0 && <p style={{ textAlign:'center', color:'#AAB7C4' }}>No sales logged</p>}
            </div>
            <Btn onClick={() => setSaleModal(true)} style={{ marginTop:12 }}>+ New Sale</Btn>
          </>
        )}

        {tab === 'notpaid' && (
          <>
            <SearchInput value={notPaidSearch} onChange={setNotPaidSearch} placeholder="Search invoice, company…" />
            <div style={{ marginTop:12 }}>
              {filteredNotPaid.map(inv => {
                const isPending = inv.status === 'pending_approval';
                return (
                  <Card key={`${inv._source}-${inv.id}`} leftColor={isPending ? '#F39C12' : '#C0392B'}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{inv.invoice_number}</div>
                    {inv.company_name && <div style={{ fontSize:12, color:'#5D6D7E' }}>Company: {inv.company_name}</div>}
                    <div style={{ fontSize:12, color:'#5D6D7E' }}>Delivered to: {inv._to}</div>
                    <div style={{ marginTop:8 }}>
                      <Badge color={isPending ? '#784212' : '#922B21'} bg={isPending ? '#FDEBD0' : '#FADBD8'}>
                        {isPending ? '⏳ Waiting for admin approval' : '✗ Not Paid'}
                      </Badge>
                    </div>
                    {!isPending && (
                      <button onClick={() => { setSelectedInv(inv); setNewPayType('cash'); setNewCashType('cash'); setPayModal(true); }}
                        style={{ marginTop:10, width:'100%', padding:10, background:'#27AE60', color:'#fff',
                          border:'none', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                        Mark as Paid
                      </button>
                    )}
                  </Card>
                );
              })}
              {filteredNotPaid.length === 0 && <p style={{ textAlign:'center', color:'#AAB7C4' }}>No unpaid invoices 🎉</p>}
            </div>
          </>
        )}
      </div>

      {/* Start Work */}
      <ModalSheet open={startWorkModal} onClose={() => setStartWorkModal(false)} title="Start Work">
        <FormField label="Vehicle" required><Input value={vehicle} onChange={setVehicle} placeholder="e.g. Toyota Hilux - 123456" /></FormField>
        <FormField label="Starting KM" required><Input value={startKm} onChange={setStartKm} placeholder="Odometer reading" type="number" /></FormField>
        <Btn onClick={confirmStartWork}>Confirm & Start</Btn>
      </ModalSheet>

      {/* End Work */}
      <ModalSheet open={endWorkModal} onClose={() => setEndWorkModal(false)} title="End Work">
        <FormField label="Vehicle"><div style={{ padding:'10px 14px', background:'#F4F5F7', borderRadius:12 }}>{vehicle || '-'}</div></FormField>
        <FormField label="Starting KM"><div style={{ padding:'10px 14px', background:'#F4F5F7', borderRadius:12 }}>{startKm || '-'}</div></FormField>
        <FormField label="Ending KM" required>
          <input value={endKm} onChange={e => setEndKm(e.target.value)} onBlur={handleEndKmBlur} type="number"
            placeholder="Odometer reading"
            style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:'1px solid #E8EAED', fontSize:14, boxSizing:'border-box' }} />
        </FormField>
        {totalKm !== null && <InfoBox>Total distance travelled: {totalKm} KM</InfoBox>}
        <Btn onClick={confirmEndWork}>Confirm & End</Btn>
      </ModalSheet>

      {/* New Visit */}
      <ModalSheet open={visitModal} onClose={() => setVisitModal(false)} title="New Visit Log">
        <FormField label="Company Name" required><Input value={company} onChange={setCompany} /></FormField>
        <FormField label="Contact Name" required><Input value={contactName} onChange={setContactName} /></FormField>
        <FormField label="Mobile" required><Input value={mobile} onChange={setMobile} /></FormField>
        <FormField label="Email ID"><Input value={emailId} onChange={setEmailId} /></FormField>
        <FormField label="Quotation Required?">
          <input type="checkbox" checked={quotation} onChange={e => setQuotation(e.target.checked)} />
        </FormField>
        {quotation && (
          <FormField label="Quotation Details" required>
            <textarea value={quotationDesc} onChange={e => setQuotationDesc(e.target.value)}
              style={{ width:'100%', minHeight:80, padding:12, borderRadius:12, border:'1px solid #E8EAED', boxSizing:'border-box' }} />
          </FormField>
        )}
        <InfoBox>Your current location will be saved with this visit.</InfoBox>
        <Btn onClick={handleLogVisit}>Save Visit</Btn>
      </ModalSheet>

      {/* New Delivery */}
      <ModalSheet open={deliveryModal} onClose={() => setDeliveryModal(false)} title="New Delivery Log">
        <FormField label="Invoice Number" required><Input value={invoiceNo} onChange={setInvoiceNo} /></FormField>
        <FormField label="Company Name"><Input value={deliveryCompany} onChange={setDeliveryCompany} /></FormField>
        <FormField label="Delivered To" required><Input value={deliveredPerson} onChange={setDeliveredPerson} /></FormField>
        <FormField label="Amount (OMR)"><Input value={deliveryAmount} onChange={setDeliveryAmount} type="number" /></FormField>
        <FormField label="Also log as my sale?">
          <input type="checkbox" checked={isMySale} onChange={e => setIsMySale(e.target.checked)} />
        </FormField>
        <FormField label="Payment Method" required>
          <PayTypeSelector type={payType} setType={setPayType} cashT={cashType} setCashT={setCashType} />
        </FormField>
        <InfoBox>Your current location will be saved with this delivery.</InfoBox>
        <Btn onClick={handleLogDelivery}>Save Delivery</Btn>
      </ModalSheet>

      {/* New Sale */}
      <ModalSheet open={saleModal} onClose={() => setSaleModal(false)} title="New Sale Log">
        <FormField label="Invoice Number" required><Input value={saleInvoiceNo} onChange={setSaleInvoiceNo} /></FormField>
        <FormField label="Company Name"><Input value={saleCompany} onChange={setSaleCompany} /></FormField>
        <FormField label="Delivered To" required><Input value={saleDeliveredTo} onChange={setSaleDeliveredTo} /></FormField>
        <FormField label="Amount (OMR)"><Input value={saleAmount} onChange={setSaleAmount} type="number" /></FormField>
        <FormField label="Payment Method" required>
          <PayTypeSelector type={salePayType} setType={setSalePayType} cashT={saleCashType} setCashT={setSaleCashType} />
        </FormField>
        <Btn onClick={handleLogSale}>Save Sale</Btn>
      </ModalSheet>

      {/* Mark as Paid */}
      <ModalSheet open={payModal} onClose={() => setPayModal(false)} title="Mark as Paid">
        <p style={{ textAlign:'center', color:'#5D6D7E', fontSize:13 }}>{selectedInv?.invoice_number}</p>
        <FormField label="Payment Method" required>
          <PayTypeSelector type={newPayType} setType={setNewPayType} cashT={newCashType} setCashT={setNewCashType} />
        </FormField>
        <InfoBox>Invoice stays in Not Paid until admin approves.</InfoBox>
        <Btn onClick={handleRequestPayment}>Submit for Approval</Btn>
      </ModalSheet>
    </div>
  );
}