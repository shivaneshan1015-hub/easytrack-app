import { useState, useEffect, useRef, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useAuth, withAuth } from '../hooks/useAuth';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import * as XLSX from 'xlsx';
import Logo from '../components/Logo';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import StatWidget from '../components/ui/StatWidget';
import OfflineSyncWidget from '../components/ui/OfflineSyncWidget';

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>{label}</p>
        <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>
          ₹{parseFloat(payload[0].value).toLocaleString('en-IN')}
        </p>
      </div>
    );
  }
  return null;
};

// Chart component
function ChartView({ chartType, data }) {
  const last7 = data.slice(-7);
  const last30 = data.slice(-30);

  if (chartType === 'bar') {
    // Fill missing days with 0 for last 7 days
    const today = new Date();
    const days7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const found = last7.find(x => x.label === label);
      days7.push({ label, sales: found ? found.sales : 0 });
    }
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={days7} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} barSize={36}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="sales" fill="#2563eb" radius={[6, 6, 0, 0]}
            label={{ position: 'top', fontSize: 10, fill: '#64748b',
              formatter: v => v > 0 ? `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}` : '' }} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Line chart — 30 days
  const today = new Date();
  const days30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const found = last30.find(x => x.label === label);
    days30.push({ label, sales: found ? found.sales : 0 });
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={days30} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
          interval={4} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2}
          fill="url(#salesGrad)" dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#2563eb' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const InteractiveRouteMap = dynamic(() => import('../components/RouteMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
      Loading Map...
    </div>
  )
});

