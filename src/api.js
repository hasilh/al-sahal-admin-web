const BASE_URL = 'https://al-sahal-tracker-backend.onrender.com';

export const getToken = () => localStorage.getItem('token');
export const saveToken = (t) => localStorage.setItem('token', t);
export const removeToken = () => localStorage.removeItem('token');
export const saveRole = (r) => localStorage.setItem('role', r);
export const getRole = () => localStorage.getItem('role');
export const removeRole = () => localStorage.removeItem('role');

async function request(path, { method = 'GET', body, params } = {}) {
  const token = getToken();
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const signin = (email, password) =>
  request('/api/auth/signin', { method: 'POST', body: { email, password } });

export const getLatestLocations = () => request('/api/location/latest');
export const getAllTrackingStatus = () => request('/api/tracking/all');

export const getVisits = (filter, user_id) =>
  request('/api/visits', { params: { filter, user_id } });

export const getDeliveries = (filter, user_id) =>
  request('/api/deliveries', { params: { filter, user_id } });

export const getNotPaidInvoices = () => request('/api/deliveries/not-paid');
export const getPaidInvoices = (filter) =>
  request('/api/deliveries/paid', { params: { filter } });

export const approvePayment = (id) =>
  request(`/api/deliveries/approve/${id}`, { method: 'PATCH' });

export const adminMarkPaid = (id, payment_method) =>
  request(`/api/deliveries/admin-mark-paid/${id}`, { method: 'PATCH', body: { payment_method } });

export const approveDeliveryEdit = (id, approve) =>
  request(`/api/deliveries/approve-edit/${id}`, { method: 'PATCH', body: { approve } });

export const approveVisitEdit = (id, approve) =>
  request(`/api/visits/${id}/approve-edit`, { method: 'PATCH', body: { approve } });

export const createSalesman = (name, email, password) =>
  request('/api/admin/create-salesman', { method: 'POST', body: { name, email, password } });

export const getSalesmen = () => request('/api/admin/salesmen');

export const getNotifications = () => request('/api/admin/notifications');
export const markNotificationsRead = () =>
  request('/api/admin/notifications/read', { method: 'PATCH' });

export const deleteSalesman = (id) =>
  request(`/api/admin/salesmen/${id}`, { method: 'DELETE' });

export const getSalesmanCredentials = (id) =>
  request(`/api/admin/salesmen/${id}/credentials`);

export const getSalesLog = (filter, user_id) =>
  request('/api/sales', { params: { filter, user_id } });
export const getNotPaidSales = () => request('/api/sales/not-paid');
export const approveSalePayment = (id) =>
  request(`/api/sales/approve/${id}`, { method: 'PATCH' });

export const getSalesTarget = (user_id, month) =>
  request('/api/admin/sales-target', { params: { user_id, month } });
export const setSalesTarget = (user_id, month, target_amount) =>
  request('/api/admin/sales-target', { method: 'POST', body: { user_id, month, target_amount } });

export const getSalesmanSummary = (id) =>
  request(`/api/admin/salesmen/${id}/summary`);

// ── Salesman-facing endpoints ──────────────────────────────────────
export const setTrackingStatus = (payload) =>
  request('/api/tracking/status', { method: 'POST', body: payload });
export const pingLocation = (lat, lng) =>
  request('/api/location/ping', { method: 'POST', body: { lat, lng } });

export const logVisit = (visitData) =>
  request('/api/visits', { method: 'POST', body: visitData });
export const requestVisitEdit = (id, data) =>
  request(`/api/visits/${id}/request-edit`, { method: 'PATCH', body: data });

export const logDelivery = (deliveryData) =>
  request('/api/deliveries', { method: 'POST', body: deliveryData });
export const requestPayment = (id, payment_method) =>
  request(`/api/deliveries/request-payment/${id}`, { method: 'PATCH', body: { payment_method } });
export const requestDeliveryEdit = (id, data) =>
  request(`/api/deliveries/request-edit/${id}`, { method: 'PATCH', body: data });

export const logSale = (saleData) =>
  request('/api/sales', { method: 'POST', body: saleData });
export const requestSalePayment = (id, payment_method) =>
  request(`/api/sales/request-payment/${id}`, { method: 'PATCH', body: { payment_method } });

export const adminMarkPaidSale = (id, payment_method) =>
  request(`/api/sales/admin-mark-paid/${id}`, { method: 'PATCH', body: { payment_method } });
export const getSalesTargetSelf = () => request('/api/admin/sales-target');
export const getMyTrackingStatus = () => request('/api/tracking/status');
export const deleteVisit = (id) =>
  request(`/api/visits/${id}`, { method: 'DELETE' });
export const deleteDelivery = (id) =>
  request(`/api/deliveries/${id}`, { method: 'DELETE' });
export const deleteSale = (id) =>
  request(`/api/sales/${id}`, { method: 'DELETE' });

export const requestSaleEdit = (id, data) =>
  request(`/api/sales/request-edit/${id}`, { method: 'PATCH', body: data });
export const approveSaleEdit = (id, approve) =>
  request(`/api/sales/approve-edit/${id}`, { method: 'PATCH', body: { approve } });

export const adminEditVisit = (id, data) =>
  request(`/api/visits/${id}/admin-edit`, { method: 'PATCH', body: data });
export const adminEditDelivery = (id, data) =>
  request(`/api/deliveries/${id}/admin-edit`, { method: 'PATCH', body: data });
export const adminEditSale = (id, data) =>
  request(`/api/sales/${id}/admin-edit`, { method: 'PATCH', body: data });