function OwnerDashboard() {
  const { supabase, profile, signOut } = useAuth();
  const isOwner = profile?.role === 'owner';
  const can = (perm) => isOwner || (profile?.permissions || []).includes(perm);
  const TAB_PERMISSION = { pending: 'today', history: 'dispatch', finance: 'finance', shops: 'shops', routes: 'routes', settings: 'settings' };
  const PERMISSION_OPTIONS = [
    { key: 'today', label: '🏠 Today' },
    { key: 'dispatch', label: '📜 Dispatch' },
    { key: 'finance', label: '📈 Financial Insights' },
    { key: 'shops', label: '🏪 Shops' },
    { key: 'shops_pricing', label: '💰 Shop Pricing' },
    { key: 'routes', label: '🗺️ Routes' },
    { key: 'settings', label: '⚙️ Settings' },
  ];
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'pending';
    return sessionStorage.getItem('et_dashboard_active_tab') || 'pending';
  });

  const [pendingOrders, setPendingOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [registeredShops, setRegisteredShops] = useState([]);
  const [productsCatalog, setProductsCatalog] = useState([]);
  const [allActiveProducts, setAllActiveProducts] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [agentsList, setAgentsList] = useState([]);
  const [isDeletingAgent, setIsDeletingAgent] = useState(null);
  const [newDispatcherName, setNewDispatcherName] = useState('');
  const [newDispatcherEmail, setNewDispatcherEmail] = useState('');
  const [isAddingDispatcher, setIsAddingDispatcher] = useState(false);
  const [dispatcherInviteMessage, setDispatcherInviteMessage] = useState('');
  const [dispatchersList, setDispatchersList] = useState([]);
  const [isDeletingDispatcher, setIsDeletingDispatcher] = useState(null);
  const [newDispatcherPermissions, setNewDispatcherPermissions] = useState([]);
  const [editingPermissionsFor, setEditingPermissionsFor] = useState(null);
  const [editPermissionsDraft, setEditPermissionsDraft] = useState([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [leaveAgentFilter, setLeaveAgentFilter] = useState('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [expandedLeaveGroups, setExpandedLeaveGroups] = useState({});
  const [selectedAgentProfile, setSelectedAgentProfile] = useState(null);
  const [agentProfileData, setAgentProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Route planner states
  const [routeAgent, setRouteAgent] = useState('');
  const [routeStartMode, setRouteStartMode] = useState('gps');
  const [routeStartCoords, setRouteStartCoords] = useState(null);
  const [customStartLat, setCustomStartLat] = useState('');
  const [customStartLng, setCustomStartLng] = useState('');
  const [isCapturingRouteGps, setIsCapturingRouteGps] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [routeTotalDistance, setRouteTotalDistance] = useState(0);

  const [shopsList, setShopsList] = useState([]);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [isAddingShop, setIsAddingShop] = useState(false);
  const [capturingGpsFor, setCapturingGpsFor] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState(null);
  const [logPaymentForm, setLogPaymentForm] = useState(null);

  const [selectedBillLedger, setSelectedBillLedger] = useState(null);
  const [billPaymentHistory, setBillPaymentHistory] = useState([]);

  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState(null);
  const [isReadyToPrint, setIsReadyToPrint] = useState(false);

  const [financials, setFinancials] = useState({
    totalSales: 0, totalCollected: 0, totalOutstanding: 0,
    cashCollected: 0, upiCollected: 0, chequeCollected: 0,
    agentRankings: {}, defaulterList: [], dailyTrend: [],
    shopPendingBills: [], topShops: [],
    aging07: 0, aging815: 0, aging1630: 0, aging30plus: 0
  });
  const [dateRange, setDateRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [returnsList, setReturnsList] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [expenseAgentFilter, setExpenseAgentFilter] = useState('all');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all');
  const [shopVisits, setShopVisits] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceLeaves, setAttendanceLeaves] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');
  const [shopDirSearch, setShopDirSearch] = useState('');
  const [shopsViewMode, setShopsViewMode] = useState('list');
  const [pricingShopId, setPricingShopId] = useState('');
  const [shopPricingRows, setShopPricingRows] = useState([]);
  const [savingShopPriceFor, setSavingShopPriceFor] = useState(null);
  const [settingsSubTab, setSettingsSubTab] = useState('team');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('all');
  const [ledgerAgentFilter, setLedgerAgentFilter] = useState('all');
  const [beatPlan, setBeatPlan] = useState([]);
  const [beatNewDay, setBeatNewDay] = useState('1');
  const [beatNewShop, setBeatNewShop] = useState('');
  const [beatNewAgent, setBeatNewAgent] = useState('');
  const [isAddingBeat, setIsAddingBeat] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedAgentForOrder, setSelectedAgentForOrder] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Invoice Settings States
  const [invoiceSettings, setInvoiceSettings] = useState({
    company_name: 'EasyTrack Distributors',
    address: 'Madurai, Tamil Nadu, India',
    phone: '',
    gst_number: '',
    upi_id: '',
    logo_url: '',
    template_mode: 'custom'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [toasts, setToasts] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [emailModal, setEmailModal] = useState(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState('');
  const [restockModal, setRestockModal] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [briefing, setBriefing] = useState(null);
  const [agentTargets, setAgentTargets] = useState([]);
  const [targetModal, setTargetModal] = useState(null);
  const [agentPerf, setAgentPerf] = useState({ today: {}, week: {} });
  const [agentPerfView, setAgentPerfView] = useState('today');
  const [agentPerfMonth, setAgentPerfMonth] = useState({});
  const [creditAlerts, setCreditAlerts] = useState([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleNavClick = (tab) => {
    if (!can(TAB_PERMISSION[tab] || tab)) return;
    setActiveTab(tab);
    if (isMobile) setSidebarOpen(false);
  };

  const overdueRef = useRef(null);

  const addToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const waLink = (phone, message) => {
    if (!phone) return null;
    let n = phone.replace(/[\s\-\(\)\+]/g, '');
    if (n.length === 10) n = '91' + n;
    return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
  };

  async function loadPendingOrders() {
    setIsLoading(true);
    const { data } = await supabase.from('transactions')
      .select(`id, bill_number, employee_name, bill_amount, created_at, shops ( id, name, phone_number )`)
      .eq('status', 'draft').order('created_at', { ascending: false });
    if (data) setPendingOrders(data);
    setIsLoading(false);
  }

  async function loadDailyBriefing() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [dispatchedRes, collectedRes, outstandingRes] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact' }).eq('status', 'approved'),
      supabase.from('transactions')
        .select('amount_received')
        .eq('status', 'delivered')
        .gte('delivered_at', todayStart.toISOString()),
      supabase.from('transactions')
        .select('bill_number, bill_amount, pending_amount, created_at, shops(name)')
        .eq('status', 'delivered')
        .gt('pending_amount', 0),
    ]);

    const dispatchedCount = dispatchedRes.count || 0;
    const collectedToday = (collectedRes.data || []).reduce((s, t) => s + parseFloat(t.amount_received || 0), 0);
    const outstandingBills = outstandingRes.data || [];
    const totalOutstanding = outstandingBills.reduce((s, t) => s + parseFloat(t.pending_amount || 0), 0);
    const uniqueShops = new Set(outstandingBills.map(b => b.shops?.name)).size;

    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const urgent = outstandingBills
      .filter(b => new Date(b.created_at) < fifteenDaysAgo)
      .sort((a, b) => parseFloat(b.pending_amount) - parseFloat(a.pending_amount))
      .slice(0, 3);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    setBriefing({ dispatchedCount, collectedToday, totalOutstanding, uniqueShops, urgent, greeting });
  }

  async function loadHistoryLedger() {
    setIsLoading(true);
    const { data } = await supabase.from('transactions')
      .select(`id, bill_number, employee_name, bill_amount, amount_received, pending_amount, status, payment_mode, delivered_at, shops ( id, name, phone_number )`)
      .in('status', ['approved', 'delivered']).order('created_at', { ascending: false });
    if (data) setHistoryOrders(data);
    setIsLoading(false);
  }

  async function calculateFinancialMetrics(range) {
    setIsLoading(true);
    const activeRange = range || dateRange;

    // Build date filter
    let fromDate = null;
    const now = new Date();
    if (activeRange === 'today') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (activeRange === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      fromDate = d.toISOString();
    } else if (activeRange === 'month') {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      fromDate = d.toISOString();
    } else if (activeRange === 'custom' && customFrom) {
      fromDate = new Date(customFrom).toISOString();
    }

    let query = supabase.from('transactions')
      .select('id, bill_number, bill_amount, amount_received, pending_amount, payment_mode, employee_name, created_at, shops(id, name)')
      .in('status', ['approved', 'delivered']);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (activeRange === 'custom' && customTo) query = query.lte('created_at', new Date(customTo + 'T23:59:59').toISOString());

    const { data } = await query;
    if (data) {
      let salesSum = 0, collectedSum = 0, creditSum = 0, cashSum = 0, upiSum = 0, chequeSum = 0;
      let agents = {}, shopsDebt = {}, shopSales = {}, dailyMap = {}, shopPendingBills = [];
      const today = new Date();

      data.forEach(tx => {
        const amtValue = parseFloat(tx.bill_amount || 0);
        const recValue = parseFloat(tx.amount_received || 0);
        const pendValue = parseFloat(tx.pending_amount || 0);
        salesSum += amtValue; collectedSum += recValue; creditSum += pendValue;

        const mode = (tx.payment_mode || 'Cash').toLowerCase();
        if (mode.includes('cash')) cashSum += recValue;
        else if (mode.includes('upi') || mode.includes('gpay') || mode.includes('phonepe')) upiSum += recValue;
        else if (mode.includes('cheque')) chequeSum += recValue;

        // Agent stats
        if (tx.employee_name) {
          if (!agents[tx.employee_name]) agents[tx.employee_name] = { sales: 0, collected: 0, count: 0 };
          agents[tx.employee_name].sales += amtValue;
          agents[tx.employee_name].collected += recValue;
          agents[tx.employee_name].count += 1;
        }

        // Shop sales for top shops
        const shopName = tx.shops?.name || 'Unknown';
        if (!shopSales[shopName]) shopSales[shopName] = 0;
        shopSales[shopName] += amtValue;

        // Daily trend
        const dayKey = new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (!dailyMap[dayKey]) dailyMap[dayKey] = { label: dayKey, sales: 0, date: new Date(tx.created_at) };
        dailyMap[dayKey].sales += amtValue;

        // Shop pending bills
        if (pendValue > 0) {
          shopPendingBills.push({
            billNumber: tx.bill_number,
            shopName: shopName,
            date: new Date(tx.created_at).toLocaleDateString('en-IN'),
            total: amtValue,
            pending: pendValue,
            createdAt: new Date(tx.created_at)
          });
        }
      });

      // Credit aging
      let aging07 = 0, aging815 = 0, aging1630 = 0, aging30plus = 0;
      shopPendingBills.forEach(bill => {
        const days = Math.floor((today - bill.createdAt) / (1000 * 60 * 60 * 24));
        if (days <= 7) aging07 += bill.pending;
        else if (days <= 15) aging815 += bill.pending;
        else if (days <= 30) aging1630 += bill.pending;
        else aging30plus += bill.pending;
      });

      // Top shops
      const topShops = Object.entries(shopSales)
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales).slice(0, 8);

      // Daily trend sorted
      const dailyTrend = Object.values(dailyMap)
        .sort((a, b) => a.date - b.date);

      const sortedDefaulters = Object.entries(shopsDebt)
        .map(([name, balance]) => ({ name, balance }))
        .sort((a, b) => b.balance - a.balance).slice(0, 5);

      setFinancials({
        totalSales: salesSum, totalCollected: collectedSum, totalOutstanding: creditSum,
        cashCollected: cashSum, upiCollected: upiSum, chequeCollected: chequeSum,
        agentRankings: agents, defaulterList: sortedDefaulters,
        dailyTrend, shopPendingBills, topShops,
        aging07, aging815, aging1630, aging30plus
      });
    }
    setIsLoading(false);
  }

  async function loadRouteMapLocations() {
    setIsLoading(true);
    const { data } = await supabase.from('shops').select('id, name, phone_number, address, latitude, longitude').order('name', { ascending: true });
    if (data) setRegisteredShops(data);
    setIsLoading(false);
  }

  async function loadMasterProducts() {
    setIsLoading(true);
    const { data } = await supabase.from('products').select('id, name, unit_price, inventory_stock, is_active, low_stock_threshold').order('name', { ascending: true });
    if (data) setProductsCatalog(data);
    setIsLoading(false);
  }

  async function loadShopPrices(shopId) {
    setPricingShopId(shopId);
    if (!shopId) { setShopPricingRows([]); return; }
    const { data: overrides } = await supabase.from('shop_product_prices').select('id, product_id, price').eq('shop_id', shopId);
    const overrideMap = (overrides || []).reduce((m, o) => { m[o.product_id] = o; return m; }, {});
    const rows = productsCatalog
      .filter(p => p.is_active)
      .map(p => ({
        productId: p.id,
        name: p.name,
        mrp: p.unit_price,
        overrideId: overrideMap[p.id]?.id || null,
        price: overrideMap[p.id] ? parseFloat(overrideMap[p.id].price) : p.unit_price,
      }));
    setShopPricingRows(rows);
  }

  async function saveShopPrice(row) {
    if (!pricingShopId) return;
    const price = parseFloat(row.price);
    if (!(price > 0)) return alert('Enter a price greater than 0.');
    setSavingShopPriceFor(row.productId);
    const { error } = await supabase.from('shop_product_prices')
      .upsert([{ shop_id: pricingShopId, product_id: row.productId, price }], { onConflict: 'shop_id,product_id' });
    setSavingShopPriceFor(null);
    if (error) return alert('Save failed: ' + error.message);
    addToast(`✅ Price saved for ${row.name}`);
    loadShopPrices(pricingShopId);
  }

  async function resetShopPriceToMrp(row) {
    if (!pricingShopId || !row.overrideId) return;
    if (!window.confirm(`Reset "${row.name}" back to MRP for this shop?`)) return;
    setSavingShopPriceFor(row.productId);
    const { error } = await supabase.from('shop_product_prices').delete().eq('id', row.overrideId);
    setSavingShopPriceFor(null);
    if (error) return alert('Reset failed: ' + error.message);
    addToast(`✅ Reset to MRP`);
    loadShopPrices(pricingShopId);
  }

  useEffect(() => {
    const stockChannel = supabase
      .channel('product-stock-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        const p = payload.new;
        const threshold = p.low_stock_threshold || 10;
        if (p.is_active && threshold > 0 && p.inventory_stock <= threshold) {
          addToast(`⚠️ Low stock: ${p.name} — only ${p.inventory_stock} unit${p.inventory_stock === 1 ? '' : 's'} left`);
        }
      })
      .subscribe();

    // Return/damage notifications — poll every 10 s
    // lastSeenTimestamp is seeded from server to avoid client/server clock skew
    let lastSeenTimestamp = null;

    const notifyReturn = (r) => {
      const icon = r.return_type === 'return' ? '↩' : '⚠️';
      const label = r.return_type === 'return' ? 'Return' : 'Damage';
      addToast(`${icon} ${label} recorded by ${r.agent_name} — ₹${parseFloat(r.total_credit || 0).toLocaleString('en-IN')}${r.reason ? ` · ${r.reason}` : ''}`);
      loadReturns();
    };

    const pollReturns = async () => {
      if (lastSeenTimestamp === null) return;
      const { data } = await supabase
        .from('returns')
        .select('id, return_type, reason, total_credit, agent_name, created_at')
        .gt('created_at', lastSeenTimestamp)
        .order('created_at', { ascending: true });
      if (!data || data.length === 0) return;
      data.forEach(r => notifyReturn(r));
      lastSeenTimestamp = data[data.length - 1].created_at;
    };

    // Seed lastSeenTimestamp from server clock (latest return's created_at)
    supabase.from('returns').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        lastSeenTimestamp = data?.[0]?.created_at || new Date(0).toISOString();
      });

    const pollTimer = setInterval(pollReturns, 10000);

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(stockChannel);
    };
  }, []);

  async function loadActiveAgentsList() {
    const { data } = await supabase.from('employees').select('id, name').order('name', { ascending: true });
    if (data) setActiveAgents(data);
  }


  async function loadAgentsList(role = 'agent') {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, permissions, created_at")
      .eq("role", role)
      .order("full_name", { ascending: true });
    if (!data) return;
    if (role !== 'agent') { setDispatchersList(data); return; }
    // Get bill counts for each agent
    const agentsWithCounts = await Promise.all(data.map(async (agent) => {
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact" })
        .eq("employee_name", agent.full_name);
      return { ...agent, billCount: count || 0 };
    }));
    setAgentsList(agentsWithCounts);
  }

  async function loadAgentPerformance() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('transactions')
      .select('employee_name, bill_amount, amount_received, delivered_at')
      .eq('status', 'delivered')
      .gte('delivered_at', monthStart.toISOString());
    const week = {}, today = {}, month = {};
    (data || []).forEach(t => {
      const n = t.employee_name; if (!n) return;
      if (!month[n]) month[n] = { bills: 0, sales: 0, collected: 0 };
      month[n].bills++;
      month[n].sales += parseFloat(t.bill_amount || 0);
      month[n].collected += parseFloat(t.amount_received || 0);
      const dt = t.delivered_at ? new Date(t.delivered_at) : null;
      if (dt && dt >= weekStart) {
        if (!week[n]) week[n] = { bills: 0, sales: 0, collected: 0 };
        week[n].bills++;
        week[n].sales += parseFloat(t.bill_amount || 0);
        week[n].collected += parseFloat(t.amount_received || 0);
      }
      if (dt && dt >= todayStart) {
        if (!today[n]) today[n] = { bills: 0, sales: 0, collected: 0 };
        today[n].bills++;
        today[n].sales += parseFloat(t.bill_amount || 0);
        today[n].collected += parseFloat(t.amount_received || 0);
      }
    });
    setAgentPerf({ today, week });
    setAgentPerfMonth(month);
  }

  async function loadAgentTargets() {
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from('agent_targets').select('*').eq('month', month);
    if (data) setAgentTargets(data);
  }

  const handleSaveTarget = async () => {
    if (!targetModal) return;
    const { error } = await supabase.from('agent_targets').upsert([{
      agent_name: targetModal.agentName,
      month: targetModal.month,
      sales_target: parseFloat(targetModal.salesTarget) || 0,
      collection_target: parseFloat(targetModal.collectionTarget) || 0,
    }], { onConflict: 'agent_name,month' });
    if (error) return alert('Failed to save target: ' + error.message);
    addToast(`✅ Target saved for ${targetModal.agentName}`);
    setTargetModal(null);
    loadAgentTargets();
  };

  async function handleDeleteAgent(agent) {
    if (!window.confirm(`Remove agent "${agent.full_name}"? They will lose login access but all their past bills will be preserved.`)) return;
    setIsDeletingAgent(agent.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/delete-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: agent.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast(`✅ Agent "${agent.full_name}" removed. Their bills are preserved.`);
      loadAgentsList();
    } catch (err) {
      alert("Failed to remove agent: " + err.message);
    } finally {
      setIsDeletingAgent(null);
    }
  }

  async function handleDeleteDispatcher(dispatcher) {
    if (!window.confirm(`Remove dispatcher "${dispatcher.full_name}"? They will lose login access.`)) return;
    setIsDeletingDispatcher(dispatcher.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/delete-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: dispatcher.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast(`✅ Dispatcher "${dispatcher.full_name}" removed.`);
      loadAgentsList('dispatcher');
    } catch (err) {
      alert("Failed to remove dispatcher: " + err.message);
    } finally {
      setIsDeletingDispatcher(null);
    }
  }

  async function loadReturns() {
    const { data } = await supabase
      .from('returns')
      .select('id, return_type, reason, total_credit, created_at, agent_name, transaction_id, transactions(bill_number, shops(name)), return_items(product_name, quantity, unit_price)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setReturnsList(data);
  }

  async function loadAttendance(date) {
    const [{ data: attData }, { data: leaveData }] = await Promise.all([
      supabase.from('attendance').select('agent_name, marked_at, note').eq('date', date),
      supabase.from('leaves').select('agent_name').eq('leave_date', date).eq('status', 'approved'),
    ]);
    setAttendance(attData || []);
    setAttendanceLeaves(leaveData || []);
  }

  async function loadShopVisits() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('shop_visits')
      .select('id, agent_name, shop_id, shop_name, visited_at, outcome, note, latitude, longitude, shops(latitude, longitude)')
      .gte('visited_at', todayStart.toISOString())
      .order('visited_at', { ascending: false });
    if (data) setShopVisits(data);
  }

  async function loadExpenses() {
    const { data } = await supabase.from('agent_expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (data) setAllExpenses(data);
  }

  async function handleExpenseAction(id, newStatus) {
    const { error } = await supabase.from('agent_expenses').update({ status: newStatus }).eq('id', id);
    if (error) return alert('Failed: ' + error.message);
    setAllExpenses(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    addToast(`✅ Expense ${newStatus}`);
  }

  async function loadShops() {
    setIsLoading(true);
    const [{ data: shopsData }, { data: openTx }, { data: partialTx }] = await Promise.all([
      supabase.from('shops').select('*').order('name', { ascending: true }),
      supabase.from('transactions').select('shop_id, bill_amount').in('status', ['draft', 'approved']),
      supabase.from('transactions').select('shop_id, pending_amount').eq('status', 'delivered').gt('pending_amount', 0),
    ]);
    if (shopsData) {
      const withCredit = shopsData.map(shop => {
        const openUsed = (openTx || []).filter(tx => tx.shop_id === shop.id).reduce((s, tx) => s + parseFloat(tx.bill_amount || 0), 0);
        const partialUsed = (partialTx || []).filter(tx => tx.shop_id === shop.id).reduce((s, tx) => s + parseFloat(tx.pending_amount || 0), 0);
        return { ...shop, credit_used: openUsed + partialUsed };
      });
      setShopsList(withCredit);
    }
    setIsLoading(false);
  }

  async function loadCreditAlerts() {
    const [{ data: shops }, { data: openTx }, { data: partialTx }] = await Promise.all([
      supabase.from('shops').select('id, name, credit_limit').gt('credit_limit', 0),
      supabase.from('transactions').select('shop_id, bill_amount').in('status', ['draft', 'approved']),
      supabase.from('transactions').select('shop_id, pending_amount').eq('status', 'delivered').gt('pending_amount', 0),
    ]);
    const alerts = (shops || []).map(shop => {
      const openUsed = (openTx || []).filter(t => t.shop_id === shop.id).reduce((s, t) => s + parseFloat(t.bill_amount || 0), 0);
      const partialUsed = (partialTx || []).filter(t => t.shop_id === shop.id).reduce((s, t) => s + parseFloat(t.pending_amount || 0), 0);
      const creditUsed = openUsed + partialUsed;
      const limit = parseFloat(shop.credit_limit);
      const pct = limit > 0 ? (creditUsed / limit) * 100 : 0;
      return { ...shop, creditUsed, limit, pct };
    }).filter(s => s.pct >= 80).sort((a, b) => b.pct - a.pct);
    setCreditAlerts(alerts);
  }

  async function loadBeatPlan() {
    const { data } = await supabase
      .from('beat_plans')
      .select('id, day_of_week, employee_name, shop_id, shops(name)')
      .order('day_of_week', { ascending: true });
    if (data) setBeatPlan(data);
  }

  async function loadInvoiceSettings() {
    setIsLoading(true);
    const { data } = await supabase.from('invoice_settings')
      .select('*').eq('owner_id', profile?.id ?? '').maybeSingle();
    if (data) {
      setInvoiceSettings(data);
      if (data.template_mode === 'upload' && data.logo_url) setLetterheadUrl(data.logo_url);
    }
    setIsLoading(false);
  }

  async function loadBillPayments(order) {
    setIsLoading(true);
    setSelectedBillLedger(order);
    const { data } = await supabase.from('bill_payments')
      .select('amount, payment_mode, paid_at')
      .eq('transaction_id', order.id).order('paid_at', { ascending: true });
    if (data) setBillPaymentHistory(data);
    setIsLoading(false);
  }

  async function fetchAndPrintInvoice(order) {
    setIsLoading(true);
    setIsReadyToPrint(false);
    const { data, error } = await supabase.from('transaction_items')
      .select(`quantity, total_price, products ( name, unit_price )`)
      .eq('transaction_id', order.id);
    if (error) { alert("Failed to load invoice."); setIsLoading(false); return; }
    setSelectedPrintInvoice({ ...order, items: data || [] });
    setIsReadyToPrint(true);
    setIsLoading(false);
  }

  useEffect(() => {
    if (isReadyToPrint && selectedPrintInvoice) {
      window.print();
      setIsReadyToPrint(false);
      setSelectedPrintInvoice(null);
    }
  }, [isReadyToPrint, selectedPrintInvoice]);

  useEffect(() => {
    try { sessionStorage.setItem('et_dashboard_active_tab', activeTab); } catch (_) {}
    setSelectedOrder(null);
    setSelectedBillLedger(null);
    setSelectedAgentForOrder('');
    setDeliveryForm(null);
    loadPendingLeaveRequests();
    if (activeTab === 'pending') { loadPendingOrders(); loadActiveAgentsList(); loadDailyBriefing(); loadCreditAlerts(); }
    else if (activeTab === 'history') loadHistoryLedger();
    else if (activeTab === 'finance') { calculateFinancialMetrics(dateRange); loadReturns(); loadAgentTargets(); loadExpenses(); }
    else if (activeTab === 'shops') { loadShops(); loadRouteMapLocations(); loadActiveAgentsList(); if (can('shops')) loadMasterProducts(); }
    else if (activeTab === 'routes') { loadBeatPlan(); loadShops(); loadActiveAgentsList(); loadRouteMapLocations(); }
    else if (activeTab === 'settings') { loadMasterProducts(); loadActiveAgentsList(); loadAgentsList('agent'); loadAgentsList('dispatcher'); loadAllLeaveRequests(); loadAgentTargets(); loadAgentPerformance(); loadShopVisits(); loadAttendance(attendanceDate); loadInvoiceSettings(); }
  }, [activeTab]);

  const handleSaveInvoiceSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSaved('');
    try {
      const payload = { ...invoiceSettings, owner_id: profile?.id, updated_at: new Date().toISOString() };
      const { data: existing } = await supabase.from('invoice_settings').select('id').eq('owner_id', profile?.id).maybeSingle();
      if (existing) {
        await supabase.from('invoice_settings').update(payload).eq('owner_id', profile?.id);
      } else {
        await supabase.from('invoice_settings').insert([payload]);
      }
      setSettingsSaved('✅ Settings saved successfully!');
    } catch (err) {
      setSettingsSaved('❌ Failed to save: ' + err.message);
    } finally { setIsSavingSettings(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
      return alert('Only PNG, JPG, or SVG images allowed for logo.');
    }
    setIsUploadingLogo(true);
    const fileName = `logo-${profile?.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('invoice-assets').upload(fileName, file, { upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setIsUploadingLogo(false); return; }
    const { data: urlData } = supabase.storage.from('invoice-assets').getPublicUrl(fileName);
    setInvoiceSettings({ ...invoiceSettings, logo_url: urlData.publicUrl });
    setIsUploadingLogo(false);
  };

  const handleLetterheadUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'].includes(file.type)) {
      return alert('Only PNG, JPG, or PDF files allowed for letterhead.');
    }
    setIsUploadingLetterhead(true);
    const fileName = `letterhead-${profile?.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('invoice-assets').upload(fileName, file, { upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setIsUploadingLetterhead(false); return; }
    const { data: urlData } = supabase.storage.from('invoice-assets').getPublicUrl(fileName);
    setLetterheadUrl(urlData.publicUrl);
    setInvoiceSettings({ ...invoiceSettings, logo_url: urlData.publicUrl, template_mode: 'upload' });
    setIsUploadingLetterhead(false);
  };

  const handleInviteAgent = async () => {
    if (!newAgentName.trim() || !newAgentEmail.trim()) return alert('Please enter both name and email.');
    setIsAddingAgent(true); setInviteMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/invite-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newAgentEmail.trim(), full_name: newAgentName.trim(), role: 'agent' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteMessage(`✅ Invitation sent to ${newAgentEmail}`);
      setNewAgentName(''); setNewAgentEmail('');
    } catch (err) { setInviteMessage(`❌ Error: ${err.message}`); }
    finally { setIsAddingAgent(false); }
  };

  const handleInviteDispatcher = async () => {
    if (!newDispatcherName.trim() || !newDispatcherEmail.trim()) return alert('Please enter both name and email.');
    setIsAddingDispatcher(true); setDispatcherInviteMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/invite-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newDispatcherEmail.trim(), full_name: newDispatcherName.trim(), role: 'dispatcher', permissions: newDispatcherPermissions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDispatcherInviteMessage(`✅ Invitation sent to ${newDispatcherEmail}`);
      setNewDispatcherName(''); setNewDispatcherEmail(''); setNewDispatcherPermissions([]);
      loadAgentsList('dispatcher');
    } catch (err) { setDispatcherInviteMessage(`❌ Error: ${err.message}`); }
    finally { setIsAddingDispatcher(false); }
  };

  const handleUpdatePermissions = async (dispatcherId) => {
    setIsSavingPermissions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/update-permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: dispatcherId, permissions: editPermissionsDraft })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast('✅ Access updated');
      setEditingPermissionsFor(null);
      loadAgentsList('dispatcher');
    } catch (err) { alert('Failed to update access: ' + err.message); }
    finally { setIsSavingPermissions(false); }
  };

  const handleReviewClick = async (order) => {
    setSelectedOrder(order);
    // Load existing order items
    const { data } = await supabase.from('transaction_items')
      .select(`id, quantity, total_price, products ( id, name, unit_price, inventory_stock )`)
      .eq('transaction_id', order.id);

    if (data) {
      // For each item, fetch the LATEST stock from products table
      const itemsWithLiveStock = await Promise.all(data.map(async (item) => {
        const { data: liveProduct } = await supabase
          .from('products')
          .select('inventory_stock, is_active')
          .eq('id', item.products?.id)
          .single();
        return {
          ...item,
          // Preserve whatever this line was actually sold at (MRP or a negotiated shop rate) —
          // must NOT be re-derived from products.unit_price, which can drift from the sale price.
          unit_price_used: item.quantity > 0 ? item.total_price / item.quantity : (item.products?.unit_price || 0),
          products: {
            ...item.products,
            inventory_stock: liveProduct ? liveProduct.inventory_stock : 0
          }
        };
      }));
      setOrderItems(itemsWithLiveStock);
    }
  };

  const handleAddProductToOrder = async (productId) => {
    if (!productId) return;
    const prod = allActiveProducts.find(p => p.id === productId);
    if (!prod) return;
    // Check if already in order
    const existing = orderItems.find(item => item.products?.id === productId);
    if (existing) return alert(`${prod.name} is already in this order. Update the quantity instead.`);
    // Respect a locked shop price if one exists for this product, else fall back to MRP
    let unitPrice = prod.unit_price;
    const shopId = selectedOrder?.shops?.id;
    if (shopId) {
      const { data: override } = await supabase.from('shop_product_prices')
        .select('price').eq('shop_id', shopId).eq('product_id', productId).maybeSingle();
      if (override) unitPrice = parseFloat(override.price);
    }
    // Add as new item (no id means it will be inserted)
    setOrderItems([...orderItems, {
      id: null,
      isNew: true,
      product_id: productId,
      quantity: 1,
      total_price: unitPrice,
      unit_price_used: unitPrice,
      products: { id: productId, name: prod.name, unit_price: prod.unit_price, inventory_stock: prod.inventory_stock }
    }]);
  };

  const handleQuantityEdit = (index, newQty) => {
    const updated = [...orderItems];
    updated[index].quantity = parseInt(newQty) || 0;
    updated[index].total_price = (updated[index].unit_price_used ?? updated[index].products?.unit_price ?? 0) * updated[index].quantity;
    setOrderItems(updated);
  };

  const handleUpdateDraft = async () => {
    if (orderItems.some(item => item.quantity <= 0)) return alert('Quantity must be > 0.');
    setIsUpdating(true);
    try {
      let total = 0;
      for (const item of orderItems) {
        const lineTotal = (item.unit_price_used ?? item.products?.unit_price ?? 0) * item.quantity;
        total += lineTotal;
        if (item.isNew) {
          // Insert new item
          await supabase.from('transaction_items').insert([{
            transaction_id: selectedOrder.id,
            product_id: item.products?.id,
            quantity: item.quantity,
            total_price: lineTotal
          }]);
        } else {
          // Update existing item
          await supabase.from('transaction_items').update({ quantity: item.quantity, total_price: lineTotal }).eq('id', item.id);
        }
      }
      await supabase.from('transactions').update({ bill_amount: total }).eq('id', selectedOrder.id);
      addToast('✅ Order updated!'); loadPendingOrders();
      // Refresh order items
      const { data } = await supabase.from('transaction_items')
        .select(`id, quantity, total_price, products ( id, name, unit_price, inventory_stock )`)
        .eq('transaction_id', selectedOrder.id);
      if (data) setOrderItems(data.map(item => ({
        ...item,
        unit_price_used: item.quantity > 0 ? item.total_price / item.quantity : (item.products?.unit_price || 0),
      })));
    } catch (err) { console.error(err); } finally { setIsUpdating(false); }
  };

  const handleApproveAndRelease = async () => {
    if (!selectedAgentForOrder) return alert('Please assign an agent.');
    if (orderItems.some(item => item.quantity > (item.products?.inventory_stock || 0))) return alert('Quantity exceeds stock!');
    setIsUpdating(true);
    try {
      for (const item of orderItems) {
        await supabase.from('products').update({ inventory_stock: (item.products?.inventory_stock || 0) - item.quantity }).eq('id', item.products.id);
      }
      await supabase.from('transactions').update({ status: 'approved', employee_name: selectedAgentForOrder }).eq('id', selectedOrder.id);
      addToast(`✅ Released to ${selectedAgentForOrder}!`);
      setSelectedOrder(null); setSelectedAgentForOrder(''); loadPendingOrders();
    } catch (err) { alert('Error.'); } finally { setIsUpdating(false); }
  };

  const handleSendInvoiceEmail = async () => {
    if (!emailRecipient.trim()) return alert('Enter a recipient email address.');
    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: emailModal.orderId, recipientEmail: emailRecipient.trim(), ownerId: profile?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast(`✅ Invoice emailed to ${emailRecipient}`);
      setEmailModal(null);
      setEmailRecipient('');
    } catch (err) {
      alert('Failed to send: ' + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRestock = async () => {
    if (!restockModal) return;
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty <= 0) return alert('Enter a valid quantity.');
    const newStock = restockModal.currentStock + qty;
    const { error } = await supabase.from('products').update({ inventory_stock: newStock }).eq('id', restockModal.id);
    if (error) return alert('Restock failed: ' + error.message);
    addToast(`✅ ${restockModal.name} restocked — new stock: ${newStock} units`);
    setRestockModal(null);
    setRestockQty('');
    loadMasterProducts();
  };

  function exportLedgerExcel() {
    const rows = historyOrders.map(o => ({
      'Bill No': o.bill_number || '',
      'Shop': o.shops?.name || '',
      'Agent': o.employee_name || '',
      'Date': o.delivered_at
        ? new Date(o.delivered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Bill Amount (INR)': parseFloat(o.bill_amount || 0),
      'Collected (INR)': parseFloat(o.amount_received || 0),
      'Pending (INR)': parseFloat(o.pending_amount || 0),
      'Payment Mode': o.payment_mode || '',
      'Status': o.status === 'delivered' ? (parseFloat(o.pending_amount) <= 0 ? 'Settled' : 'Credit') : 'En Route',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [12, 20, 16, 14, 18, 16, 14, 14, 10].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispatched Ledger');
    XLSX.writeFile(wb, `EasyTrack_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportFinanceExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryRows = [
      ['Metric', 'Value (INR)'],
      ['Total Sales', financials.totalSales],
      ['Total Collected', financials.totalCollected],
      ['Total Outstanding', financials.totalOutstanding],
      ['Cash Collected', financials.cashCollected],
      ['UPI Collected', financials.upiCollected],
      ['Cheque Collected', financials.chequeCollected],
      ['Collection Efficiency %', financials.totalSales > 0 ? Math.round((financials.totalCollected / financials.totalSales) * 100) : 0],
      ['Aging 0-7 days', financials.aging07],
      ['Aging 8-15 days', financials.aging815],
      ['Aging 16-30 days', financials.aging1630],
      ['Aging 30+ days', financials.aging30plus],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Agent Rankings
    const hasTargets = dateRange === 'month' && agentTargets.length > 0;
    const agentHeader = hasTargets
      ? ['Agent', 'Bills', 'Sales (INR)', 'Sales Target (INR)', 'Sales vs Target %', 'Collected (INR)', 'Collection Target (INR)', 'Collection vs Target %', 'Efficiency %']
      : ['Agent', 'Bills', 'Sales (INR)', 'Collected (INR)', 'Efficiency %'];
    const agentRows = [agentHeader];
    Object.entries(financials.agentRankings || {})
      .sort((a, b) => b[1].sales - a[1].sales)
      .forEach(([name, d]) => {
        const tgt = hasTargets ? agentTargets.find(t => t.agent_name === name) : null;
        const eff = d.sales > 0 ? Math.round((d.collected / d.sales) * 100) : 0;
        if (hasTargets) {
          const sPct = tgt?.sales_target > 0 ? Math.round(d.sales / tgt.sales_target * 100) : '';
          const cPct = tgt?.collection_target > 0 ? Math.round(d.collected / tgt.collection_target * 100) : '';
          agentRows.push([name, d.count, d.sales, tgt?.sales_target || '', sPct !== '' ? sPct + '%' : '—', d.collected, tgt?.collection_target || '', cPct !== '' ? cPct + '%' : '—', eff]);
        } else {
          agentRows.push([name, d.count, d.sales, d.collected, eff]);
        }
      });
    const wsAgents = XLSX.utils.aoa_to_sheet(agentRows);
    wsAgents['!cols'] = hasTargets
      ? [{ wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 12 }]
      : [{ wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsAgents, 'Agent Rankings');

    // Sheet 3: Pending Bills
    const pendingRows = [['Bill No', 'Shop', 'Date', 'Bill Amount (INR)', 'Pending (INR)']];
    (financials.shopPendingBills || []).forEach(b => {
      pendingRows.push([b.billNumber, b.shopName, b.date, b.total, b.pending]);
    });
    const wsPending = XLSX.utils.aoa_to_sheet(pendingRows);
    wsPending['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Bills');

    const label = dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'ThisWeek' : dateRange === 'month' ? 'ThisMonth' : 'Custom';
    XLSX.writeFile(wb, `EasyTrack_Finance_${label}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportPendingBillsExcel() {
    const rows = (financials.shopPendingBills || [])
      .filter(b => selectedShopFilter === 'all' || b.shopName === selectedShopFilter)
      .map(b => ({
        'Bill No': b.billNumber,
        'Shop': b.shopName,
        'Date': b.date,
        'Bill Amount (INR)': parseFloat(b.total || 0),
        'Pending (INR)': parseFloat(b.pending || 0),
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [16, 22, 14, 18, 14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Bills');
    const shopLabel = selectedShopFilter === 'all' ? 'AllShops' : selectedShopFilter.replace(/[^a-z0-9]+/gi, '_');
    XLSX.writeFile(wb, `EasyTrack_PendingBills_${shopLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportLedgerPdf() {
    const rows = historyOrders.map((o, i) => {
      const settled = o.status === 'delivered' && parseFloat(o.pending_amount) <= 0;
      const credit = o.status === 'delivered' && parseFloat(o.pending_amount) > 0;
      const statusLabel = settled ? 'Settled' : credit ? 'Credit' : 'En Route';
      const statusColor = settled ? '#15803d' : credit ? '#991b1b' : '#854d0e';
      const date = o.delivered_at
        ? new Date(o.delivered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td>${o.bill_number || ''}</td>
        <td>${o.shops?.name || ''}</td>
        <td>${o.employee_name || ''}</td>
        <td>${date}</td>
        <td style="text-align:right">₹${parseFloat(o.bill_amount || 0).toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:#16a34a">₹${parseFloat(o.amount_received || 0).toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:#dc2626">₹${parseFloat(o.pending_amount || 0).toLocaleString('en-IN')}</td>
        <td>${o.payment_mode || ''}</td>
        <td style="color:${statusColor};font-weight:bold">${statusLabel}</td>
      </tr>`;
    }).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>EasyTrack Ledger</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}h1{font-size:18px;margin-bottom:4px}p.sub{font-size:12px;color:#64748b;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
    @media print{body{padding:10px}.no-print{display:none}}</style></head><body>
    <h1>EasyTrack — Dispatched Ledger</h1>
    <p class="sub">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; ${historyOrders.length} records</p>
    <table><thead><tr><th>Bill No</th><th>Shop</th><th>Agent</th><th>Date</th><th>Amount</th><th>Collected</th><th>Pending</th><th>Mode</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  function exportFinancePdf() {
    const pdfHasTargets = dateRange === 'month' && agentTargets.length > 0;
    const pctColor = (pct) => pct >= 100 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626';
    const agentRows = Object.entries(financials.agentRankings || {})
      .sort((a, b) => b[1].sales - a[1].sales)
      .map(([name, d], i) => {
        const tgt = pdfHasTargets ? agentTargets.find(t => t.agent_name === name) : null;
        const sPct = tgt?.sales_target > 0 ? Math.min(100, Math.round(d.sales / tgt.sales_target * 100)) : null;
        const cPct = tgt?.collection_target > 0 ? Math.min(100, Math.round(d.collected / tgt.collection_target * 100)) : null;
        const eff = d.sales > 0 ? Math.round((d.collected / d.sales) * 100) : 0;
        const tgtCols = pdfHasTargets
          ? `<td style="text-align:center;font-weight:bold;color:${sPct !== null ? pctColor(sPct) : '#94a3b8'}">${sPct !== null ? sPct + '%' : '—'}</td>
             <td style="text-align:center;font-weight:bold;color:${cPct !== null ? pctColor(cPct) : '#94a3b8'}">${cPct !== null ? cPct + '%' : '—'}</td>`
          : '';
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td>${name}</td><td style="text-align:center">${d.count}</td>
          <td style="text-align:right">₹${d.sales.toLocaleString('en-IN')}</td>
          <td style="text-align:right;color:#16a34a">₹${d.collected.toLocaleString('en-IN')}</td>
          <td style="text-align:center">${eff}%</td>
          ${tgtCols}
        </tr>`;
      }).join('');
    const agentThead = pdfHasTargets
      ? '<tr><th>Agent</th><th>Bills</th><th>Sales</th><th>Collected</th><th>Efficiency</th><th>Sales vs Target</th><th>Collection vs Target</th></tr>'
      : '<tr><th>Agent</th><th>Bills</th><th>Sales</th><th>Collected</th><th>Efficiency</th></tr>';
    const agentColspan = pdfHasTargets ? 7 : 5;
    const pendingRows = (financials.shopPendingBills || [])
      .map((b, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td>${b.billNumber}</td><td>${b.shopName}</td><td>${b.date}</td>
        <td style="text-align:right">₹${parseFloat(b.total).toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:#dc2626">₹${parseFloat(b.pending).toLocaleString('en-IN')}</td>
      </tr>`).join('');
    const label = dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This Week' : dateRange === 'month' ? 'This Month' : 'Custom Range';
    const eff = financials.totalSales > 0 ? Math.round((financials.totalCollected / financials.totalSales) * 100) : 0;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>EasyTrack Finance Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin:24px 0 10px;border-bottom:2px solid #0f172a;padding-bottom:6px}
    p.sub{font-size:12px;color:#64748b;margin:0 0 16px}.cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}.card{border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;min-width:140px}
    .card .label{font-size:10px;color:#64748b;font-weight:bold;text-transform:uppercase}.card .val{font-size:20px;font-weight:bold;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
    @media print{body{padding:10px}}</style></head><body>
    <h1>EasyTrack — Financial Report</h1>
    <p class="sub">Period: ${label} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}${pdfHasTargets ? ' &nbsp;|&nbsp; 🎯 Targets included' : ''}</p>
    <div class="cards">
      <div class="card"><div class="label">Total Sales</div><div class="val">₹${financials.totalSales.toLocaleString('en-IN')}</div></div>
      <div class="card"><div class="label" style="color:#16a34a">Collected</div><div class="val" style="color:#16a34a">₹${financials.totalCollected.toLocaleString('en-IN')}</div></div>
      <div class="card"><div class="label" style="color:#dc2626">Outstanding</div><div class="val" style="color:#dc2626">₹${financials.totalOutstanding.toLocaleString('en-IN')}</div></div>
      <div class="card" style="background:#0f172a"><div class="label" style="color:#94a3b8">Efficiency</div><div class="val" style="color:#4ade80">${eff}%</div></div>
    </div>
    <h2>Agent Rankings</h2>
    <table><thead>${agentThead}</thead><tbody>${agentRows || '<tr><td colspan="' + agentColspan + '" style="color:#64748b;text-align:center">No data</td></tr>'}</tbody></table>
    <h2>Pending Bills (${(financials.shopPendingBills || []).length})</h2>
    <table><thead><tr><th>Bill No</th><th>Shop</th><th>Date</th><th>Total</th><th>Pending</th></tr></thead><tbody>${pendingRows || '<tr><td colspan="5" style="color:#64748b;text-align:center">No pending bills</td></tr>'}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  const handleFinalizeDelivery = async (transactionId, totalBill, amountReceived, paymentMode) => {
    if (isNaN(amountReceived) || amountReceived < 0) return alert('Invalid amount.');
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('transactions').update({
        status: 'delivered', amount_received: amountReceived,
        pending_amount: totalBill - amountReceived, payment_mode: paymentMode,
        delivered_at: new Date().toISOString()
      }).eq('id', transactionId);
      if (error) throw error;
      if (amountReceived > 0) {
        await supabase.from('bill_payments').insert({ transaction_id: transactionId, amount: amountReceived, payment_mode: paymentMode });
      }
      addToast('✅ Delivery settled!'); loadHistoryLedger();
    } catch (err) { alert('Failed.'); } finally { setIsUpdating(false); }
  };

  const handleLogPayment = async () => {
    const amt = parseFloat(logPaymentForm.amount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid amount.');
    const order = historyOrders.find(o => o.id === logPaymentForm.orderId);
    if (!order) return;
    const currentReceived = parseFloat(order.amount_received || 0);
    const remaining = parseFloat(order.bill_amount) - currentReceived;
    if (amt > remaining) return alert(`Cannot exceed outstanding amount ₹${remaining.toLocaleString('en-IN')}`);
    setIsUpdating(true);
    try {
      const newReceived = currentReceived + amt;
      const newPending = Math.max(0, parseFloat(order.bill_amount) - newReceived);
      const { error } = await supabase.from('transactions').update({
        amount_received: newReceived,
        pending_amount: newPending,
        payment_mode: logPaymentForm.mode,
      }).eq('id', logPaymentForm.orderId);
      if (error) throw error;
      await supabase.from('bill_payments').insert({ transaction_id: logPaymentForm.orderId, amount: amt, payment_mode: logPaymentForm.mode });
      addToast(`✅ ₹${amt.toLocaleString('en-IN')} logged — Pending: ₹${newPending.toLocaleString('en-IN')}`);
      setLogPaymentForm(null);
      loadHistoryLedger();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setIsUpdating(false); }
  };

  async function loadPendingLeaveRequests() {
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('status', 'pending')
      .order('leave_date', { ascending: true });
    if (data) setPendingLeaveRequests(data);
  }

  async function loadAllLeaveRequests() {
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .order('leave_date', { ascending: false });
    if (data) setAllLeaveRequests(data);
  }

  async function reassignDeliveriesForLeave(agentName, agentId, date) {
    const { data: bills } = await supabase.from('transactions').select('id').eq('employee_name', agentName).eq('status', 'approved');
    if (!bills || bills.length === 0) return 0;
    const { data: allProfiles } = await supabase.from('profiles').select('id, full_name').eq('role', 'agent').neq('id', agentId);
    if (!allProfiles || allProfiles.length === 0) return 0;
    const { data: onLeave } = await supabase.from('leaves').select('agent_name').eq('leave_date', date).eq('status', 'approved');
    const onLeaveNames = new Set((onLeave || []).map(l => l.agent_name));
    const available = allProfiles.filter(a => !onLeaveNames.has(a.full_name));
    if (available.length === 0) return 0;
    const workloads = await Promise.all(available.map(async (agent) => {
      const { count } = await supabase.from('transactions').select('id', { count: 'exact' }).eq('employee_name', agent.full_name).eq('status', 'approved');
      return { ...agent, workload: count || 0 };
    }));
    workloads.sort((a, b) => a.workload - b.workload);
    let reassigned = 0;
    for (let i = 0; i < bills.length; i++) {
      const assignTo = workloads[i % workloads.length];
      await supabase.from('transactions').update({ employee_name: assignTo.full_name }).eq('id', bills[i].id);
      reassigned++;
    }
    return reassigned;
  }

  async function handleLeaveAction(group, newStatus) {
    const { error } = await supabase.from('leaves').update({ status: newStatus }).in('id', group.ids);
    if (error) { addToast('❌ ' + error.message); return; }
    if (newStatus === 'approved') {
      let totalReassigned = 0;
      const cur = new Date(group.startDate), end = new Date(group.endDate);
      while (cur <= end) {
        totalReassigned += await reassignDeliveriesForLeave(group.agent_name, group.agent_id, cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      addToast(`✅ Approved ${group.agent_name}'s leave. ${totalReassigned} bill${totalReassigned === 1 ? '' : 's'} reassigned.`);
    }
    loadAllLeaveRequests();
    loadPendingLeaveRequests();
  }

  async function loadAgentProfile(agent) {
    setSelectedAgentProfile(agent);
    setIsLoadingProfile(true);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get bills this month
    const { data: bills } = await supabase
      .from('transactions')
      .select('bill_amount, amount_received, status, created_at')
      .eq('employee_name', agent.full_name)
      .gte('created_at', firstOfMonth);

    // Get all leaves
    const { data: leaves } = await supabase
      .from('leaves')
      .select('leave_date, reason')
      .eq('agent_name', agent.full_name)
      .eq('status', 'approved')
      .order('leave_date', { ascending: false });

    // Calculate working days this month
    const daysInMonth = now.getDate();
    const leavesThisMonth = (leaves || []).filter(l => {
      const d = new Date(l.leave_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const workingDays = daysInMonth - leavesThisMonth.length;

    // Calculate performance
    const totalSales = (bills || []).reduce((s, b) => s + parseFloat(b.bill_amount || 0), 0);
    const totalCollected = (bills || []).reduce((s, b) => s + parseFloat(b.amount_received || 0), 0);

    setAgentProfileData({
      billsThisMonth: (bills || []).length,
      totalSales,
      totalCollected,
      collectionRate: totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 0,
      workingDays,
      leavesThisMonth: leavesThisMonth.length,
      allLeaves: leaves || []
    });
    setIsLoadingProfile(false);
  }

  // Capture GPS for route start
  const captureRouteStartGps = () => {
    setIsCapturingRouteGps(true);
    if (!navigator.geolocation) { alert('GPS not supported'); setIsCapturingRouteGps(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setRouteStartCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setIsCapturingRouteGps(false); },
      () => { alert('Could not get location'); setIsCapturingRouteGps(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Nearest neighbor route optimization
  const generateOptimizedRoute = async () => {
    if (!routeAgent) return alert('Please select an agent first.');

    // Get start coordinates
    let startLat, startLng;
    if (routeStartMode === 'gps') {
      if (!routeStartCoords) return alert('Please capture your current location first.');
      startLat = routeStartCoords.lat;
      startLng = routeStartCoords.lng;
    } else {
      if (!customStartLat || !customStartLng) return alert('Please enter custom coordinates.');
      startLat = parseFloat(customStartLat);
      startLng = parseFloat(customStartLng);
    }

    setIsGeneratingRoute(true);

    // 1. Try today's beat plan first
    const todayDow = new Date().getDay();
    const { data: beatData } = await supabase
      .from('beat_plans')
      .select('shops(id, name, phone_number, latitude, longitude)')
      .eq('employee_name', routeAgent)
      .eq('day_of_week', todayDow);

    let shops = (beatData || [])
      .map(b => b.shops)
      .filter(s => s && s.latitude && s.longitude);

    // 2. Fetch pending orders for this agent — merge with beat plan and mark shops
    const { data: pendingTx } = await supabase
      .from('transactions')
      .select('shop_id, bill_number, bill_amount')
      .eq('employee_name', routeAgent)
      .eq('status', 'approved');

    const pendingShopIds = new Set((pendingTx || []).map(t => t.shop_id));
    const pendingByShop = {};
    (pendingTx || []).forEach(t => {
      if (!pendingByShop[t.shop_id]) pendingByShop[t.shop_id] = [];
      pendingByShop[t.shop_id].push(t.bill_number);
    });

    // If no beat plan, fall back to pending order shops
    if (shops.length === 0) {
      const shopIds = [...pendingShopIds];
      if (shopIds.length > 0) {
        const { data: shopData } = await supabase
          .from('shops')
          .select('id, name, phone_number, latitude, longitude')
          .in('id', shopIds)
          .not('latitude', 'is', null);
        shops = shopData || [];
      }
    } else {
      // Merge: add any pending-order shops not already in beat plan
      const beatShopIds = new Set(shops.map(s => s.id));
      const extraIds = [...pendingShopIds].filter(id => !beatShopIds.has(id));
      if (extraIds.length > 0) {
        const { data: extraShops } = await supabase
          .from('shops')
          .select('id, name, phone_number, latitude, longitude')
          .in('id', extraIds)
          .not('latitude', 'is', null);
        shops = [...shops, ...(extraShops || [])];
      }
    }

    if (shops.length === 0) {
      setIsGeneratingRoute(false);
      return alert(`No beat plan or pending orders with GPS found for ${routeAgent}.`);
    }

    // Mark each shop with pending order info
    shops = shops.map(s => ({ ...s, pendingBills: pendingByShop[s.id] || [] }));

    // Nearest neighbor algorithm — pending-order shops get a 20% distance bonus
    let remaining = [...shops];
    let route = [];
    let currentLat = startLat;
    let currentLng = startLng;
    let totalDist = 0;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      remaining.forEach((shop, i) => {
        let d = calcDistance(currentLat, currentLng, parseFloat(shop.latitude), parseFloat(shop.longitude));
        if (shop.pendingBills?.length > 0) d *= 0.8; // 20% priority boost for pending orders
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      });

      const nearest = remaining[nearestIdx];
      const distFromPrev = calcDistance(currentLat, currentLng, parseFloat(nearest.latitude), parseFloat(nearest.longitude));
      totalDist += distFromPrev;

      route.push({ ...nearest, distanceFromPrev: distFromPrev.toFixed(1) });
      currentLat = parseFloat(nearest.latitude);
      currentLng = parseFloat(nearest.longitude);
      remaining.splice(nearestIdx, 1);
    }

    setOptimizedRoute(route);
    setRouteTotalDistance(totalDist.toFixed(1));
    setIsGeneratingRoute(false);
  };

  // Generate Google Maps URL with all waypoints
  const generateGoogleMapsUrl = () => {
    if (optimizedRoute.length === 0) return '#';
    const origin = routeStartCoords ? `${routeStartCoords.lat},${routeStartCoords.lng}` : `${customStartLat},${customStartLng}`;
    const destination = `${optimizedRoute[optimizedRoute.length-1].latitude},${optimizedRoute[optimizedRoute.length-1].longitude}`;
    const waypoints = optimizedRoute.slice(0, -1).map(s => `${s.latitude},${s.longitude}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  };

  const filteredLedger = (() => {
    let result = historyOrders;
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      result = result.filter(o =>
        (o.bill_number || '').toLowerCase().includes(q) ||
        (o.shops?.name || '').toLowerCase().includes(q) ||
        (o.employee_name || '').toLowerCase().includes(q)
      );
    }
    if (ledgerStatusFilter !== 'all') {
      result = result.filter(o => {
        if (ledgerStatusFilter === 'enroute') return o.status === 'approved';
        if (ledgerStatusFilter === 'credit')  return o.status === 'delivered' && parseFloat(o.pending_amount) > 0;
        if (ledgerStatusFilter === 'settled') return o.status === 'delivered' && parseFloat(o.pending_amount) <= 0;
        return true;
      });
    }
    if (ledgerAgentFilter !== 'all') {
      result = result.filter(o => o.employee_name === ledgerAgentFilter);
    }
    return result;
  })();

  const tabStyle = (tab) => ({
    padding: '12px 16px', backgroundColor: activeTab === tab ? '#1e293b' : 'transparent',
    borderRadius: '6px', color: activeTab === tab ? '#38bdf8' : '#94a3b8',
    fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
  });

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', color: '#0f172a', fontFamily: 'sans-serif', position: 'relative' }}>

      {/* Mobile backdrop — sidebar */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}
      {/* Mobile backdrop — drawers */}
      {isMobile && ((selectedBillLedger && activeTab === 'history') || (selectedOrder && activeTab === 'pending')) && (
        <div onClick={() => { setSelectedBillLedger(null); setSelectedOrder(null); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 198 }} />
      )}

      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#0f172a', padding: '25px', color: '#ffffff', display: 'flex', flexDirection: 'column', flexShrink: 0, ...(isMobile ? { position: 'fixed', top: 0, left: sidebarOpen ? 0 : '-280px', height: '100vh', zIndex: 50, transition: 'left 0.25s ease', overflowY: 'auto' } : {}) }} className="no-print">
        <div style={{ marginBottom: '24px' }}>
          <Logo variant="dark" height={42} />
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '6px', fontWeight: 600, letterSpacing: '0.04em' }}>HQ CONTROL ROOM</span>
        </div>
        {(() => {
          // Group consecutive pending days for the same agent+reason into one range,
          // so a single 4-day request shows as one line instead of four.
          const buckets = new Map();
          for (const leave of pendingLeaveRequests) {
            const key = `${leave.agent_id}||${leave.reason}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(leave);
          }
          const groups = [];
          for (const bucket of buckets.values()) {
            const sortedBucket = [...bucket].sort((a, b) => a.leave_date.localeCompare(b.leave_date));
            let current = null;
            for (const leave of sortedBucket) {
              const isConsecutive = current && (new Date(leave.leave_date) - new Date(current.endDate)) === 86400000;
              if (current && isConsecutive) {
                current.endDate = leave.leave_date;
              } else {
                current = { agent_name: leave.agent_name, startDate: leave.leave_date, endDate: leave.leave_date };
                groups.push(current);
              }
            }
          }
          groups.sort((a, b) => a.startDate.localeCompare(b.startDate));
          if (!can('settings') || groups.length === 0) return null;
          return (
            <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '12px', marginBottom: '20px', border: '1px solid #7c3aed' }} onClick={() => { setActiveTab('settings'); setSettingsSubTab('team'); }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ backgroundColor: '#7c3aed', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>{groups.length}</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#c4b5fd' }}>Leave Requests</span>
              </div>
              {groups.slice(0, 3).map((g, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  🏖️ {g.agent_name} — {g.startDate === g.endDate
                    ? new Date(g.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                    : `${new Date(g.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(g.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                </div>
              ))}
            </div>
          );
        })()}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          {can('today') && <div onClick={() => handleNavClick('pending')} style={tabStyle('pending')}>🏠 Today</div>}
          {can('dispatch') && <div onClick={() => handleNavClick('history')} style={tabStyle('history')}>📜 Dispatch</div>}
          {can('finance') && <div onClick={() => handleNavClick('finance')} style={tabStyle('finance')}>📈 Financial Insights</div>}
          {can('shops') && <div onClick={() => handleNavClick('shops')} style={tabStyle('shops')}>🏪 Shops</div>}
          {can('routes') && <div onClick={() => handleNavClick('routes')} style={tabStyle('routes')}>🗺️ Routes</div>}
        </nav>
        {can('settings') && <div onClick={() => handleNavClick('settings')} style={{ ...tabStyle('settings'), marginTop: '8px' }}>⚙️ Settings</div>}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px', marginTop: '20px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>{profile?.full_name || 'Owner'}</p>
          <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#64748b' }}>{profile?.email}</p>
          <button onClick={signOut} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flexGrow: 1, padding: isMobile ? '16px 16px calc(74px + env(safe-area-inset-bottom))' : '40px', boxSizing: 'border-box', minWidth: 0 }} className="no-print">
        <header style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '4px 6px', color: '#1e293b', flexShrink: 0, lineHeight: 1 }}>☰</button>
          )}
          <h1 style={{ margin: '0', fontSize: isMobile ? '20px' : '28px', fontWeight: 'bold', color: '#1e293b' }}>
            {activeTab === 'pending' && 'Today'}
            {activeTab === 'history' && 'Dispatch'}
            {activeTab === 'finance' && 'Financial Insights'}
            {activeTab === 'shops' && 'Shops'}
            {activeTab === 'routes' && 'Routes'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
        </header>

        {(() => {
          const lowStock = productsCatalog.filter(p =>
            p.is_active !== false &&
            (p.low_stock_threshold || 10) > 0 &&
            p.inventory_stock <= (p.low_stock_threshold || 10)
          );
          if (lowStock.length === 0) return null;
          return (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#92400e' }}>
                  {lowStock.length} product{lowStock.length > 1 ? 's' : ''} need restocking
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lowStock.map(p => {
                  const threshold = p.low_stock_threshold || 10;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{p.name}</span>
                        <span style={{ marginLeft: '10px', fontSize: '13px', color: '#dc2626', fontWeight: 'bold' }}>{p.inventory_stock} units left</span>
                        <span style={{ marginLeft: '6px', fontSize: '12px', color: '#92400e' }}>(min: {threshold})</span>
                      </div>
                      <button
                        onClick={() => { setRestockModal({ id: p.id, name: p.name, currentStock: p.inventory_stock }); setRestockQty(''); }}
                        style={{ padding: '6px 14px', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + Restock
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
          <div style={{ flexGrow: 1 }}>
            {isLoading ? (
              <p style={{ padding: '20px', color: '#64748b' }}>Loading...</p>

            ) : activeTab === 'pending' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── DAILY BRIEFING ── */}
              {briefing && (
                <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', padding: '24px 28px', color: '#f8fafc' }}>
                  <p style={{ margin: '0 0 18px', fontSize: '16px', color: '#94a3b8' }}>
                    {briefing.greeting}, <strong style={{ color: '#f8fafc' }}>{profile?.full_name?.split(' ')[0] || 'there'}</strong> 👋
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '120px', backgroundColor: '#1e293b', borderRadius: '8px', padding: '14px 16px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dispatched</p>
                      <p style={{ margin: '0', fontSize: '26px', fontWeight: 'bold', color: '#38bdf8' }}>{briefing.dispatchedCount}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>bills en route</p>
                    </div>
                    <div style={{ flex: 1, minWidth: '120px', backgroundColor: '#1e293b', borderRadius: '8px', padding: '14px 16px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collected Today</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#4ade80' }}>₹{briefing.collectedToday.toLocaleString('en-IN')}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>cash & UPI in</p>
                    </div>
                    <div style={{ flex: 1, minWidth: '120px', backgroundColor: '#1e293b', borderRadius: '8px', padding: '14px 16px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#fca5a5' }}>₹{briefing.totalOutstanding.toLocaleString('en-IN')}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>from {briefing.uniqueShops} shop{briefing.uniqueShops !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── QUICK ACTIONS ── */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href="/agent" style={{ padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>
                  ➕ New Order
                </a>
                <button onClick={() => handleNavClick('history')} style={{ padding: '10px 18px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                  💵 Log Payment
                </button>
                <button onClick={() => overdueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ padding: '10px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                  🔴 View Overdue
                </button>
              </div>

              {/* ── OVERDUE PANEL ── */}
              {briefing && briefing.urgent.length > 0 && (
                <div ref={overdueRef} style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 'bold', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔴 Overdue 15+ days — needs follow-up
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {briefing.urgent.map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: '#fecaca' }}>{b.shops?.name || 'Unknown Shop'}</span>
                        <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>₹{parseFloat(b.pending_amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CREDIT LIMIT ALERTS ── */}
              {creditAlerts.length > 0 && (
                <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#9a3412' }}>⚠️ Credit Limit Alerts</h3>
                    <span style={{ backgroundColor: '#dc2626', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>{creditAlerts.length}</span>
                    <span style={{ fontSize: '12px', color: '#92400e', marginLeft: 'auto' }}>Shops at or near their credit ceiling</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {creditAlerts.map((shop, i) => {
                      const isOver = shop.pct >= 100;
                      return (
                        <div key={i} style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px 16px', border: `1px solid ${isOver ? '#fca5a5' : '#fed7aa'}`, display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{shop.name}</span>
                            <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 'bold', color: isOver ? '#dc2626' : '#d97706', backgroundColor: isOver ? '#fee2e2' : '#fef3c7', padding: '2px 8px', borderRadius: '10px' }}>
                              {isOver ? '⛔ OVER LIMIT' : '⚠️ NEAR LIMIT'}
                            </span>
                          </div>
                          <span style={{ fontSize: '13px', color: '#475569', minWidth: '200px' }}>
                            ₹{shop.creditUsed.toLocaleString('en-IN')} used of ₹{shop.limit.toLocaleString('en-IN')}
                          </span>
                          <div style={{ flex: 1, minWidth: '120px' }}>
                            <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', marginBottom: '2px' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, shop.pct)}%`, backgroundColor: isOver ? '#dc2626' : '#f59e0b', borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: isOver ? '#dc2626' : '#d97706', fontWeight: 'bold' }}>{Math.round(shop.pct)}% used</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pendingOrders.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0', color: '#64748b' }}>No pending orders.</p>
                </div>
              ) : (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '16px', color: '#475569' }}>Bill Number</th>
                      <th style={{ padding: '16px', color: '#475569' }}>Shop</th>
                      <th style={{ padding: '16px', color: '#475569' }}>Agent</th>
                      <th style={{ padding: '16px', color: '#475569' }}>Amount</th>
                      <th style={{ padding: '16px', color: '#475569' }}>Actions</th>
                    </tr></thead>
                    <tbody>{pendingOrders.map((order) => (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold' }}>{order.bill_number}</td>
                        <td style={{ padding: '16px', fontWeight: '500' }}>
                          {order.shops?.name}
                          {(() => { const a = creditAlerts.find(c => c.id === order.shops?.id); if (!a) return null; return <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 'bold', color: a.pct >= 100 ? '#dc2626' : '#d97706', backgroundColor: a.pct >= 100 ? '#fee2e2' : '#fef3c7', padding: '1px 6px', borderRadius: '8px' }}>{a.pct >= 100 ? '⛔ OVER' : '⚠️ NEAR'}</span>; })()}
                        </td>
                        <td style={{ padding: '16px', color: '#475569' }}>{order.employee_name}</td>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#16a34a' }}>₹{order.bill_amount}</td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button onClick={() => handleReviewClick(order)} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Review & Edit</button>
                            {(() => { const link = waLink(order.shops?.phone_number, `Hi ${order.shops?.name}, your order ${order.bill_number} of ₹${parseFloat(order.bill_amount).toLocaleString('en-IN')} has been received. We'll dispatch soon. – EasyTrack`); return link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', backgroundColor: '#25d366', color: '#fff', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}>📱</a> : null; })()}
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              </div>

            ) : activeTab === 'history' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* ── STATUS PILL FILTER BAR ── */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'enroute', label: 'En Route' },
                    { key: 'credit', label: 'Delivered' },
                    { key: 'settled', label: 'Collected' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setLedgerStatusFilter(f.key)}
                      style={{
                        padding: '6px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        border: '1.5px solid ' + (ledgerStatusFilter === f.key ? '#2563eb' : '#e2e8f0'),
                        backgroundColor: ledgerStatusFilter === f.key ? '#2563eb' : '#ffffff',
                        color: ledgerStatusFilter === f.key ? '#ffffff' : '#475569',
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* ── SEARCH + FILTER BAR ── */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Search bill no, shop or agent…"
                      value={ledgerSearch}
                      onChange={e => setLedgerSearch(e.target.value)}
                      style={{ padding: '8px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', minWidth: '220px', flex: 1 }}
                    />
                    <select value={ledgerAgentFilter} onChange={e => setLedgerAgentFilter(e.target.value)}
                      style={{ padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', backgroundColor: '#ffffff', cursor: 'pointer' }}>
                      <option value="all">All Agents</option>
                      {[...new Set(historyOrders.map(o => o.employee_name).filter(Boolean))].sort().map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {(ledgerSearch || ledgerStatusFilter !== 'all' || ledgerAgentFilter !== 'all') && (
                      <button onClick={() => { setLedgerSearch(''); setLedgerStatusFilter('all'); setLedgerAgentFilter('all'); }}
                        style={{ padding: '8px 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✕ Clear
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    {filteredLedger.length !== historyOrders.length && (
                      <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {filteredLedger.length} of {historyOrders.length}
                      </span>
                    )}
                    <button onClick={exportLedgerExcel}
                      style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                      ⬇ Excel
                    </button>
                    <button onClick={exportLedgerPdf}
                      style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                      🖨 PDF
                    </button>
                  </div>
                </div>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '16px', color: '#475569' }}>Bill No</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Shop</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Value</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Collected</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Mode</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Pending</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Status</th>
                    <th style={{ padding: '16px', color: '#475569' }}>Actions</th>
                  </tr></thead>
                  <tbody>{filteredLedger.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                      No bills match your search.
                    </td></tr>
                  ) : filteredLedger.map((order) => {
                    let badgeLabel = '🚚 En Route', bgStyle = '#fef9c3', textStyle = '#854d0e';
                    if (order.status === 'delivered') {
                      if (parseFloat(order.pending_amount) <= 0) { badgeLabel = '✓ Settled'; bgStyle = '#dcfce7'; textStyle = '#15803d'; }
                      else { badgeLabel = '⚠️ Credit'; bgStyle = '#fee2e2'; textStyle = '#991b1b'; }
                    }
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold' }}>
                          <button onClick={() => loadBillPayments(order)} style={{ background: 'none', border: 'none', padding: '0', color: '#2563eb', fontWeight: 'bold', fontSize: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>{order.bill_number}</button>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ display: 'block', fontWeight: '500' }}>{order.shops?.name}</span>
                        </td>
                        <td style={{ padding: '16px', fontWeight: '600' }}>₹{parseFloat(order.bill_amount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '16px', color: '#16a34a', fontWeight: '600' }}>
                          {order.status === 'approved' ? <span style={{ color: '#94a3b8' }}>—</span> : `₹${parseFloat(order.amount_received || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>
                            {order.status === 'approved' ? '⏳ En Route' : `💳 ${order.payment_mode || 'Cash'}`}
                          </span>
                        </td>
                        <td style={{ padding: '16px', fontWeight: '600', color: '#dc2626' }}>
                          {order.status === 'approved'
                            ? `₹${parseFloat(order.bill_amount || 0).toLocaleString('en-IN')}`
                            : `₹${parseFloat(order.pending_amount || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td style={{ padding: '16px' }}><span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold', backgroundColor: bgStyle, color: textStyle }}>{badgeLabel}</span></td>
                        <td style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => fetchAndPrintInvoice(order)} style={{ padding: '6px 12px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📥 Print Bill</button>
                            {order.status === 'delivered' && parseFloat(order.pending_amount) > 0 && (
                              <button onClick={() => setLogPaymentForm({ orderId: order.id, amount: '', mode: 'Cash' })} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>💳 Log Payment</button>
                            )}
                          </div>
                          {logPaymentForm?.orderId === order.id && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', minWidth: '180px' }}>
                              <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>Log Payment — {order.bill_number}</div>
                              <input
                                type="number" min="0.01" step="0.01"
                                placeholder="Amount"
                                value={logPaymentForm.amount}
                                onChange={e => setLogPaymentForm({ ...logPaymentForm, amount: e.target.value })}
                                style={{ padding: '6px 8px', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '13px' }}
                              />
                              <select
                                value={logPaymentForm.mode}
                                onChange={e => setLogPaymentForm({ ...logPaymentForm, mode: e.target.value })}
                                style={{ padding: '6px 8px', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '13px' }}>
                                <option value="Cash">💵 Cash</option>
                                <option value="UPI">📱 UPI</option>
                                <option value="Cheque">🏢 Cheque</option>
                              </select>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={handleLogPayment}
                                  disabled={isUpdating}
                                  style={{ flex: 1, padding: '6px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                  ✓ Confirm
                                </button>
                                <button
                                  onClick={() => setLogPaymentForm(null)}
                                  style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                          <button onClick={() => { setEmailModal({ orderId: order.id, billNumber: order.bill_number, shopName: order.shops?.name }); setEmailRecipient(''); }} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📧 Email</button>
                          {order.status === 'delivered' && parseFloat(order.pending_amount) > 0 && (() => {
                            const link = waLink(order.shops?.phone_number, `Hi ${order.shops?.name}, a friendly reminder for your outstanding balance of ₹${parseFloat(order.pending_amount || 0).toLocaleString('en-IN')} on bill ${order.bill_number}. Please arrange payment at your convenience. – EasyTrack`);
                            return link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#25d366', color: '#fff', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>📱 Remind</a> : null;
                          })()}
                          {order.status === 'approved' && (
                            deliveryForm?.orderId === order.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', minWidth: '180px' }}>
                                <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Log Delivery — {order.bill_number}</div>
                                <input
                                  type="number" min="0" step="0.01"
                                  placeholder={`Amount (max ₹${order.bill_amount})`}
                                  value={deliveryForm.amount}
                                  onChange={e => setDeliveryForm({ ...deliveryForm, amount: e.target.value })}
                                  style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                />
                                <select
                                  value={deliveryForm.mode}
                                  onChange={e => setDeliveryForm({ ...deliveryForm, mode: e.target.value })}
                                  style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}>
                                  <option value="Cash">💵 Cash</option>
                                  <option value="UPI">📱 UPI</option>
                                  <option value="Cheque">🏢 Cheque</option>
                                </select>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    onClick={() => {
                                      const amt = parseFloat(deliveryForm.amount);
                                      if (isNaN(amt) || amt < 0) return alert('Enter a valid amount.');
                                      handleFinalizeDelivery(order.id, parseFloat(order.bill_amount), amt, deliveryForm.mode);
                                      setDeliveryForm(null);
                                    }}
                                    style={{ flex: 1, padding: '6px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                    ✓ Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeliveryForm(null)}
                                    style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setDeliveryForm({ orderId: order.id, amount: order.bill_amount, mode: 'Cash' })} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🚚 Log Delivery</button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              </div>

            ) : activeTab === 'finance' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* ── DATE FILTER ── */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {['today', 'week', 'month', 'custom'].map(range => (
                    <button key={range} onClick={() => {
                      setDateRange(range);
                      if (range !== 'custom') calculateFinancialMetrics(range);
                    }}
                      style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', backgroundColor: dateRange === range ? '#0f172a' : '#ffffff', color: dateRange === range ? '#ffffff' : '#475569' }}>
                      {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Custom'}
                    </button>
                  ))}
                  {dateRange === 'custom' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                      <span style={{ color: '#64748b' }}>to</span>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                      <button onClick={() => calculateFinancialMetrics('custom')}
                        style={{ padding: '7px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Apply</button>
                    </div>
                  )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={exportFinanceExcel}
                      style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                      ⬇ Excel
                    </button>
                    <button onClick={exportFinancePdf}
                      style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                      🖨 PDF
                    </button>
                  </div>
                </div>

                {/* ── SUMMARY CARDS ── */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, minWidth: '160px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Total Sales</span>
                    <strong style={{ fontSize: '22px', display: 'block', marginTop: '6px' }}>₹{financials.totalSales.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, minWidth: '160px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a', textTransform: 'uppercase' }}>Collected</span>
                    <strong style={{ fontSize: '22px', display: 'block', color: '#16a34a', marginTop: '6px' }}>₹{financials.totalCollected.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, minWidth: '160px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>Outstanding</span>
                    <strong style={{ fontSize: '22px', display: 'block', color: '#dc2626', marginTop: '6px' }}>₹{financials.totalOutstanding.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', flex: 1, minWidth: '160px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Collection Efficiency</span>
                    <strong style={{ fontSize: '28px', display: 'block', color: financials.totalSales > 0 ? '#4ade80' : '#64748b', marginTop: '6px' }}>
                      {financials.totalSales > 0 ? Math.round((financials.totalCollected / financials.totalSales) * 100) : 0}%
                    </strong>
                  </div>
                </div>

                {/* ── COLLECTION BREAKDOWN ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 'bold' }}>Collection Breakdown</h3>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {[
                      { label: '💵 Cash', value: financials.cashCollected, color: '#16a34a' },
                      { label: '📱 UPI', value: financials.upiCollected, color: '#2563eb' },
                      { label: '🏢 Cheque', value: financials.chequeCollected, color: '#7c3aed' }
                    ].map(item => (
                      <div key={item.label} style={{ flex: 1, minWidth: '120px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${item.color}` }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>{item.label}</span>
                        <strong style={{ display: 'block', fontSize: '18px', color: item.color, marginTop: '4px' }}>₹{item.value.toLocaleString('en-IN')}</strong>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {financials.totalCollected > 0 ? Math.round((item.value / financials.totalCollected) * 100) : 0}% of total
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── DAILY SALES TREND ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: '0', fontSize: '15px', fontWeight: 'bold' }}>Daily Sales Trend</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setChartType('bar')}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: chartType === 'bar' ? '#0f172a' : '#ffffff', color: chartType === 'bar' ? '#ffffff' : '#475569' }}>
                        📊 Bar (7 days)
                      </button>
                      <button onClick={() => setChartType('line')}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: chartType === 'line' ? '#0f172a' : '#ffffff', color: chartType === 'line' ? '#ffffff' : '#475569' }}>
                        📈 Line (30 days)
                      </button>
                    </div>
                  </div>
                  {financials.dailyTrend && financials.dailyTrend.length > 0 ? (
                    <ChartView chartType={chartType} data={financials.dailyTrend} />
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No sales data for this period.</p>
                  )}
                </div>

                {/* ── SHOP PENDING BILLS ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: '0', fontSize: '15px', fontWeight: 'bold' }}>Shop Pending Bills</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <select value={selectedShopFilter} onChange={e => setSelectedShopFilter(e.target.value)}
                        style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', backgroundColor: '#ffffff', minWidth: '200px' }}>
                        <option value="all">All Shops</option>
                        {financials.shopPendingBills && [...new Set(financials.shopPendingBills.map(b => b.shopName))].map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button onClick={exportPendingBillsExcel}
                        style={{ padding: '8px 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                        ⬇ Download Excel
                      </button>
                    </div>
                  </div>
                  {financials.shopPendingBills && financials.shopPendingBills.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Bill Number</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Shop</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Total Bill</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Pending</th>
                      </tr></thead>
                      <tbody>
                        {financials.shopPendingBills
                          .filter(b => selectedShopFilter === 'all' || b.shopName === selectedShopFilter)
                          .map((bill, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{bill.billNumber}</td>
                              <td style={{ padding: '10px 12px' }}>{bill.shopName}</td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>{bill.date}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{parseFloat(bill.total).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>₹{parseFloat(bill.pending).toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                          <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '13px' }}>
                            {selectedShopFilter === 'all' ? 'All Shops Total' : selectedShopFilter}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                            ₹{financials.shopPendingBills.filter(b => selectedShopFilter === 'all' || b.shopName === selectedShopFilter).reduce((s, b) => s + parseFloat(b.total), 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>
                            ₹{financials.shopPendingBills.filter(b => selectedShopFilter === 'all' || b.shopName === selectedShopFilter).reduce((s, b) => s + parseFloat(b.pending), 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  ) : (
                    <p style={{ color: '#16a34a', fontSize: '13px', textAlign: 'center', padding: '20px' }}>✅ No pending bills!</p>
                  )}
                </div>

                {/* ── CREDIT AGING ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 'bold' }}>Credit Aging</h3>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[
                      { label: '0-7 days', key: 'aging07', color: '#16a34a' },
                      { label: '8-15 days', key: 'aging815', color: '#f59e0b' },
                      { label: '16-30 days', key: 'aging1630', color: '#f97316' },
                      { label: '30+ days', key: 'aging30plus', color: '#dc2626' }
                    ].map(item => (
                      <div key={item.key} style={{ flex: 1, minWidth: '120px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', borderTop: `4px solid ${item.color}`, textAlign: 'center' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{item.label}</p>
                        <strong style={{ fontSize: '18px', color: item.color }}>₹{(financials[item.key] || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── TOP PERFORMING SHOPS ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 'bold' }}>🏆 Top Performing Shops</h3>
                  {financials.topShops && financials.topShops.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {financials.topShops.map((shop, i) => {
                        const maxSales = financials.topShops[0].sales;
                        const pct = maxSales > 0 ? (shop.sales / maxSales) * 100 : 0;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#b45309', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ width: '140px', fontSize: '13px', fontWeight: '500', flexShrink: 0 }}>{shop.name}</span>
                            <div style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: '4px', height: '8px' }}>
                              <div style={{ width: `${pct}%`, backgroundColor: '#2563eb', borderRadius: '4px', height: '8px' }}></div>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', width: '90px', textAlign: 'right' }}>₹{shop.sales.toLocaleString('en-IN')}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '13px' }}>No data available.</p>
                  )}
                </div>

                {/* ── AGENT DETAILED REPORT ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>👥 Agent Detailed Report</h3>
                    {dateRange !== 'month' && agentTargets.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        🎯 Switch to "This Month" to see targets
                      </span>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: dateRange === 'month' ? '780px' : '560px', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Agent</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Bills</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Total Sales</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Collected</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Avg Bill</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Collection %</th>
                      {dateRange === 'month' && <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Sales vs Target</th>}
                      {dateRange === 'month' && <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Collection vs Target</th>}
                    </tr></thead>
                    <tbody>{Object.entries(financials.agentRankings || {}).map(([name, data], i) => {
                      const tgt = dateRange === 'month' ? agentTargets.find(t => t.agent_name === name) : null;
                      const sPct = tgt?.sales_target > 0 ? Math.min(100, Math.round(data.sales / tgt.sales_target * 100)) : null;
                      const cPct = tgt?.collection_target > 0 ? Math.min(100, Math.round(data.collected / tgt.collection_target * 100)) : null;
                      const tgtCell = (pct, target) => pct !== null ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: pct >= 100 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626' }}>{pct}%</span>
                          <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', margin: '4px 0 2px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 100 ? '#16a34a' : pct >= 75 ? '#f59e0b' : '#2563eb', borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>/ ₹{Number(target).toLocaleString('en-IN')}</span>
                        </div>
                      ) : <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{name}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{data.count || 0}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#2563eb' }}>₹{data.sales.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a' }}>₹{data.collected.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{data.count > 0 ? Math.round(data.sales / data.count).toLocaleString('en-IN') : 0}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span style={{ backgroundColor: data.sales > 0 && (data.collected / data.sales) >= 0.8 ? '#dcfce7' : '#fef9c3', color: data.sales > 0 && (data.collected / data.sales) >= 0.8 ? '#16a34a' : '#854d0e', padding: '3px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                              {data.sales > 0 ? Math.round((data.collected / data.sales) * 100) : 0}%
                            </span>
                          </td>
                          {dateRange === 'month' && <td style={{ padding: '10px 12px' }}>{tgtCell(sPct, tgt?.sales_target)}</td>}
                          {dateRange === 'month' && <td style={{ padding: '10px 12px' }}>{tgtCell(cPct, tgt?.collection_target)}</td>}
                        </tr>
                      );
                    })}</tbody>
                  </table>
                  </div>
                </div>

                {/* ── AGENT EXPENSES ── */}
                {(() => {
                  const agentNames = [...new Set(allExpenses.map(e => e.agent_name))].sort();
                  const filtered = allExpenses.filter(e =>
                    (expenseAgentFilter === 'all' || e.agent_name === expenseAgentFilter) &&
                    (expenseStatusFilter === 'all' || e.status === expenseStatusFilter)
                  );
                  const pendingTotal = allExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                  const approvedTotal = allExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                  return (
                    <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>💰 Agent Expenses</h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <select value={expenseAgentFilter} onChange={e => setExpenseAgentFilter(e.target.value)}
                            style={{ padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                            <option value="all">All Agents</option>
                            {agentNames.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <select value={expenseStatusFilter} onChange={e => setExpenseStatusFilter(e.target.value)}
                            style={{ padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {[
                          { label: '⏳ Pending', value: pendingTotal, color: '#d97706', bg: '#fef9c3' },
                          { label: '✓ Approved', value: approvedTotal, color: '#16a34a', bg: '#dcfce7' },
                          { label: '📦 Total Records', value: allExpenses.length, color: '#64748b', bg: '#f1f5f9', isCount: true },
                        ].map(item => (
                          <div key={item.label} style={{ flex: 1, minWidth: '120px', padding: '14px', backgroundColor: item.bg, borderRadius: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{item.label}</span>
                            <strong style={{ display: 'block', fontSize: '18px', color: item.color, marginTop: '4px' }}>
                              {item.isCount ? item.value : `₹${item.value.toLocaleString('en-IN')}`}
                            </strong>
                          </div>
                        ))}
                      </div>
                      {filtered.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No expenses found.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Date</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Agent</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Category</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Note</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Amount</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Status</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Receipt</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Action</th>
                            </tr></thead>
                            <tbody>{filtered.map(exp => {
                              const isPending = exp.status === 'pending';
                              const isApproved = exp.status === 'approved';
                              return (
                                <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(exp.expense_date).toLocaleDateString('en-IN')}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>{exp.agent_name}</td>
                                  <td style={{ padding: '10px 12px', color: '#475569' }}>{exp.category}</td>
                                  <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.note || '—'}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>₹{parseFloat(exp.amount).toLocaleString('en-IN')}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: isApproved ? '#dcfce7' : isPending ? '#fef9c3' : '#fee2e2', color: isApproved ? '#16a34a' : isPending ? '#ca8a04' : '#dc2626' }}>
                                      {isApproved ? '✓ Approved' : isPending ? '⏳ Pending' : '✕ Rejected'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    {exp.receipt_url ? (
                                      <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#2563eb', fontSize: '12px', fontWeight: 'bold', textDecoration: 'underline' }}>📷 View</a>
                                    ) : (
                                      <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    {isPending && (
                                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                        <button onClick={() => handleExpenseAction(exp.id, 'approved')}
                                          style={{ padding: '5px 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>✓ Approve</button>
                                        <button onClick={() => handleExpenseAction(exp.id, 'rejected')}
                                          style={{ padding: '5px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>✕ Reject</button>
                                      </div>
                                    )}
                                    {!isPending && (
                                      <button onClick={() => handleExpenseAction(exp.id, 'pending')}
                                        style={{ padding: '5px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Undo</button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── RETURNS & DAMAGES ── */}
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 'bold' }}>↩ Returns & Damages</h3>
                  {returnsList.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No returns or damages recorded yet.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {[
                          { label: '↩ Total Returns', value: returnsList.filter(r => r.return_type === 'return').reduce((s, r) => s + parseFloat(r.total_credit || 0), 0), color: '#2563eb' },
                          { label: '⚠️ Total Damages', value: returnsList.filter(r => r.return_type === 'damage').reduce((s, r) => s + parseFloat(r.total_credit || 0), 0), color: '#dc2626' },
                          { label: '📦 Total Records', value: returnsList.length, color: '#64748b', isCount: true }
                        ].map(item => (
                          <div key={item.label} style={{ flex: 1, minWidth: '120px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${item.color}` }}>
                            <span style={{ fontSize: '13px', color: '#64748b' }}>{item.label}</span>
                            <strong style={{ display: 'block', fontSize: '18px', color: item.color, marginTop: '4px' }}>
                              {item.isCount ? item.value : `₹${item.value.toLocaleString('en-IN')}`}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Date</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Bill</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Shop</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Agent</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Type</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Products</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Reason</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Credit</th>
                        </tr></thead>
                        <tbody>{returnsList.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{r.transactions?.bill_number || '—'}</td>
                            <td style={{ padding: '10px 12px' }}>{r.transactions?.shops?.name || '—'}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{r.agent_name}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: r.return_type === 'return' ? '#dbeafe' : '#fee2e2', color: r.return_type === 'return' ? '#1d4ed8' : '#dc2626' }}>
                                {r.return_type === 'return' ? '↩ Return' : '⚠️ Damage'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', maxWidth: '200px' }}>
                              {(r.return_items || []).length === 0 ? <span style={{ color: '#94a3b8' }}>—</span> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {r.return_items.map((item, i) => (
                                    <span key={i} style={{ fontSize: '12px', color: '#334155' }}>
                                      {item.product_name} × {item.quantity}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: r.return_type === 'return' ? '#2563eb' : '#dc2626' }}>₹{parseFloat(r.total_credit || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      </div>
                    </>
                  )}
                </div>

              </div>

            ) : activeTab === 'shops' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                {/* ── LIST / MAP TOGGLE ── */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { key: 'list', label: 'List View' },
                      { key: 'map', label: 'Map View' },
                      ...(can('shops_pricing') ? [{ key: 'pricing', label: '💰 Pricing' }] : []),
                    ].map(v => (
                      <button key={v.key} onClick={() => setShopsViewMode(v.key)}
                        style={{
                          padding: '8px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                          border: '1.5px solid ' + (shopsViewMode === v.key ? '#2563eb' : '#e2e8f0'),
                          backgroundColor: shopsViewMode === v.key ? '#2563eb' : '#ffffff',
                          color: shopsViewMode === v.key ? '#ffffff' : '#475569',
                        }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => handleNavClick('routes')}
                    style={{ padding: '8px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', border: 'none', backgroundColor: '#7c3aed', color: '#ffffff' }}>
                    🗺️ Plan Routes
                  </button>
                </div>

                {shopsViewMode === 'list' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Add New Shop</h3>
                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'flex-end', marginTop: '20px' }}>
                        <div style={{ flex: isMobile ? '1' : 'none' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Shop Name</label>
                          <input type="text" placeholder="e.g. Sri Murugan Stores" value={newShopName} onChange={(e) => setNewShopName(e.target.value)}
                            style={{ padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: isMobile ? '100%' : '250px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: isMobile ? '1' : 'none' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Phone</label>
                          <input type="tel" placeholder="9876543210" value={newShopPhone} onChange={(e) => setNewShopPhone(e.target.value)}
                            style={{ padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: isMobile ? '100%' : '180px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: isMobile ? '1' : 'none' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Address</label>
                          <input type="text" placeholder="Street, Area, City" value={newShopAddress} onChange={(e) => setNewShopAddress(e.target.value)}
                            style={{ padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: isMobile ? '100%' : '260px', boxSizing: 'border-box' }} />
                        </div>
                        <button onClick={async () => {
                          if (!newShopName.trim()) return alert('Enter shop name.');
                          setIsAddingShop(true);
                          const { error } = await supabase.from('shops').insert([{ name: newShopName.trim(), phone_number: newShopPhone.trim(), address: newShopAddress.trim() || null }]);
                          setIsAddingShop(false);
                          if (error) alert('Failed: ' + error.message);
                          else { addToast(`✅ "${newShopName}" added!`); setNewShopName(''); setNewShopPhone(''); setNewShopAddress(''); loadShops(); }
                        }} disabled={isAddingShop}
                          style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '41px' }}>
                          {isAddingShop ? 'Adding...' : '➕ Add Shop'}
                        </button>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>All Shops ({shopsList.length})</h3>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Name</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Phone</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Address</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>GPS</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Credit Limit (₹)</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px', minWidth: '160px' }}>Credit Usage</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Added</th>
                          <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Actions</th>
                        </tr></thead>
                        <tbody>{shopsList.map((shop) => (
                          <tr key={shop.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '14px 16px' }}>
                              <input type="text" value={shop.name} onChange={(e) => setShopsList(shopsList.map(s => s.id === shop.id ? { ...s, name: e.target.value } : s))}
                                style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '14px', width: '180px' }} />
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <input type="tel" value={shop.phone_number || ''} onChange={(e) => setShopsList(shopsList.map(s => s.id === shop.id ? { ...s, phone_number: e.target.value } : s))}
                                style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '14px', width: '130px' }} />
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <input type="text" value={shop.address || ''} placeholder="Street, Area, City" onChange={(e) => setShopsList(shopsList.map(s => s.id === shop.id ? { ...s, address: e.target.value } : s))}
                                style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '13px', width: '200px' }} />
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                              {shop.latitude && (
                                <div style={{ color: '#16a34a', marginBottom: '4px' }}>
                                  {parseFloat(shop.latitude).toFixed(4)}, {parseFloat(shop.longitude).toFixed(4)}
                                </div>
                              )}
                              <button
                                disabled={capturingGpsFor === shop.id}
                                onClick={() => {
                                  if (!navigator.geolocation) return alert('GPS not supported by this browser.');
                                  setCapturingGpsFor(shop.id);
                                  navigator.geolocation.getCurrentPosition(
                                    (pos) => {
                                      setShopsList(shopsList.map(s => s.id === shop.id ? { ...s, latitude: pos.coords.latitude, longitude: pos.coords.longitude } : s));
                                      setCapturingGpsFor(null);
                                    },
                                    () => { alert('Could not get location. Check browser permissions.'); setCapturingGpsFor(null); },
                                    { enableHighAccuracy: true, timeout: 10000 }
                                  );
                                }}
                                style={{ padding: '4px 8px', backgroundColor: shop.latitude ? '#f1f5f9' : '#eff6ff', color: shop.latitude ? '#475569' : '#2563eb', border: `1px solid ${shop.latitude ? '#e2e8f0' : '#bfdbfe'}`, borderRadius: '4px', cursor: capturingGpsFor === shop.id ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: '600' }}>
                                {capturingGpsFor === shop.id ? '⏳ Capturing…' : shop.latitude ? '📍 Re-capture' : '📍 Set GPS'}
                              </button>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <input
                                type="number" min="0" step="100"
                                value={shop.credit_limit ?? 0}
                                onChange={(e) => setShopsList(shopsList.map(s => s.id === shop.id ? { ...s, credit_limit: parseFloat(e.target.value) || 0 } : s))}
                                placeholder="0 = no limit"
                                style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '13px', width: '110px' }}
                              />
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              {(() => {
                                const limit = parseFloat(shop.credit_limit || 0);
                                const used = parseFloat(shop.credit_used || 0);
                                if (limit <= 0) return <span style={{ fontSize: '12px', color: '#94a3b8' }}>No limit</span>;
                                const pct = Math.min(100, (used / limit) * 100);
                                const barColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : '#10b981';
                                return (
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                                      <span>₹{used.toLocaleString('en-IN')}</span>
                                      <span>₹{limit.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.3s' }} />
                                    </div>
                                    <div style={{ fontSize: '11px', color: barColor, marginTop: '3px', fontWeight: '600' }}>{pct.toFixed(0)}% used</div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>{new Date(shop.created_at).toLocaleDateString('en-IN')}</td>
                            <td style={{ padding: '14px 16px', display: 'flex', gap: '8px' }}>
                              <button onClick={async () => {
                                const updatePayload = { name: shop.name, phone_number: shop.phone_number, address: shop.address || null, credit_limit: shop.credit_limit ?? 0, latitude: shop.latitude || null, longitude: shop.longitude || null };
                                const { error: saveError } = await supabase.from('shops').update(updatePayload).eq('id', shop.id);
                                if (saveError) {
                                  alert('Save failed: ' + saveError.message);
                                } else {
                                  addToast('✅ Shop saved!');
                                }
                              }} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                              <button onClick={async () => {
                                if (!window.confirm(`Delete "${shop.name}"?`)) return;
                                const { error } = await supabase.from('shops').delete().eq('id', shop.id);
                                if (error) alert('Failed.'); else loadShops();
                              }} style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                      </div>
                      {shopsList.length === 0 && <p style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No shops yet.</p>}
                    </div>
                  </div>
                ) : shopsViewMode === 'pricing' && can('shops_pricing') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Shop Pricing</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Prices agents negotiate in the field lock in automatically. Edit or reset them here.</p>
                      <select value={pricingShopId} onChange={(e) => loadShopPrices(e.target.value)}
                        style={{ padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', minWidth: '260px' }}>
                        <option value="">-- Select a shop --</option>
                        {[...shopsList].sort((a, b) => a.name.localeCompare(b.name)).map(shop => (
                          <option key={shop.id} value={shop.id}>{shop.name}</option>
                        ))}
                      </select>
                    </div>
                    {pricingShopId && (
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                          <h3 style={{ margin: 0, fontSize: '16px' }}>Products ({shopPricingRows.length})</h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Product</th>
                              <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>MRP (₹)</th>
                              <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Shop Price (₹)</th>
                              <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Actions</th>
                            </tr></thead>
                            <tbody>{shopPricingRows.map((row) => (
                              <tr key={row.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '14px 16px', fontWeight: '500' }}>{row.name}</td>
                                <td style={{ padding: '14px 16px', color: '#64748b' }}>₹{row.mrp.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '14px 16px' }}>
                                  <input type="number" min="0" max={row.mrp} step="1" value={row.price}
                                    onChange={(e) => setShopPricingRows(shopPricingRows.map(r => r.productId === row.productId ? { ...r, price: parseFloat(e.target.value) || 0 } : r))}
                                    style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '13px', width: '110px' }} />
                                  {row.overrideId && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#7c3aed', fontWeight: 'bold' }}>🔒 locked</span>}
                                </td>
                                <td style={{ padding: '14px 16px', display: 'flex', gap: '8px' }}>
                                  <button onClick={() => saveShopPrice(row)} disabled={savingShopPriceFor === row.productId}
                                    style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                                  {row.overrideId && (
                                    <button onClick={() => resetShopPriceToMrp(row)} disabled={savingShopPriceFor === row.productId}
                                      style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Reset to MRP</button>
                                  )}
                                </td>
                              </tr>
                            ))}</tbody>
                          </table>
                          {shopPricingRows.length === 0 && <p style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No active products.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>🏪 All Shops ({registeredShops.length})</h3>
                    <input type="text" placeholder="Search by name..." value={shopDirSearch} onChange={e => setShopDirSearch(e.target.value)}
                      style={{ padding: '8px 14px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', width: '220px' }} />
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Shop Name</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Phone</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Address</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Google Maps</th>
                      </tr></thead>
                      <tbody>
                        {registeredShops.filter(s => s.name.toLowerCase().includes(shopDirSearch.toLowerCase())).map(shop => (
                          <tr key={shop.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 14px', fontWeight: '500' }}>{shop.name}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{shop.phone_number || '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{shop.address || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              {shop.latitude && shop.longitude
                                ? <a href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} target="_blank" rel="noopener noreferrer"
                                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500', fontSize: '13px' }}>📍 Open Maps</a>
                                : <span style={{ color: '#94a3b8', fontSize: '13px' }}>No GPS set</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {registeredShops.filter(s => s.name.toLowerCase().includes(shopDirSearch.toLowerCase())).length === 0 &&
                      <p style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No shops found.</p>}
                  </div>
                </div>

              </div>
                )}
              </div>

            ) : activeTab === 'routes' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

                {/* ── WEEKLY BEAT PLAN ── */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>📅 Weekly Beat Plan</h3>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Assign which shops each agent visits on which day of the week.</p>

                  {/* Add assignment */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Day</label>
                      <select value={beatNewDay} onChange={e => setBeatNewDay(e.target.value)}
                        style={{ padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', backgroundColor: '#ffffff' }}>
                        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i) => (
                          <option key={i} value={String(i)}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Shop</label>
                      <select value={beatNewShop} onChange={e => setBeatNewShop(e.target.value)}
                        style={{ padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', backgroundColor: '#ffffff', minWidth: '180px' }}>
                        <option value="">-- Select Shop --</option>
                        {shopsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Agent</label>
                      <select value={beatNewAgent} onChange={e => setBeatNewAgent(e.target.value)}
                        style={{ padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', backgroundColor: '#ffffff', minWidth: '160px' }}>
                        <option value="">-- Select Agent --</option>
                        {activeAgents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>
                    <button disabled={isAddingBeat || !beatNewShop || !beatNewAgent} onClick={async () => {
                      setIsAddingBeat(true);
                      const { error } = await supabase.from('beat_plans').upsert([{
                        shop_id: beatNewShop,
                        employee_name: beatNewAgent,
                        day_of_week: parseInt(beatNewDay),
                      }], { onConflict: 'shop_id,day_of_week' });
                      setIsAddingBeat(false);
                      if (error) alert('Failed: ' + error.message);
                      else { setBeatNewShop(''); setBeatNewAgent(''); loadBeatPlan(); }
                    }} style={{ padding: '9px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px' }}>
                      {isAddingBeat ? 'Saving...' : '➕ Assign'}
                    </button>
                  </div>

                  {/* Beat plan table grouped by day */}
                  {beatPlan.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '13px' }}>No assignments yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Day</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Shop</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Agent</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Action</th>
                        </tr></thead>
                        <tbody>{beatPlan.map(bp => (
                          <tr key={bp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#334155' }}>
                              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][bp.day_of_week]}
                            </td>
                            <td style={{ padding: '10px 14px' }}>{bp.shops?.name || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>{bp.employee_name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <button onClick={async () => {
                                await supabase.from('beat_plans').delete().eq('id', bp.id);
                                loadBeatPlan();
                              }} style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── AI ROUTE OPTIMIZER ── */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>AI Route Optimizer</h3>
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>Uses today's beat plan shops for the selected agent. Falls back to approved orders if no beat plan is set.</p>
                  <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#94a3b8' }}>Today: {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Agent Selector */}
                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '13px' }}>Select Agent</label>
                      <select value={routeAgent} onChange={e => setRouteAgent(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', backgroundColor: '#ffffff' }}>
                        <option value="">-- Select Agent --</option>
                        {activeAgents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>

                    {/* Starting Point */}
                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>Starting Point</label>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <button type="button"
                          onClick={() => setRouteStartMode('gps')}
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${routeStartMode === 'gps' ? '#2563eb' : '#e2e8f0'}`, backgroundColor: routeStartMode === 'gps' ? '#eff6ff' : '#ffffff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', color: routeStartMode === 'gps' ? '#1d4ed8' : '#475569' }}>
                          📍 My Current Location (HQ)
                        </button>
                        <button type="button"
                          onClick={() => setRouteStartMode('custom')}
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${routeStartMode === 'custom' ? '#2563eb' : '#e2e8f0'}`, backgroundColor: routeStartMode === 'custom' ? '#eff6ff' : '#ffffff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', color: routeStartMode === 'custom' ? '#1d4ed8' : '#475569' }}>
                          ✏️ Custom Location
                        </button>
                      </div>

                      {routeStartMode === 'gps' && (
                        <div>
                          <button type="button" onClick={captureRouteStartGps}
                            disabled={isCapturingRouteGps}
                            style={{ width: '100%', padding: '12px', backgroundColor: routeStartCoords ? '#10b981' : '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                            {isCapturingRouteGps ? '📡 Getting Location...' : routeStartCoords ? `✅ Location Captured (${routeStartCoords.lat.toFixed(4)}, ${routeStartCoords.lng.toFixed(4)})` : '📍 Capture My Current Location'}
                          </button>
                        </div>
                      )}

                      {routeStartMode === 'custom' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Latitude</label>
                            <input type="number" step="0.0001" placeholder="e.g. 9.9252" value={customStartLat}
                              onChange={e => setCustomStartLat(e.target.value)}
                              style={{ width: '100%', padding: '10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Longitude</label>
                            <input type="number" step="0.0001" placeholder="e.g. 78.1198" value={customStartLng}
                              onChange={e => setCustomStartLng(e.target.value)}
                              style={{ width: '100%', padding: '10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Generate Button */}
                    <button type="button" onClick={generateOptimizedRoute}
                      disabled={isGeneratingRoute || !routeAgent}
                      style={{ padding: '14px', backgroundColor: isGeneratingRoute ? '#94a3b8' : '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: isGeneratingRoute || !routeAgent ? 'not-allowed' : 'pointer' }}>
                      {isGeneratingRoute ? '🤖 Optimizing Route...' : '🤖 Generate Optimized Route'}
                    </button>
                  </div>
                </div>

                {/* ── OPTIMIZED ROUTE RESULT ── */}
                {optimizedRoute.length > 0 && (
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold' }}>🗺️ Optimized Route for {routeAgent}</h3>
                        <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>
                          {optimizedRoute.length} stops • Est. distance: ~{routeTotalDistance} km
                        </p>
                      </div>
                      <a href={generateGoogleMapsUrl()} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}>
                        🗺️ Open in Google Maps
                      </a>
                    </div>

                    {/* Route Steps */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {/* Start point */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>🏠</div>
                          <div style={{ width: '2px', flex: 1, backgroundColor: '#e2e8f0', marginTop: '4px', minHeight: '20px' }}></div>
                        </div>
                        <div style={{ paddingTop: '6px' }}>
                          <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>Starting Point</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>{routeStartMode === 'gps' ? 'Your Current Location (HQ)' : 'Custom Location'}</p>
                        </div>
                      </div>

                      {optimizedRoute.map((shop, i) => (
                        <div key={shop.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{i + 1}</div>
                            {i < optimizedRoute.length - 1 && <div style={{ width: '2px', flex: 1, backgroundColor: '#e2e8f0', marginTop: '4px', minHeight: '20px' }}></div>}
                          </div>
                          <div style={{ paddingTop: '6px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{shop.name}</p>
                                  {shop.pendingBills?.length > 0 && (
                                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '10px', border: '1px solid #fbbf24' }}>
                                      📦 {shop.pendingBills.length} pending
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>📞 {shop.phone_number || 'No contact'}</p>
                                {shop.distanceFromPrev && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>~{shop.distanceFromPrev} km from previous stop</p>}
                              </div>
                              <a href={`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', textDecoration: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>
                                Maps
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── LIVE MAP ── */}
                <div>
                  <h3 style={{ fontSize: '15px', margin: '0 0 12px', fontWeight: 'bold' }}>📍 All Shop Locations</h3>
                  <InteractiveRouteMap shops={optimizedRoute.length > 0 ? optimizedRoute : registeredShops} />
                </div>

              </div>

            ) : activeTab === 'settings' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

                {/* ── TEAM / PRODUCTS / INVOICE TOGGLE ── */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { key: 'team', label: 'Team' },
                    { key: 'products', label: 'Products' },
                    { key: 'invoice', label: 'Invoice' },
                  ].map(t => (
                    <button key={t.key} onClick={() => setSettingsSubTab(t.key)}
                      style={{
                        padding: '8px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        border: '1.5px solid ' + (settingsSubTab === t.key ? '#2563eb' : '#e2e8f0'),
                        backgroundColor: settingsSubTab === t.key ? '#2563eb' : '#ffffff',
                        color: settingsSubTab === t.key ? '#ffffff' : '#475569',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {settingsSubTab === 'team' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                    {/* 1. Invite New Agent */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Invite New Agent</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Agent receives email invitation to set password and log in.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
                        <input type="text" placeholder="Agent Full Name" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)}
                          style={{ padding: '12px', border: '2px solid #cbd5e1', borderRadius: '6px', fontSize: '15px' }} />
                        <input type="email" placeholder="Agent Email" value={newAgentEmail} onChange={(e) => setNewAgentEmail(e.target.value)}
                          style={{ padding: '12px', border: '2px solid #cbd5e1', borderRadius: '6px', fontSize: '15px' }} />
                        <button onClick={handleInviteAgent} disabled={isAddingAgent}
                          style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: isAddingAgent ? 0.7 : 1 }}>
                          {isAddingAgent ? 'Sending...' : '✉️ Send Invitation'}
                        </button>
                        {inviteMessage && <p style={{ margin: '0', fontSize: '13px', color: inviteMessage.includes('✅') ? '#16a34a' : '#dc2626', fontWeight: '500' }}>{inviteMessage}</p>}
                      </div>
                    </div>

                    {/* 1b. Invite Dispatcher */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Invite Dispatcher</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Pick exactly what this dispatcher can access below — you can change it anytime after inviting them.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
                        <input type="text" placeholder="Dispatcher Full Name" value={newDispatcherName} onChange={(e) => setNewDispatcherName(e.target.value)}
                          style={{ padding: '12px', border: '2px solid #cbd5e1', borderRadius: '6px', fontSize: '15px' }} />
                        <input type="email" placeholder="Dispatcher Email" value={newDispatcherEmail} onChange={(e) => setNewDispatcherEmail(e.target.value)}
                          style={{ padding: '12px', border: '2px solid #cbd5e1', borderRadius: '6px', fontSize: '15px' }} />
                        <div>
                          <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Access</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {PERMISSION_OPTIONS.map(opt => (
                              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newDispatcherPermissions.includes(opt.key)}
                                  onChange={(e) => setNewDispatcherPermissions(prev => e.target.checked ? [...prev, opt.key] : prev.filter(p => p !== opt.key))} />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <button onClick={handleInviteDispatcher} disabled={isAddingDispatcher}
                          style={{ padding: '12px 24px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: isAddingDispatcher ? 0.7 : 1 }}>
                          {isAddingDispatcher ? 'Sending...' : '✉️ Send Invitation'}
                        </button>
                        {dispatcherInviteMessage && <p style={{ margin: '0', fontSize: '13px', color: dispatcherInviteMessage.includes('✅') ? '#16a34a' : '#dc2626', fontWeight: '500' }}>{dispatcherInviteMessage}</p>}
                      </div>
                    </div>

                    {/* 2. Leave Requests */}
                    {(() => {
                      // Bucket by agent+reason+status first, then merge consecutive dates within each bucket —
                      // this stops an unrelated leave row that happens to land on an in-between date (different
                      // reason/status) from splitting one real multi-day request into two groups.
                      const buckets = new Map();
                      for (const leave of allLeaveRequests) {
                        const key = `${leave.agent_id}||${leave.reason}||${leave.status}`;
                        if (!buckets.has(key)) buckets.set(key, []);
                        buckets.get(key).push(leave);
                      }
                      const groups = [];
                      for (const bucket of buckets.values()) {
                        const sortedBucket = [...bucket].sort((a, b) => a.leave_date.localeCompare(b.leave_date));
                        let current = null;
                        for (const leave of sortedBucket) {
                          const isConsecutive = current && (new Date(leave.leave_date) - new Date(current.endDate)) === 86400000;
                          if (current && isConsecutive) {
                            current.endDate = leave.leave_date;
                            current.days++;
                            current.ids.push(leave.id);
                            current.leaves.push(leave);
                          } else {
                            current = { agent_id: leave.agent_id, agent_name: leave.agent_name, reason: leave.reason, status: leave.status, startDate: leave.leave_date, endDate: leave.leave_date, days: 1, ids: [leave.id], leaves: [leave] };
                            groups.push(current);
                          }
                        }
                      }
                      groups.sort((a, b) => b.startDate.localeCompare(a.startDate));

                      const agentNames = [...new Set(allLeaveRequests.map(l => l.agent_name))].sort();
                      const filteredGroups = groups.filter(g =>
                        (leaveAgentFilter === 'all' || g.agent_name === leaveAgentFilter) &&
                        (leaveStatusFilter === 'all' || g.status === leaveStatusFilter)
                      );
                      const pendingCount = groups.filter(g => g.status === 'pending').length;
                      const approvedCount = groups.filter(g => g.status === 'approved').length;

                      return (
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>🏖️ Leave Requests</h3>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <select value={leaveAgentFilter} onChange={e => setLeaveAgentFilter(e.target.value)}
                                style={{ padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                                <option value="all">All Agents</option>
                                {agentNames.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                              <select value={leaveStatusFilter} onChange={e => setLeaveStatusFilter(e.target.value)}
                                style={{ padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {[
                              { label: '⏳ Pending', value: pendingCount, color: '#ca8a04', bg: '#fef9c3' },
                              { label: '✓ Approved', value: approvedCount, color: '#16a34a', bg: '#dcfce7' },
                              { label: '📦 Total Requests', value: groups.length, color: '#64748b', bg: '#f1f5f9' },
                            ].map(item => (
                              <div key={item.label} style={{ flex: 1, minWidth: '120px', padding: '14px', backgroundColor: item.bg, borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>{item.label}</span>
                                <strong style={{ display: 'block', fontSize: '18px', color: item.color, marginTop: '4px' }}>{item.value}</strong>
                              </div>
                            ))}
                          </div>
                          {filteredGroups.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No leave requests found.</p>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Dates</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Agent</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Reason</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Status</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Action</th>
                                </tr></thead>
                                <tbody>{filteredGroups.map(group => {
                                  const isPending = group.status === 'pending';
                                  const isApproved = group.status === 'approved';
                                  const isSingle = group.startDate === group.endDate;
                                  const dateLabel = isSingle
                                    ? new Date(group.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : `${new Date(group.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(group.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
                                  return (
                                    <Fragment key={group.ids[0]}>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '10px 12px', color: '#0f172a' }}>
                                        {dateLabel}{!isSingle && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>{group.days} days</span>}
                                      </td>
                                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{group.agent_name}</td>
                                      <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.reason || '—'}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: isApproved ? '#dcfce7' : isPending ? '#fef9c3' : '#fee2e2', color: isApproved ? '#16a34a' : isPending ? '#ca8a04' : '#dc2626' }}>
                                          {isApproved ? '✓ Approved' : isPending ? '⏳ Pending' : '✕ Rejected'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        {isPending && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                              <button onClick={() => handleLeaveAction(group, 'approved')}
                                                style={{ padding: '5px 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>✓ Approve</button>
                                              <button onClick={() => handleLeaveAction(group, 'rejected')}
                                                style={{ padding: '5px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>✕ Reject</button>
                                            </div>
                                            {group.days > 1 && (
                                              <button onClick={() => setExpandedLeaveGroups(prev => ({ ...prev, [group.ids[0]]: !prev[group.ids[0]] }))}
                                                style={{ padding: '2px 6px', background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>
                                                {expandedLeaveGroups[group.ids[0]] ? '▴ Hide days' : '▾ Approve/reject individual days'}
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {!isPending && (
                                          <button onClick={() => handleLeaveAction(group, 'pending')}
                                            style={{ padding: '5px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Undo</button>
                                        )}
                                      </td>
                                    </tr>
                                    {isPending && group.days > 1 && expandedLeaveGroups[group.ids[0]] && (
                                      <tr style={{ backgroundColor: '#faf5ff', borderBottom: '1px solid #f1f5f9' }}>
                                        <td colSpan={5} style={{ padding: '10px 12px 14px 28px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {group.leaves.map(leave => (
                                              <div key={leave.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '12px', padding: '6px 10px', backgroundColor: '#fff', border: '1px solid #e9d5ff', borderRadius: '6px' }}>
                                                <span style={{ color: '#0f172a' }}>{new Date(leave.leave_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                  <button onClick={() => handleLeaveAction({ agent_id: group.agent_id, agent_name: group.agent_name, reason: group.reason, startDate: leave.leave_date, endDate: leave.leave_date, days: 1, ids: [leave.id] }, 'approved')}
                                                    style={{ padding: '3px 10px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>✓ Approve</button>
                                                  <button onClick={() => handleLeaveAction({ agent_id: group.agent_id, agent_name: group.agent_name, reason: group.reason, startDate: leave.leave_date, endDate: leave.leave_date, days: 1, ids: [leave.id] }, 'rejected')}
                                                    style={{ padding: '3px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>✕ Reject</button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    </Fragment>
                                  );
                                })}</tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── ATTENDANCE ── */}
                    {(() => {
                      const presentSet = new Set(attendance.map(a => a.agent_name));
                      const leaveSet = new Set(attendanceLeaves.map(l => l.agent_name));
                      const presentCount = agentsList.filter(a => presentSet.has(a.full_name)).length;
                      const leaveCount = agentsList.filter(a => leaveSet.has(a.full_name)).length;
                      const absentCount = agentsList.length - presentCount - leaveCount;
                      const isToday = attendanceDate === new Date().toISOString().slice(0, 10);
                      return (
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>📋 Attendance</h3>
                              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{presentCount} of {agentsList.length} present{leaveCount > 0 ? ` · ${leaveCount} on leave` : ''}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="date" value={attendanceDate} max={new Date().toISOString().slice(0,10)}
                                onChange={e => { setAttendanceDate(e.target.value); loadAttendance(e.target.value); }}
                                style={{ padding: '7px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }} />
                              {isToday && <span style={{ fontSize: '11px', backgroundColor: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Today</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {[
                              { label: '✅ Present', value: presentCount, color: '#16a34a', bg: '#dcfce7' },
                              { label: '🏖️ On Leave', value: leaveCount, color: '#d97706', bg: '#fef9c3' },
                              { label: '✗ Absent', value: absentCount, color: '#dc2626', bg: '#fee2e2' },
                            ].map(s => (
                              <div key={s.label} style={{ flex: 1, minWidth: '90px', padding: '12px', backgroundColor: s.bg, borderRadius: '8px', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#64748b' }}>{s.label}</p>
                                <strong style={{ fontSize: '22px', color: s.color }}>{s.value}</strong>
                              </div>
                            ))}
                          </div>
                          {agentsList.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '13px' }}>No agents found.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {agentsList.map(agent => {
                                const rec = attendance.find(a => a.agent_name === agent.full_name);
                                const onLeave = leaveSet.has(agent.full_name);
                                const isPresent = !!rec;
                                return (
                                  <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', backgroundColor: isPresent ? '#f0fdf4' : onLeave ? '#fefce8' : '#fef2f2', border: `1px solid ${isPresent ? '#bbf7d0' : onLeave ? '#fde68a' : '#fecaca'}` }}>
                                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{agent.full_name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      {rec && <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(rec.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                                      <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: isPresent ? '#dcfce7' : onLeave ? '#fef9c3' : '#fee2e2', color: isPresent ? '#15803d' : onLeave ? '#92400e' : '#dc2626' }}>
                                        {isPresent ? '✅ Present' : onLeave ? '🏖️ On Leave' : '✗ Absent'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Agent Performance Summary */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>📊 Agent Performance</h3>
                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Deliveries and collections by agent.</p>
                        </div>
                        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                          <button onClick={() => setAgentPerfView('today')} style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: agentPerfView === 'today' ? '#0f172a' : '#f8fafc', color: agentPerfView === 'today' ? '#ffffff' : '#475569' }}>Today</button>
                          <button onClick={() => setAgentPerfView('week')} style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: agentPerfView === 'week' ? '#0f172a' : '#f8fafc', color: agentPerfView === 'week' ? '#ffffff' : '#475569', borderLeft: '1px solid #e2e8f0' }}>This Week</button>
                        </div>
                      </div>
                      {agentsList.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '13px' }}>No agents found.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569' }}>Agent</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>Bills Delivered</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>Sales</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>Collected</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>Efficiency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {agentsList
                                .map(agent => {
                                  const d = (agentPerfView === 'today' ? agentPerf.today : agentPerf.week)[agent.full_name] || { bills: 0, sales: 0, collected: 0 };
                                  return { agent, d, eff: d.sales > 0 ? Math.round((d.collected / d.sales) * 100) : 0 };
                                })
                                .sort((a, b) => b.d.sales - a.d.sales)
                                .map(({ agent, d, eff }, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', opacity: d.bills === 0 ? 0.45 : 1 }}>
                                    <td style={{ padding: '11px 14px', fontWeight: 'bold' }}>{agent.full_name}</td>
                                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                                      {d.bills > 0
                                        ? <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '2px 10px', borderRadius: '12px', fontWeight: 'bold' }}>{d.bills}</span>
                                        : <span style={{ color: '#cbd5e1' }}>0</span>}
                                    </td>
                                    <td style={{ padding: '11px 14px', textAlign: 'right', color: d.sales > 0 ? '#2563eb' : '#cbd5e1', fontWeight: d.sales > 0 ? 'bold' : 'normal' }}>₹{d.sales.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '11px 14px', textAlign: 'right', color: d.collected > 0 ? '#16a34a' : '#cbd5e1', fontWeight: d.collected > 0 ? 'bold' : 'normal' }}>₹{d.collected.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                                      {d.bills > 0
                                        ? <span style={{ backgroundColor: eff >= 80 ? '#dcfce7' : '#fef9c3', color: eff >= 80 ? '#15803d' : '#854d0e', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px' }}>{eff}%</span>
                                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ── TARGET VS ACHIEVEMENT ── */}
                    {agentTargets.length > 0 && (() => {
                      const month = new Date().toISOString().slice(0, 7);
                      const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                      const rows = agentsList.map(agent => {
                        const tgt = agentTargets.find(t => t.agent_name === agent.full_name);
                        const actual = agentPerfMonth[agent.full_name] || { sales: 0, collected: 0, bills: 0 };
                        return { name: agent.full_name, tgt, actual };
                      }).filter(r => r.tgt);
                      if (rows.length === 0) return null;
                      return (
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>🎯 Target vs Achievement</h3>
                              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{monthLabel} · month-to-date</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {rows.sort((a, b) => {
                              const aPct = a.tgt?.sales_target > 0 ? a.actual.sales / a.tgt.sales_target : 0;
                              const bPct = b.tgt?.sales_target > 0 ? b.actual.sales / b.tgt.sales_target : 0;
                              return bPct - aPct;
                            }).map(({ name, tgt, actual }, i) => {
                              const salesPct = tgt.sales_target > 0 ? Math.min(100, Math.round(actual.sales / tgt.sales_target * 100)) : null;
                              const collPct = tgt.collection_target > 0 ? Math.min(100, Math.round(actual.collected / tgt.collection_target * 100)) : null;
                              const statusColor = salesPct === null ? '#94a3b8' : salesPct >= 100 ? '#16a34a' : salesPct >= 70 ? '#d97706' : '#dc2626';
                              const statusLabel = salesPct === null ? '—' : salesPct >= 100 ? '✅ On Target' : salesPct >= 70 ? '⚡ On Track' : '⚠️ Behind';
                              return (
                                <div key={name} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{name}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: statusColor }}>{statusLabel}</span>
                                  </div>
                                  {salesPct !== null && (
                                    <div style={{ marginBottom: '10px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                        <span style={{ color: '#475569' }}>Sales · ₹{actual.sales.toLocaleString('en-IN')} / ₹{Number(tgt.sales_target).toLocaleString('en-IN')}</span>
                                        <span style={{ fontWeight: 'bold', color: salesPct >= 100 ? '#16a34a' : salesPct >= 70 ? '#d97706' : '#dc2626' }}>{salesPct}%</span>
                                      </div>
                                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
                                        <div style={{ height: '100%', width: `${salesPct}%`, backgroundColor: salesPct >= 100 ? '#16a34a' : salesPct >= 70 ? '#d97706' : '#dc2626', borderRadius: '4px', transition: 'width 0.4s' }} />
                                      </div>
                                    </div>
                                  )}
                                  {collPct !== null && (
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                        <span style={{ color: '#475569' }}>Collection · ₹{actual.collected.toLocaleString('en-IN')} / ₹{Number(tgt.collection_target).toLocaleString('en-IN')}</span>
                                        <span style={{ fontWeight: 'bold', color: collPct >= 100 ? '#16a34a' : collPct >= 70 ? '#d97706' : '#dc2626' }}>{collPct}%</span>
                                      </div>
                                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
                                        <div style={{ height: '100%', width: `${collPct}%`, backgroundColor: collPct >= 100 ? '#16a34a' : collPct >= 70 ? '#d97706' : '#dc2626', borderRadius: '4px', transition: 'width 0.4s' }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── TODAY'S SHOP VISITS ── */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>📍 Today's Shop Visits</h3>
                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{shopVisits.length} check-in{shopVisits.length !== 1 ? 's' : ''} recorded today</p>
                        </div>
                        <button onClick={loadShopVisits} style={{ padding: '6px 14px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: '#f8fafc', color: '#475569' }}>↺ Refresh</button>
                      </div>
                      {shopVisits.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No check-ins today yet.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Time</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Agent</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Shop</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Outcome</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>GPS Distance</th>
                              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Note</th>
                            </tr></thead>
                            <tbody>{shopVisits.map(v => {
                              const shopLat = v.shops?.latitude; const shopLng = v.shops?.longitude;
                              const distM = (v.latitude && shopLat)
                                ? Math.round(calcDistance(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(shopLat), parseFloat(shopLng)) * 1000)
                                : null;
                              const isVisited = v.outcome === 'visited'; const isClosed = v.outcome === 'closed';
                              return (
                                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(v.visited_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>{v.agent_name}</td>
                                  <td style={{ padding: '10px 12px' }}>{v.shop_name}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: isVisited ? '#dcfce7' : isClosed ? '#fee2e2' : '#fef9c3', color: isVisited ? '#15803d' : isClosed ? '#dc2626' : '#854d0e' }}>
                                      {isVisited ? '✅ Visited' : isClosed ? '🔒 Closed' : '🚫 No Answer'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: distM === null ? '#94a3b8' : distM <= 200 ? '#16a34a' : distM <= 500 ? '#d97706' : '#dc2626', fontWeight: distM !== null ? 'bold' : 'normal' }}>
                                    {distM === null ? '—' : distM < 1000 ? `${distM}m` : `${(distM/1000).toFixed(1)}km`}
                                  </td>
                                  <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.note || '—'}</td>
                                </tr>
                              );
                            })}</tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 2. Field Agents List */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Field Agents</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Manage active field agents. Removing an agent revokes login access but preserves all their past bills.</p>
                      {agentsList.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '14px' }}>No agents found.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Name</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Email</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Bills Handled</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Joined</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Action</th>
                          </tr></thead>
                          <tbody>{agentsList.map((agent) => (
                            <tr key={agent.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '14px 16px' }}>
                                <button onClick={() => loadAgentProfile(agent)}
                                  style={{ background: 'none', border: 'none', fontWeight: 'bold', fontSize: '14px', color: '#2563eb', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                                  {agent.full_name}
                                </button>
                              </td>
                              <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>{agent.email}</td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>{agent.billCount} bills</span>
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>{new Date(agent.created_at).toLocaleDateString('en-IN')}</td>
                              <td style={{ padding: '14px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={() => { const currentMonth = new Date().toISOString().slice(0, 7); const tgt = agentTargets.find(t => t.agent_name === agent.full_name); setTargetModal({ agentName: agent.full_name, month: currentMonth, salesTarget: tgt?.sales_target ?? '', collectionTarget: tgt?.collection_target ?? '' }); }}
                                  style={{ padding: '8px 14px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                >🎯 Target</button>
                                <button
                                  onClick={() => handleDeleteAgent(agent)}
                                  disabled={isDeletingAgent === agent.id}
                                  style={{ padding: '8px 14px', backgroundColor: isDeletingAgent === agent.id ? '#e2e8f0' : '#fee2e2', color: isDeletingAgent === agent.id ? '#94a3b8' : '#dc2626', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                >{isDeletingAgent === agent.id ? 'Removing...' : '🗑 Remove Agent'}</button>
                              </td>
                            </tr>
                          ))}</tbody>
                        </table>
                        </div>
                      )}
                    </div>

                    {/* 2b. Dispatchers List */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Dispatchers</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Removing a dispatcher revokes login access.</p>
                      {dispatchersList.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '14px' }}>No dispatchers found.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: '460px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Name</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Email</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Joined</th>
                            <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Action</th>
                          </tr></thead>
                          <tbody>{dispatchersList.map((dispatcher) => (
                            <Fragment key={dispatcher.id}>
                            <tr style={{ borderBottom: editingPermissionsFor === dispatcher.id ? 'none' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '14px 16px', fontWeight: 'bold', fontSize: '14px' }}>{dispatcher.full_name}</td>
                              <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>{dispatcher.email}</td>
                              <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>{new Date(dispatcher.created_at).toLocaleDateString('en-IN')}</td>
                              <td style={{ padding: '14px 16px', display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => { setEditingPermissionsFor(dispatcher.id); setEditPermissionsDraft(dispatcher.permissions || []); }}
                                  style={{ padding: '8px 14px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                >Edit Access</button>
                                <button
                                  onClick={() => handleDeleteDispatcher(dispatcher)}
                                  disabled={isDeletingDispatcher === dispatcher.id}
                                  style={{ padding: '8px 14px', backgroundColor: isDeletingDispatcher === dispatcher.id ? '#e2e8f0' : '#fee2e2', color: isDeletingDispatcher === dispatcher.id ? '#94a3b8' : '#dc2626', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                >{isDeletingDispatcher === dispatcher.id ? 'Removing...' : '🗑 Remove Dispatcher'}</button>
                              </td>
                            </tr>
                            {editingPermissionsFor === dispatcher.id && (
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td colSpan={4} style={{ padding: '4px 16px 18px', backgroundColor: '#f8fafc' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                                    {PERMISSION_OPTIONS.map(opt => (
                                      <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={editPermissionsDraft.includes(opt.key)}
                                          onChange={(e) => setEditPermissionsDraft(prev => e.target.checked ? [...prev, opt.key] : prev.filter(p => p !== opt.key))} />
                                        {opt.label}
                                      </label>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleUpdatePermissions(dispatcher.id)} disabled={isSavingPermissions}
                                      style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', opacity: isSavingPermissions ? 0.7 : 1 }}
                                    >{isSavingPermissions ? 'Saving...' : 'Save'}</button>
                                    <button onClick={() => setEditingPermissionsFor(null)} disabled={isSavingPermissions}
                                      style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                    >Cancel</button>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          ))}</tbody>
                        </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {settingsSubTab === 'products' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                    {/* 3. Add New Product */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Add New Product</h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target;
                        const name = form.prodName.value.trim();
                        const price = parseFloat(form.prodPrice.value) || 0;
                        const stock = parseInt(form.prodStock.value) || 0;
                        const threshold = parseInt(form.prodThreshold.value) || 10;
                        if (!name) return alert('Enter product name.');
                        const { error } = await supabase.from('products').insert([{ id: crypto.randomUUID(), name, unit_price: price, inventory_stock: stock, low_stock_threshold: threshold, is_active: true }]);
                        if (error) alert(`Error: ${error.message}`);
                        else { addToast(`✅ "${name}" added!`); form.reset(); loadMasterProducts(); }
                      }} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', marginTop: '20px' }}>
                        <div style={{ flex: '1', minWidth: '200px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Product Name</label>
                          <input type="text" name="prodName" placeholder="e.g. Premium Box" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ width: '130px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Price (₹)</label>
                          <input type="number" name="prodPrice" placeholder="450" min="0" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ width: '130px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Stock</label>
                          <input type="number" name="prodStock" placeholder="100" min="0" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ width: '130px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Alert below</label>
                          <input type="number" name="prodThreshold" placeholder="10" min="0" defaultValue="10" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
                        </div>
                        <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '41px' }}>📦 Add</button>
                      </form>
                    </div>

                    {/* 5. Product Catalog */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Product Catalog</h3>
                      <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '16px', color: '#475569' }}>Name</th>
                          <th style={{ padding: '16px', color: '#475569', width: '160px' }}>Price (₹)</th>
                          <th style={{ padding: '16px', color: '#475569', width: '160px' }}>Stock</th>
                          <th style={{ padding: '16px', color: '#475569', width: '130px' }}>Min Stock</th>
                          <th style={{ padding: '16px', color: '#475569', width: '200px' }}>Actions</th>
                        </tr></thead>
                        <tbody>{productsCatalog.filter(p => p.is_active !== false).map((prod) => {
                          const threshold = prod.low_stock_threshold || 10;
                          const isLow = threshold > 0 && prod.inventory_stock <= threshold;
                          return (
                          <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isLow ? '#fffbeb' : 'transparent' }}>
                            <td style={{ padding: '16px' }}>
                              <input type="text" value={prod.name} onChange={(e) => { const u = [...productsCatalog]; u[u.findIndex(i => i.id === prod.id)].name = e.target.value; setProductsCatalog(u); }}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            </td>
                            <td style={{ padding: '16px' }}>
                              <input type="number" value={prod.unit_price} onChange={(e) => { const u = [...productsCatalog]; u[u.findIndex(i => i.id === prod.id)].unit_price = e.target.value; setProductsCatalog(u); }}
                                style={{ width: '110px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#16a34a', fontWeight: 'bold' }} />
                            </td>
                            <td style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input type="number" value={prod.inventory_stock} onChange={(e) => { const u = [...productsCatalog]; u[u.findIndex(i => i.id === prod.id)].inventory_stock = e.target.value; setProductsCatalog(u); }}
                                  style={{ width: '90px', padding: '8px', borderRadius: '4px', border: `1px solid ${isLow ? '#dc2626' : '#cbd5e1'}`, fontWeight: 'bold', color: isLow ? '#dc2626' : '#0f172a' }} />
                                {isLow && <span style={{ fontSize: '14px' }}>⚠️</span>}
                              </div>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <input type="number" min="0" value={threshold} onChange={(e) => { const u = [...productsCatalog]; u[u.findIndex(i => i.id === prod.id)].low_stock_threshold = parseInt(e.target.value) || 0; setProductsCatalog(u); }}
                                style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#64748b' }} />
                            </td>
                            <td style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                              <button onClick={async () => {
                                const { error } = await supabase.from('products').update({ name: prod.name, unit_price: parseFloat(prod.unit_price) || 0, inventory_stock: parseInt(prod.inventory_stock) || 0, low_stock_threshold: parseInt(prod.low_stock_threshold) || 0 }).eq('id', prod.id);
                                if (error) alert('Save failed: ' + error.message); else { addToast('✅ Product saved!'); loadMasterProducts(); }
                              }} style={{ padding: '8px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                              <button onClick={async () => {
                                if (window.confirm(`Remove "${prod.name}"?`)) {
                                  const { error } = await supabase.from('products').update({ is_active: false }).eq('id', prod.id);
                                  if (error) alert('Failed.'); else loadMasterProducts();
                                }
                              }} style={{ padding: '8px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                            </td>
                          </tr>
                        );
                        })}</tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                )}

                {settingsSubTab === 'invoice' && (
                  /* ── INVOICE SETTINGS ── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px' }}>

                    {/* Template Mode Selector */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Choose Invoice Style</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Select how your invoice will look when printed.</p>
                      <div style={{ display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
                        <div
                          onClick={() => setInvoiceSettings({ ...invoiceSettings, template_mode: 'custom' })}
                          style={{ flex: 1, padding: '20px', borderRadius: '8px', border: `2px solid ${invoiceSettings.template_mode === 'custom' ? '#2563eb' : '#e2e8f0'}`, cursor: 'pointer', backgroundColor: invoiceSettings.template_mode === 'custom' ? '#eff6ff' : '#ffffff', transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎨</div>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: invoiceSettings.template_mode === 'custom' ? '#1d4ed8' : '#0f172a' }}>Option B — Create My Own</h4>
                          <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>Fill in your company details. We generate a professional invoice automatically.</p>
                        </div>
                        <div
                          onClick={() => setInvoiceSettings({ ...invoiceSettings, template_mode: 'upload' })}
                          style={{ flex: 1, padding: '20px', borderRadius: '8px', border: `2px solid ${invoiceSettings.template_mode === 'upload' ? '#2563eb' : '#e2e8f0'}`, cursor: 'pointer', backgroundColor: invoiceSettings.template_mode === 'upload' ? '#eff6ff' : '#ffffff', transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: invoiceSettings.template_mode === 'upload' ? '#1d4ed8' : '#0f172a' }}>Option A — Upload Letterhead</h4>
                          <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>Upload your own company letterhead image. Invoice data prints on top of it.</p>
                        </div>
                      </div>
                    </div>

                    {/* Option B — Custom Details */}
                    {invoiceSettings.template_mode === 'custom' && (
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Company Details</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b' }}>These details will appear on every printed invoice.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                          {/* Logo Upload */}
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Company Logo (optional)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              {invoiceSettings.logo_url && invoiceSettings.template_mode === 'custom' && (
                                <img src={invoiceSettings.logo_url} alt="Logo" style={{ height: '50px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px' }} />
                              )}
                              <label style={{ padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1.5px dashed #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#475569' }}>
                                {isUploadingLogo ? '⏳ Uploading...' : '📁 Upload Logo (PNG/JPG/SVG)'}
                                <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} />
                              </label>
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Company Name</label>
                            <input type="text" value={invoiceSettings.company_name || ''} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, company_name: e.target.value })}
                              placeholder="e.g. Sri Murugan Distributors"
                              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Address</label>
                            <textarea value={invoiceSettings.address || ''} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, address: e.target.value })}
                              placeholder="e.g. 45, Main Road, Madurai - 625001, Tamil Nadu"
                              rows={2}
                              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif' }} />
                          </div>

                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Phone Number</label>
                              <input type="tel" value={invoiceSettings.phone || ''} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, phone: e.target.value })}
                                placeholder="9876543210"
                                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>GST Number (optional)</label>
                              <input type="text" value={invoiceSettings.gst_number || ''} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, gst_number: e.target.value })}
                                placeholder="33XXXXX1234X1ZX"
                                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>UPI ID <span style={{ fontWeight: 'normal', color: '#64748b' }}>(for QR payments)</span></label>
                            <input type="text" value={invoiceSettings.upi_id || ''} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, upi_id: e.target.value })}
                              placeholder="e.g. 9876543210@okicici or name@upi"
                              style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${invoiceSettings.upi_id ? '#16a34a' : '#cbd5e1'}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                            {invoiceSettings.upi_id && (
                              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#16a34a' }}>✅ Agents will see a UPI QR code when collecting payments</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Option A — Upload Letterhead */}
                    {invoiceSettings.template_mode === 'upload' && (
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Upload Your Letterhead</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b' }}>Upload your company letterhead as an image (PNG/JPG). Invoice data will be printed over it. Recommended size: A4 (2480 x 3508 px).</p>

                        <label style={{ display: 'block', padding: '30px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                          {isUploadingLetterhead ? (
                            <p style={{ margin: '0', color: '#64748b', fontSize: '14px' }}>⏳ Uploading...</p>
                          ) : letterheadUrl ? (
                            <div>
                              <img src={letterheadUrl} alt="Letterhead Preview" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px', marginBottom: '12px' }} />
                              <p style={{ margin: '0', fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>✅ Letterhead uploaded — click to replace</p>
                            </div>
                          ) : (
                            <div>
                              <p style={{ margin: '0 0 8px 0', fontSize: '32px' }}>📄</p>
                              <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>Click to upload letterhead</p>
                              <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>PNG or JPG — max 50MB</p>
                            </div>
                          )}
                          <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLetterheadUpload} style={{ display: 'none' }} />
                        </label>

                        {letterheadUrl && (
                          <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '6px', fontSize: '13px', color: '#92400e' }}>
                            ⚠️ When printing, your letterhead will appear as a background. Make sure your letterhead has enough white space for the invoice data to be readable.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <button onClick={handleSaveInvoiceSettings} disabled={isSavingSettings}
                        style={{ padding: '14px 32px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: isSavingSettings ? 'not-allowed' : 'pointer', opacity: isSavingSettings ? 0.7 : 1 }}>
                        {isSavingSettings ? 'Saving...' : '💾 Save Invoice Settings'}
                      </button>
                      {settingsSaved && (
                        <span style={{ fontSize: '14px', color: settingsSaved.includes('✅') ? '#16a34a' : '#dc2626', fontWeight: '500' }}>{settingsSaved}</span>
                      )}
                    </div>

                    {/* SMTP / Email */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>📧 Email Settings</h3>
                      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                        To enable emailing invoices, set <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>SMTP_HOST</code>, <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>SMTP_USER</code>, <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>SMTP_PASS</code>, and <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>SMTP_FROM</code> in your <strong>.env.local</strong> file and restart the server. Gmail works out of the box with an App Password.
                      </p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Send a test email to</label>
                          <input
                            type="email"
                            placeholder="you@example.com"
                            value={smtpTestEmail}
                            onChange={e => { setSmtpTestEmail(e.target.value); setSmtpTestResult(''); }}
                            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <button
                          disabled={isSendingTestEmail || !smtpTestEmail.trim()}
                          onClick={async () => {
                            setIsSendingTestEmail(true);
                            setSmtpTestResult('');
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const res = await fetch('/api/email/test', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
                                body: JSON.stringify({ testEmail: smtpTestEmail.trim() }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error);
                              setSmtpTestResult('✅ Test email sent! Check your inbox.');
                            } catch (err) {
                              setSmtpTestResult('❌ ' + err.message);
                            } finally {
                              setIsSendingTestEmail(false);
                            }
                          }}
                          style={{ padding: '10px 22px', backgroundColor: isSendingTestEmail ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: isSendingTestEmail ? 'not-allowed' : 'pointer', height: '42px', whiteSpace: 'nowrap' }}
                        >
                          {isSendingTestEmail ? 'Sending...' : '📤 Send Test'}
                        </button>
                      </div>
                      {smtpTestResult && (
                        <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: '500', color: smtpTestResult.includes('✅') ? '#16a34a' : '#dc2626' }}>
                          {smtpTestResult}
                        </p>
                      )}
                    </div>

                    {/* Live Preview */}
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#475569' }}>🔍 Invoice Preview</h3>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '30px', backgroundColor: '#fafafa', fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>
                        {invoiceSettings.template_mode === 'upload' && letterheadUrl ? (
                          <div style={{ position: 'relative' }}>
                            <img src={letterheadUrl} alt="Letterhead" style={{ width: '100%', opacity: 0.3, borderRadius: '4px' }} />
                            <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div><strong style={{ fontSize: '14px' }}>DELIVERY INVOICE</strong></div>
                                <div style={{ textAlign: 'right', fontSize: '11px' }}><div>Bill No: ET-2026-482931-847</div><div>Date: {new Date().toLocaleDateString('en-IN')}</div></div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#333' }}>Bill To: [Shop Name] | Agent: [Agent Name]</div>
                              <div style={{ marginTop: '10px', fontSize: '10px', color: '#555' }}>Products and amounts will appear here...</div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                              <div>
                                {invoiceSettings.logo_url && <img src={invoiceSettings.logo_url} alt="Logo" style={{ height: '36px', objectFit: 'contain', marginBottom: '6px', display: 'block' }} />}
                                <strong style={{ fontSize: '14px' }}>{invoiceSettings.company_name || 'Your Company Name'}</strong>
                                <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{invoiceSettings.address || 'Your Address'}</div>
                                {invoiceSettings.phone && <div style={{ color: '#555', fontSize: '11px' }}>📞 {invoiceSettings.phone}</div>}
                                {invoiceSettings.gst_number && <div style={{ color: '#555', fontSize: '11px' }}>GST: {invoiceSettings.gst_number}</div>}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '6px', display: 'inline-block' }}>DELIVERY INVOICE</div>
                                <div style={{ fontSize: '11px' }}>Bill No: ET-2026-482931-847</div>
                                <div style={{ fontSize: '11px', color: '#555' }}>Date: {new Date().toLocaleDateString('en-IN')}</div>
                              </div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                              <thead><tr style={{ backgroundColor: '#0f172a', color: '#fff' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Product</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                              </tr></thead>
                              <tbody>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '6px 8px' }}>Sample Product A</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹100.00</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>10 boxes</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹1,000.00</td>
                                </tr>
                              </tbody>
                            </table>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                              <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Grand Total: ₹1,000.00</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>

            ) : null}
          </div>


          {/* ── AGENT PROFILE MODAL ── */}
          {selectedAgentProfile && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '30px', width: '500px', maxHeight: '80vh', overflowY: 'auto', margin: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{selectedAgentProfile.full_name}</h2>
                    <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>{selectedAgentProfile.email}</p>
                  </div>
                  <button onClick={() => { setSelectedAgentProfile(null); setAgentProfileData(null); }}
                    style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                </div>

                {isLoadingProfile ? (
                  <p style={{ textAlign: 'center', color: '#64748b' }}>Loading profile...</p>
                ) : agentProfileData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* This Month Summary */}
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>WORKING DAYS</p>
                          <strong style={{ fontSize: '24px', color: '#16a34a' }}>{agentProfileData.workingDays}</strong>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>LEAVES TAKEN</p>
                          <strong style={{ fontSize: '24px', color: '#f59e0b' }}>{agentProfileData.leavesThisMonth}</strong>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>BILLS</p>
                          <strong style={{ fontSize: '24px', color: '#2563eb' }}>{agentProfileData.billsThisMonth}</strong>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>COLLECTION %</p>
                          <strong style={{ fontSize: '24px', color: agentProfileData.collectionRate >= 80 ? '#16a34a' : '#f59e0b' }}>{agentProfileData.collectionRate}%</strong>
                        </div>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '13px', color: '#475569' }}>Total Sales</span>
                        <strong style={{ color: '#2563eb' }}>₹{agentProfileData.totalSales.toLocaleString('en-IN')}</strong>
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '13px', color: '#475569' }}>Total Collected</span>
                        <strong style={{ color: '#16a34a' }}>₹{agentProfileData.totalCollected.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    {/* Monthly Targets */}
                    {(() => {
                      const currentMonth = new Date().toISOString().slice(0, 7);
                      const tgt = agentTargets.find(t => t.agent_name === selectedAgentProfile?.full_name);
                      const salesPct = tgt?.sales_target > 0 ? Math.min(100, Math.round(agentProfileData.totalSales / tgt.sales_target * 100)) : 0;
                      const collPct = tgt?.collection_target > 0 ? Math.min(100, Math.round(agentProfileData.totalCollected / tgt.collection_target * 100)) : 0;
                      return (
                        <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Targets</h3>
                            <button onClick={() => setTargetModal({ agentName: selectedAgentProfile.full_name, month: currentMonth, salesTarget: tgt?.sales_target ?? '', collectionTarget: tgt?.collection_target ?? '' })}
                              style={{ padding: '4px 10px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                              🎯 {tgt ? 'Edit' : 'Set'} Target
                            </button>
                          </div>
                          {tgt ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {tgt.sales_target > 0 && (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                                    <span style={{ color: '#475569' }}>Sales</span>
                                    <span><strong style={{ color: salesPct >= 100 ? '#16a34a' : '#0f172a' }}>₹{agentProfileData.totalSales.toLocaleString('en-IN')}</strong><span style={{ color: '#94a3b8' }}> / ₹{Number(tgt.sales_target).toLocaleString('en-IN')}</span></span>
                                  </div>
                                  <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
                                    <div style={{ height: '100%', width: `${salesPct}%`, backgroundColor: salesPct >= 100 ? '#16a34a' : salesPct >= 75 ? '#f59e0b' : '#2563eb', borderRadius: '4px' }} />
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>{salesPct}% achieved</span>
                                </div>
                              )}
                              {tgt.collection_target > 0 && (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                                    <span style={{ color: '#475569' }}>Collection</span>
                                    <span><strong style={{ color: collPct >= 100 ? '#16a34a' : '#0f172a' }}>₹{agentProfileData.totalCollected.toLocaleString('en-IN')}</strong><span style={{ color: '#94a3b8' }}> / ₹{Number(tgt.collection_target).toLocaleString('en-IN')}</span></span>
                                  </div>
                                  <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
                                    <div style={{ height: '100%', width: `${collPct}%`, backgroundColor: collPct >= 100 ? '#16a34a' : collPct >= 75 ? '#f59e0b' : '#2563eb', borderRadius: '4px' }} />
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>{collPct}% collected</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>No target set for this month. Click "Set Target" to add one.</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Leave History */}
                    <div>
                      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave History</h3>
                      {agentProfileData.allLeaves.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '13px' }}>No leaves taken.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                          {agentProfileData.allLeaves.map((leave, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                              <span style={{ fontWeight: '500' }}>{new Date(leave.leave_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              <span style={{ color: '#64748b' }}>{leave.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Invoice Modal */}
          {emailModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '30px', width: '100%', maxWidth: '440px', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h2 style={{ margin: '0', fontSize: '18px' }}>📧 Email Invoice</h2>
                  <button onClick={() => setEmailModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
                  Sending <strong>{emailModal.billNumber}</strong> for <strong>{emailModal.shopName}</strong>
                </p>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Recipient Email</label>
                <input
                  type="email"
                  autoFocus
                  placeholder="shop@example.com"
                  value={emailRecipient}
                  onChange={e => setEmailRecipient(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendInvoiceEmail()}
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '20px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setEmailModal(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSendInvoiceEmail} disabled={isSendingEmail || !emailRecipient.trim()}
                    style={{ flex: 2, padding: '12px', backgroundColor: isSendingEmail ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: isSendingEmail ? 'not-allowed' : 'pointer' }}>
                    {isSendingEmail ? 'Sending...' : '📧 Send Invoice'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Restock Modal */}
          {restockModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>Restock Product</h3>
                    <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>{restockModal.name}</p>
                  </div>
                  <button onClick={() => setRestockModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Current stock</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>{restockModal.currentStock} units</span>
                </div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Units to add</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRestock()}
                  autoFocus
                  style={{ width: '100%', padding: '12px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                {restockQty && parseInt(restockQty) > 0 && (
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>
                    New stock will be: {restockModal.currentStock + parseInt(restockQty)} units
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setRestockModal(null)}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleRestock} disabled={!restockQty || parseInt(restockQty) <= 0}
                    style={{ flex: 2, padding: '12px', backgroundColor: !restockQty || parseInt(restockQty) <= 0 ? '#94a3b8' : '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: !restockQty || parseInt(restockQty) <= 0 ? 'not-allowed' : 'pointer' }}>
                    ✓ Add Stock
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Target Modal */}
          {targetModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 2px', fontSize: '18px' }}>🎯 Set Monthly Target</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{targetModal.agentName}</p>
                  </div>
                  <button onClick={() => setTargetModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Month</label>
                    <input type="month" value={targetModal.month}
                      onChange={(e) => setTargetModal(prev => ({ ...prev, month: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Sales Target (₹)</label>
                    <input type="number" min="0" placeholder="e.g. 100000"
                      value={targetModal.salesTarget}
                      onChange={(e) => setTargetModal(prev => ({ ...prev, salesTarget: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Collection Target (₹)</label>
                    <input type="number" min="0" placeholder="e.g. 80000"
                      value={targetModal.collectionTarget}
                      onChange={(e) => setTargetModal(prev => ({ ...prev, collectionTarget: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button onClick={() => setTargetModal(null)}
                      style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={handleSaveTarget}
                      style={{ flex: 2, padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ✓ Save Target
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bill Payment History Drawer */}
          {selectedBillLedger && activeTab === 'history' && (
            <div style={isMobile ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 199, backgroundColor: '#ffffff', borderRadius: '16px 16px 0 0', padding: '24px 20px calc(80px + env(safe-area-inset-bottom))', maxHeight: '72vh', overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' } : { width: '420px', backgroundColor: '#ffffff', borderRadius: '8px', border: '2px solid #2563eb', padding: '25px', boxSizing: 'border-box' }} className="no-print">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <h3 style={{ margin: '0', fontSize: '16px', color: '#1e3a8a' }}>💳 {selectedBillLedger.bill_number}</h3>
                <button onClick={() => setSelectedBillLedger(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px' }}>{selectedBillLedger.shops?.name}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? undefined : '450px', overflowY: isMobile ? undefined : 'auto', marginBottom: '16px' }}>
                {billPaymentHistory.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                    {parseFloat(selectedBillLedger.amount_received || 0) > 0
                      ? 'No itemized payments (this bill was paid before payment tracking was added).'
                      : 'No payments logged yet for this bill.'}
                  </p>
                ) : billPaymentHistory.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderLeft: '4px solid #16a34a', backgroundColor: '#f0fdf4', borderRadius: '0 6px 6px 0', fontSize: '13px' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#15803d' }}>₹{parseFloat(p.amount).toLocaleString('en-IN')}</span>
                      <span style={{ marginLeft: '8px', color: '#64748b' }}>{p.payment_mode}</span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{new Date(p.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bill Value:</span><strong>₹{parseFloat(selectedBillLedger.bill_amount || 0).toLocaleString('en-IN')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Paid:</span><strong style={{ color: '#16a34a' }}>₹{parseFloat(selectedBillLedger.amount_received || 0).toLocaleString('en-IN')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pending:</span><strong style={{ color: parseFloat(selectedBillLedger.pending_amount || 0) > 0 ? '#dc2626' : '#16a34a' }}>₹{parseFloat(selectedBillLedger.pending_amount || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Order Review Drawer */}
          {selectedOrder && activeTab === 'pending' && (
            <div style={isMobile ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 199, backgroundColor: '#ffffff', borderRadius: '16px 16px 0 0', padding: '24px 20px calc(80px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' } : { width: '400px', backgroundColor: '#ffffff', borderRadius: '8px', border: '2px solid #2563eb', padding: '25px', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: '0', fontSize: '18px', color: '#1e3a8a' }}>Order Review</h3>
                <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ marginBottom: '20px', fontSize: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                <p style={{ margin: '0 0 5px' }}><strong>Bill:</strong> {selectedOrder.bill_number}</p>
                <p style={{ margin: '0' }}><strong>Shop:</strong> {selectedOrder.shops?.name}</p>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#475569' }}>Assign Agent</label>
                <select value={selectedAgentForOrder} onChange={(e) => setSelectedAgentForOrder(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                  <option value="">-- Select Agent --</option>
                  {activeAgents.map(agent => <option key={agent.id} value={agent.name}>{agent.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '14px', margin: '0', color: '#475569' }}>Products</h4>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Live stock</span>
              </div>
              {orderItems.map((item, idx) => {
                const stock = item.products?.inventory_stock || 0;
                const isOutOfStock = stock === 0;
                const isShortage = item.quantity > stock && stock > 0;
                return (
                  <div key={item.id || idx} style={{ padding: '10px', backgroundColor: isOutOfStock ? '#fff5f5' : isShortage ? '#fffbeb' : '#f8fafc', borderRadius: '6px', marginBottom: '10px', border: isOutOfStock ? '1px solid #fecaca' : isShortage ? '1px solid #fbbf24' : '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flexGrow: 1 }}>
                        <span style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: isOutOfStock ? '#991b1b' : '#0f172a' }}>{item.products?.name}</span>
                        <span style={{ fontSize: '12px', color: isOutOfStock ? '#dc2626' : isShortage ? '#d97706' : '#64748b' }}>
                          {isOutOfStock ? '⛔ Out of stock' : isShortage ? `⚠️ Only ${stock} in stock` : `✅ Stock: ${stock}`}
                        </span>
                      </div>
                      <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityEdit(idx, e.target.value)}
                        style={{ width: '65px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontWeight: 'bold', color: '#475569' }}>Total:</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>₹{orderItems.reduce((acc, curr) => acc + ((curr.unit_price_used ?? curr.products?.unit_price ?? 0) * curr.quantity), 0).toLocaleString('en-IN')}</span>
              </div>
              {orderItems.some(item => (item.products?.inventory_stock || 0) === 0) && (
                <div style={{ padding: '10px', backgroundColor: '#fff5f5', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: '#991b1b' }}>
                  ⛔ Some items are out of stock. Please adjust quantities before approving.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={handleUpdateDraft} disabled={isUpdating} style={{ width: '100%', padding: '10px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Save Changes</button>
                <button onClick={handleApproveAndRelease} disabled={isUpdating} style={{ width: '100%', padding: '14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 Approve & Release</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── TOAST NOTIFICATIONS ── */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', ...(isMobile ? { bottom: 'calc(74px + env(safe-area-inset-bottom))', left: '16px', right: '16px' } : { bottom: '24px', right: '24px', maxWidth: '360px' }) }}>
          {toasts.map(t => (
            <div key={t.id} style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '14px 18px', borderRadius: '8px', fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', maxWidth: '340px', display: 'flex', alignItems: 'flex-start', gap: '12px', borderLeft: '4px solid #f59e0b' }}>
              <span style={{ flex: 1, lineHeight: '1.4' }}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', padding: '0', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── PRINT INVOICE ── */}
      {selectedPrintInvoice && (
        <div className="print-only-container" style={{ fontFamily: "'Arial', sans-serif", padding: '40px', color: '#000000', backgroundColor: '#ffffff', position: 'relative' }}>

          {/* Letterhead background if upload mode */}
          {invoiceSettings.template_mode === 'upload' && invoiceSettings.logo_url && (
            <img src={invoiceSettings.logo_url} alt="Letterhead"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15, zIndex: 0 }} />
          )}

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', paddingBottom: '20px', borderBottom: '3px solid #0f172a' }}>
              <div>
                {invoiceSettings.template_mode === 'custom' && invoiceSettings.logo_url && (
                  <img src={invoiceSettings.logo_url} alt="Logo" style={{ height: '50px', objectFit: 'contain', marginBottom: '8px', display: 'block' }} />
                )}
                <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                  {invoiceSettings.company_name || 'EASYTRACK DISTRIBUTORS'}
                </h1>
                <p style={{ margin: '0', fontSize: '12px', color: '#475569' }}>{invoiceSettings.address || 'Madurai, Tamil Nadu, India'}</p>
                {invoiceSettings.phone && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>📞 {invoiceSettings.phone}</p>}
                {invoiceSettings.gst_number && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>GST: {invoiceSettings.gst_number}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', marginBottom: '8px', display: 'inline-block' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>DELIVERY INVOICE</span>
                </div>
                <p style={{ margin: '0', fontSize: '13px' }}><strong>Bill No:</strong> {selectedPrintInvoice.bill_number}</p>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#475569' }}>
                  <strong>Date:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Bill To */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', gap: '40px' }}>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #0f172a' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill To</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{selectedPrintInvoice.shops?.name || 'Retail Store'}</p>
                {selectedPrintInvoice.shops?.phone_number && <p style={{ margin: '0', fontSize: '13px', color: '#475569' }}>📞 {selectedPrintInvoice.shops.phone_number}</p>}
              </div>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Delivery Info</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}><strong>Agent:</strong> {selectedPrintInvoice.employee_name || 'Field Agent'}</p>
                <p style={{ margin: '0', fontSize: '13px' }}><strong>Status:</strong> Delivered</p>
              </div>
            </div>

            {/* Products Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'left' }}>S.No</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left' }}>Product Name</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Unit Rate (₹)</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Quantity</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedPrintInvoice.items?.map((line, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 10px', fontWeight: '600' }}>{line.products?.name}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}>{(line.quantity > 0 ? line.total_price / line.quantity : (line.products?.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold' }}>{line.quantity} boxes</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(line.total_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>Subtotal</span>
                  <span>₹{parseFloat(selectedPrintInvoice.bill_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <span style={{ color: '#475569' }}>GST / Tax</span>
                  <span style={{ color: '#64748b' }}>₹0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 10px', backgroundColor: '#0f172a', color: '#fff', fontSize: '16px', fontWeight: 'bold', borderRadius: '0 0 6px 6px' }}>
                  <span>Grand Total</span>
                  <span>₹{parseFloat(selectedPrintInvoice.bill_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <p style={{ margin: '0', fontSize: '11px', color: '#94a3b8' }}>* Computer generated invoice. No signature required.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>Thank you for your business!</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '8px', width: '160px' }}>
                  <p style={{ margin: '0', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>Authorized Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', zIndex: 45, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {[
            { tab: 'pending',  icon: '🏠', label: 'Today'    },
            { tab: 'history',  icon: '🚚', label: 'Dispatch' },
            { tab: 'finance',  icon: '📊', label: 'Finance'  },
            { tab: 'shops',    icon: '🏪', label: 'Shops'    },
            { tab: 'settings', icon: '⚙️', label: 'Settings' },
          ].filter(({ tab }) => can(TAB_PERMISSION[tab] || tab)).map(({ tab, icon, label }) => {
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => handleNavClick(tab)} style={{ flex: 1, minHeight: '48px', boxSizing: 'border-box', padding: '6px 2px', border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', cursor: 'pointer', color: isActive ? '#38bdf8' : '#64748b', borderTop: `2px solid ${isActive ? '#38bdf8' : 'transparent'}`, transition: 'color 0.15s' }}>
                <span style={{ fontSize: isActive ? '19px' : '17px', lineHeight: 1, padding: '2px 10px', borderRadius: '10px', backgroundColor: isActive ? 'rgba(56,189,248,0.15)' : 'transparent', transition: 'all 0.15s' }}>{icon}</span>
                <span style={{ fontSize: '10px', fontWeight: isActive ? '700' : '600', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Floating Network & Sync Indicator */}
      <OfflineSyncWidget supabase={supabase} />

      <style jsx global>{`
        @media print {
          body > div > div > aside,
          body > div > div > main,
          .no-print {
            display: none !important;
          }
          .print-only-container {
            display: block !important;
            width: 100% !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #ffffff !important;
            z-index: 9999 !important;
          }
          @page { margin: 1.6cm; size: A4; }
        }
      `}</style>
    </div>
  );
}

export default withAuth(OwnerDashboard, ['owner', 'dispatcher']);