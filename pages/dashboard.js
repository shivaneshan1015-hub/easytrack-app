import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth, withAuth } from '../hooks/useAuth';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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
  const [activeTab, setActiveTab] = useState('pending');

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
  const [leaveNotifications, setLeaveNotifications] = useState([]);
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
  const [isAddingShop, setIsAddingShop] = useState(false);

  const [selectedShopLedger, setSelectedShopLedger] = useState(null);
  const [shopLedgerHistory, setShopLedgerHistory] = useState([]);

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
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');

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
    logo_url: '',
    template_mode: 'custom'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [toasts, setToasts] = useState([]);

  const addToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  async function loadPendingOrders() {
    setIsLoading(true);
    const { data } = await supabase.from('transactions')
      .select(`id, bill_number, employee_name, bill_amount, created_at, shops ( id, name, phone_number )`)
      .eq('status', 'draft').order('created_at', { ascending: false });
    if (data) setPendingOrders(data);
    setIsLoading(false);
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
    const { data } = await supabase.from('shops').select('id, name, phone_number, latitude, longitude').order('name', { ascending: true });
    if (data) setRegisteredShops(data);
    setIsLoading(false);
  }

  async function loadMasterProducts() {
    setIsLoading(true);
    const { data } = await supabase.from('products').select('id, name, unit_price, inventory_stock, is_active, low_stock_threshold').order('name', { ascending: true });
    if (data) setProductsCatalog(data);
    setIsLoading(false);
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
      supabase.removeChannel(returnsChannel);
    };
  }, []);

  async function loadActiveAgentsList() {
    const { data } = await supabase.from('employees').select('id, name').order('name', { ascending: true });
    if (data) setActiveAgents(data);
  }


  async function loadAgentsList() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .eq("role", "agent")
      .order("full_name", { ascending: true });
    if (!data) return;
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

  async function handleDeleteAgent(agent) {
    if (!window.confirm(`Remove agent "${agent.full_name}"? They will lose login access but all their past bills will be preserved.`)) return;
    setIsDeletingAgent(agent.id);
    try {
      const res = await fetch("/api/delete-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: agent.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Agent "${agent.full_name}" removed successfully. Their bills are preserved.`);
      loadAgentsList();
    } catch (err) {
      alert("Failed to remove agent: " + err.message);
    } finally {
      setIsDeletingAgent(null);
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

  async function loadShops() {
    setIsLoading(true);
    const [{ data: shopsData }, { data: txData }] = await Promise.all([
      supabase.from('shops').select('*').order('name', { ascending: true }),
      supabase.from('transactions').select('shop_id, pending_amount').neq('status', 'delivered'),
    ]);
    if (shopsData) {
      const withCredit = shopsData.map(shop => {
        const used = (txData || [])
          .filter(tx => tx.shop_id === shop.id)
          .reduce((sum, tx) => sum + parseFloat(tx.pending_amount || 0), 0);
        return { ...shop, credit_used: used };
      });
      setShopsList(withCredit);
    }
    setIsLoading(false);
  }

  async function loadInvoiceSettings() {
    setIsLoading(true);
    const { data } = await supabase.from('invoice_settings')
      .select('*').eq('owner_id', profile?.id ?? '').single();
    if (data) {
      setInvoiceSettings(data);
      if (data.template_mode === 'upload' && data.logo_url) setLetterheadUrl(data.logo_url);
    }
    setIsLoading(false);
  }

  async function loadShopStatement(shopId, shopName) {
    setIsLoading(true);
    setSelectedShopLedger(shopName);
    const { data } = await supabase.from('transactions')
      .select('bill_number, bill_amount, amount_received, pending_amount, status, payment_mode, created_at, delivered_at')
      .eq('shop_id', shopId).order('created_at', { ascending: true });
    if (data) setShopLedgerHistory(data);
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
    setSelectedOrder(null);
    setSelectedShopLedger(null);
    setSelectedAgentForOrder('');
    if (activeTab === 'pending') { loadPendingOrders(); loadActiveAgentsList(); }
    else if (activeTab === 'history') loadHistoryLedger();
    else if (activeTab === 'finance') { calculateFinancialMetrics(dateRange); loadReturns(); }
    else if (activeTab === 'map') { loadRouteMapLocations(); loadActiveAgentsList(); }
    else if (activeTab === 'shops') loadShops();
    else if (activeTab === 'admin') { loadMasterProducts(); loadActiveAgentsList(); loadAgentsList(); loadLeaveNotifications(); }
    else if (activeTab === 'invoice') loadInvoiceSettings();
  }, [activeTab]);

  const handleSaveInvoiceSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSaved('');
    try {
      const payload = { ...invoiceSettings, owner_id: profile?.id, updated_at: new Date().toISOString() };
      const { data: existing } = await supabase.from('invoice_settings').select('id').eq('owner_id', profile?.id).single();
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
      const res = await fetch('/api/invite-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAgentEmail.trim(), full_name: newAgentName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteMessage(`✅ Invitation sent to ${newAgentEmail}`);
      setNewAgentName(''); setNewAgentEmail('');
    } catch (err) { setInviteMessage(`❌ Error: ${err.message}`); }
    finally { setIsAddingAgent(false); }
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
          products: {
            ...item.products,
            inventory_stock: liveProduct ? liveProduct.inventory_stock : 0
          }
        };
      }));
      setOrderItems(itemsWithLiveStock);
    }
  };

  const handleAddProductToOrder = (productId) => {
    if (!productId) return;
    const prod = allActiveProducts.find(p => p.id === productId);
    if (!prod) return;
    // Check if already in order
    const existing = orderItems.find(item => item.products?.id === productId);
    if (existing) return alert(`${prod.name} is already in this order. Update the quantity instead.`);
    // Add as new item (no id means it will be inserted)
    setOrderItems([...orderItems, {
      id: null,
      isNew: true,
      product_id: productId,
      quantity: 1,
      total_price: prod.unit_price,
      products: { id: productId, name: prod.name, unit_price: prod.unit_price, inventory_stock: prod.inventory_stock }
    }]);
  };

  const handleQuantityEdit = (index, newQty) => {
    const updated = [...orderItems];
    updated[index].quantity = parseInt(newQty) || 0;
    updated[index].total_price = (updated[index].products?.unit_price || 0) * updated[index].quantity;
    setOrderItems(updated);
  };

  const handleUpdateDraft = async () => {
    if (orderItems.some(item => item.quantity <= 0)) return alert('Quantity must be > 0.');
    setIsUpdating(true);
    try {
      let total = 0;
      for (const item of orderItems) {
        const lineTotal = (item.products?.unit_price || 0) * item.quantity;
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
      alert('✅ Order updated!'); loadPendingOrders();
      // Refresh order items
      const { data } = await supabase.from('transaction_items')
        .select(`id, quantity, total_price, products ( id, name, unit_price, inventory_stock )`)
        .eq('transaction_id', selectedOrder.id);
      if (data) setOrderItems(data);
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
      alert(`Released to "${selectedAgentForOrder}"!`);
      setSelectedOrder(null); setSelectedAgentForOrder(''); loadPendingOrders();
    } catch (err) { alert('Error.'); } finally { setIsUpdating(false); }
  };

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
      alert('Delivery settled!'); loadHistoryLedger();
    } catch (err) { alert('Failed.'); } finally { setIsUpdating(false); }
  };

  async function loadLeaveNotifications() {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .gte('leave_date', today)
      .lte('leave_date', nextWeek.toISOString().split('T')[0])
      .order('leave_date', { ascending: true });
    if (data) setLeaveNotifications(data);
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

    // Get all shops that have approved transactions for this agent
    const { data: agentTx } = await supabase
      .from('transactions')
      .select('shop_id')
      .eq('employee_name', routeAgent)
      .eq('status', 'approved');

    const shopIds = [...new Set((agentTx || []).map(t => t.shop_id))];

    // Get shop details with GPS
    let shops = [];
    if (shopIds.length > 0) {
      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name, phone_number, latitude, longitude')
        .in('id', shopIds)
        .not('latitude', 'is', null);
      shops = shopData || [];
    }

    if (shops.length === 0) {
      setIsGeneratingRoute(false);
      alert(`No shops with GPS coordinates found for ${routeAgent}. Showing all shops instead.`);
      const { data: allShops } = await supabase.from('shops').select('id, name, phone_number, latitude, longitude').not('latitude', 'is', null);
      shops = allShops || [];
    }

    // Nearest neighbor algorithm
    let remaining = [...shops];
    let route = [];
    let currentLat = startLat;
    let currentLng = startLng;
    let totalDist = 0;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      remaining.forEach((shop, i) => {
        const d = calcDistance(currentLat, currentLng, parseFloat(shop.latitude), parseFloat(shop.longitude));
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

  const tabStyle = (tab) => ({
    padding: '12px 16px', backgroundColor: activeTab === tab ? '#1e293b' : 'transparent',
    borderRadius: '6px', color: activeTab === tab ? '#38bdf8' : '#94a3b8',
    fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
  });

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', color: '#0f172a', fontFamily: 'sans-serif' }}>

      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#0f172a', padding: '25px', color: '#ffffff', display: 'flex', flexDirection: 'column' }} className="no-print">
        <h2 style={{ margin: '0 0 5px', fontSize: '22px', fontWeight: 'bold' }}>EasyTrack</h2>
        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '20px' }}>HQ Control Room</span>
        {leaveNotifications.length > 0 && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '12px', marginBottom: '20px', border: '1px solid #7c3aed' }} onClick={() => setActiveTab('admin')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ backgroundColor: '#7c3aed', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>{leaveNotifications.length}</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#c4b5fd' }}>Leave Requests</span>
            </div>
            {leaveNotifications.slice(0, 3).map((leave, i) => (
              <div key={i} style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                🏖️ {leave.agent_name} — {new Date(leave.leave_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </div>
            ))}
          </div>
        )}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          <div onClick={() => setActiveTab('pending')} style={tabStyle('pending')}>⏳ Pending Orders</div>
          <div onClick={() => setActiveTab('history')} style={tabStyle('history')}>📜 Dispatched Ledger</div>
          <div onClick={() => setActiveTab('finance')} style={tabStyle('finance')}>📈 Financial Insights</div>
          <div onClick={() => setActiveTab('map')} style={tabStyle('map')}>🗺️ Route Map</div>
          <div onClick={() => setActiveTab('shops')} style={tabStyle('shops')}>🏪 Shop Management</div>
          <div onClick={() => setActiveTab('invoice')} style={tabStyle('invoice')}>🧾 Invoice Settings</div>
          <div onClick={() => setActiveTab('admin')} style={tabStyle('admin')}>👥 Management Panel</div>
        </nav>
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px', marginTop: '20px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>{profile?.full_name || 'Owner'}</p>
          <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#64748b' }}>{profile?.email}</p>
          <button onClick={signOut} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flexGrow: 1, padding: '40px', boxSizing: 'border-box' }} className="no-print">
        <header style={{ marginBottom: '35px' }}>
          <h1 style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>
            {activeTab === 'pending' && 'Pending Orders'}
            {activeTab === 'history' && 'Dispatched Ledger'}
            {activeTab === 'finance' && 'Financial Insights'}
            {activeTab === 'map' && 'Route Map'}
            {activeTab === 'shops' && 'Shop Management'}
            {activeTab === 'invoice' && 'Invoice Settings'}
            {activeTab === 'admin' && 'Management Panel'}
          </h1>
        </header>

        {(() => {
          const lowStock = productsCatalog.filter(p =>
            p.is_active !== false &&
            (p.low_stock_threshold || 10) > 0 &&
            p.inventory_stock <= (p.low_stock_threshold || 10)
          );
          if (lowStock.length === 0) return null;
          const names = lowStock.map(p => `${p.name} (${p.inventory_stock} units)`).join(', ');
          return (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 18px', marginBottom: '24px', fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
              ⚠️ {lowStock.length} product{lowStock.length > 1 ? 's' : ''} low: {names}
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
          <div style={{ flexGrow: 1 }}>
            {isLoading ? (
              <p style={{ padding: '20px', color: '#64748b' }}>Loading...</p>

            ) : activeTab === 'pending' ? (
              pendingOrders.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0', color: '#64748b' }}>No pending orders.</p>
                </div>
              ) : (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                        <td style={{ padding: '16px', fontWeight: '500' }}>{order.shops?.name}</td>
                        <td style={{ padding: '16px', color: '#475569' }}>{order.employee_name}</td>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#16a34a' }}>₹{order.bill_amount}</td>
                        <td style={{ padding: '16px' }}>
                          <button onClick={() => handleReviewClick(order)} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Review & Edit</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )

            ) : activeTab === 'history' ? (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                  <tbody>{historyOrders.map((order) => {
                    let badgeLabel = '🚚 En Route', bgStyle = '#fef9c3', textStyle = '#854d0e';
                    if (order.status === 'delivered') {
                      if (parseFloat(order.pending_amount) <= 0) { badgeLabel = '✓ Settled'; bgStyle = '#dcfce7'; textStyle = '#15803d'; }
                      else { badgeLabel = '⚠️ Credit'; bgStyle = '#fee2e2'; textStyle = '#991b1b'; }
                    }
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold' }}>{order.bill_number}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ display: 'block', fontWeight: '500' }}>{order.shops?.name}</span>
                          <button onClick={() => loadShopStatement(order.shops?.id, order.shops?.name)} style={{ background: 'none', border: 'none', color: '#2563eb', padding: '0', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>📊 Statement</button>
                        </td>
                        <td style={{ padding: '16px', fontWeight: '600' }}>₹{order.bill_amount}</td>
                        <td style={{ padding: '16px', color: '#16a34a', fontWeight: '600' }}>₹{order.amount_received}</td>
                        <td style={{ padding: '16px' }}><span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>💳 {order.payment_mode || 'Cash'}</span></td>
                        <td style={{ padding: '16px', color: order.pending_amount > 0 ? '#dc2626' : '#475569', fontWeight: '600' }}>₹{order.pending_amount}</td>
                        <td style={{ padding: '16px' }}><span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold', backgroundColor: bgStyle, color: textStyle }}>{badgeLabel}</span></td>
                        <td style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button onClick={() => fetchAndPrintInvoice(order)} style={{ padding: '6px 12px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📥 Print Bill</button>
                          {order.status === 'approved' && (
                            <button onClick={() => {
                              const amt = prompt(`Collect for ${order.bill_number} (₹${order.bill_amount}):`);
                              if (amt === null) return;
                              const mode = prompt(`Payment Mode:`, 'Cash');
                              if (!mode) return;
                              handleFinalizeDelivery(order.id, parseFloat(order.bill_amount), parseFloat(amt), mode);
                            }} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🚚 Log Delivery</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>

            ) : activeTab === 'finance' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* ── DATE FILTER ── */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
                    <select value={selectedShopFilter} onChange={e => setSelectedShopFilter(e.target.value)}
                      style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', backgroundColor: '#ffffff', minWidth: '200px' }}>
                      <option value="all">All Shops</option>
                      {financials.shopPendingBills && [...new Set(financials.shopPendingBills.map(b => b.shopName))].map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  {financials.shopPendingBills && financials.shopPendingBills.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                  <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 'bold' }}>👥 Agent Detailed Report</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Agent</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Bills</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Total Sales</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Collected</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Avg Bill</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Collection %</th>
                    </tr></thead>
                    <tbody>{Object.entries(financials.agentRankings || {}).map(([name, data], i) => (
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
                      </tr>
                    ))}</tbody>
                  </table>
                </div>

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

            ) : activeTab === 'map' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>

                {/* ── AI ROUTE PLANNER ── */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>AI Route Optimizer</h3>
                  </div>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Select an agent and starting point — AI will calculate the optimal delivery route to minimize travel time.</p>

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
                              <div>
                                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{shop.name}</p>
                                <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>📞 {shop.phone_number || 'No contact'}</p>
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

            ) : activeTab === 'shops' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Add New Shop</h3>
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Shop Name</label>
                      <input type="text" placeholder="e.g. Sri Murugan Stores" value={newShopName} onChange={(e) => setNewShopName(e.target.value)}
                        style={{ padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: '250px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Phone</label>
                      <input type="tel" placeholder="9876543210" value={newShopPhone} onChange={(e) => setNewShopPhone(e.target.value)}
                        style={{ padding: '10px 14px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', width: '200px' }} />
                    </div>
                    <button onClick={async () => {
                      if (!newShopName.trim()) return alert('Enter shop name.');
                      setIsAddingShop(true);
                      const { error } = await supabase.from('shops').insert([{ name: newShopName.trim(), phone_number: newShopPhone.trim() }]);
                      setIsAddingShop(false);
                      if (error) alert('Failed: ' + error.message);
                      else { alert(`✅ "${newShopName}" added!`); setNewShopName(''); setNewShopPhone(''); loadShops(); }
                    }} disabled={isAddingShop}
                      style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '41px' }}>
                      {isAddingShop ? 'Adding...' : '➕ Add Shop'}
                    </button>
                  </div>
                </div>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>All Shops ({shopsList.length})</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Name</th>
                      <th style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>Phone</th>
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
                            style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '14px', width: '140px' }} />
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: shop.latitude ? '#16a34a' : '#94a3b8' }}>
                          {shop.latitude ? `${parseFloat(shop.latitude).toFixed(4)}, ${parseFloat(shop.longitude).toFixed(4)}` : 'Not set'}
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
                            const updatePayload = { name: shop.name, phone_number: shop.phone_number, credit_limit: shop.credit_limit ?? 0 };
                            console.log('[shops] saving shop', shop.id, 'payload:', updatePayload);
                            const { error: saveError } = await supabase.from('shops').update(updatePayload).eq('id', shop.id);
                            console.log('[shops] save error:', saveError);
                            if (saveError) {
                              alert('Save failed: ' + saveError.message);
                            } else {
                              // Verify what's actually stored
                              const { data: verify } = await supabase.from('shops').select('credit_limit').eq('id', shop.id).single();
                              console.log('[shops] verified credit_limit in DB after save:', verify?.credit_limit);
                              alert(`✅ Saved! credit_limit in DB: ${verify?.credit_limit}`);
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
                  {shopsList.length === 0 && <p style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No shops yet.</p>}
                </div>
              </div>

            ) : activeTab === 'invoice' ? (
              /* ── INVOICE SETTINGS ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px' }}>

                {/* Template Mode Selector */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Choose Invoice Style</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Select how your invoice will look when printed.</p>
                  <div style={{ display: 'flex', gap: '16px' }}>
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
                            <div style={{ textAlign: 'right', fontSize: '11px' }}><div>Bill No: ET-2026-XXXXX</div><div>Date: {new Date().toLocaleDateString('en-IN')}</div></div>
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
                            <div style={{ fontSize: '11px' }}>Bill No: ET-2026-XXXXX</div>
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

            ) : (
              /* Management Panel */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                {/* Low Stock Banner */}
                {(() => {
                  const lowStock = productsCatalog.filter(p =>
                    p.is_active !== false &&
                    (p.low_stock_threshold || 10) > 0 &&
                    p.inventory_stock <= (p.low_stock_threshold || 10)
                  );
                  if (lowStock.length === 0) return null;
                  const names = lowStock.map(p => `${p.name} (${p.inventory_stock} units)`).join(', ');
                  return (
                    <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 18px', fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
                      ⚠️ Low Stock: {names}
                    </div>
                  );
                })()}

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

                {/* 2. Upcoming Leaves */}
                {leaveNotifications.length > 0 && (
                  <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>🏖️ Upcoming Agent Leaves</h3>
                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>Agents on leave in the next 7 days. Deliveries have been auto-reassigned.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {leaveNotifications.map((leave, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                          <div>
                            <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '14px' }}>{leave.agent_name}</p>
                            <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>{leave.reason}</p>
                          </div>
                          <span style={{ backgroundColor: '#ede9fe', color: '#7c3aed', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                            {new Date(leave.leave_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Field Agents List */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Field Agents</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Manage active field agents. Removing an agent revokes login access but preserves all their past bills.</p>
                  {agentsList.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '14px' }}>No agents found.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                          <td style={{ padding: '14px 16px' }}>
                            <button
                              onClick={() => handleDeleteAgent(agent)}
                              disabled={isDeletingAgent === agent.id}
                              style={{ padding: '8px 14px', backgroundColor: isDeletingAgent === agent.id ? '#e2e8f0' : '#fee2e2', color: isDeletingAgent === agent.id ? '#94a3b8' : '#dc2626', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                            >{isDeletingAgent === agent.id ? 'Removing...' : '🗑 Remove Agent'}</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>

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
                    else { alert(`✅ "${name}" added!`); form.reset(); loadMasterProducts(); }
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

                {/* 4. Product Catalog */}
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
                            if (error) alert('Save failed: ' + error.message); else { alert('✅ Saved!'); loadMasterProducts(); }
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

          {/* Statement Drawer */}
          {selectedShopLedger && activeTab === 'history' && (
            <div style={{ width: '420px', backgroundColor: '#ffffff', borderRadius: '8px', border: '2px solid #2563eb', padding: '25px', boxSizing: 'border-box' }} className="no-print">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0', fontSize: '16px', color: '#1e3a8a' }}>📜 {selectedShopLedger}</h3>
                <button onClick={() => setSelectedShopLedger(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
                {shopLedgerHistory.length === 0 ? <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>No records.</p> :
                  shopLedgerHistory.map((ledger, idx) => (
                    <div key={idx} style={{ padding: '12px', borderLeft: '4px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '0 6px 6px 0', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 'bold' }}>
                        <span>{ledger.bill_number}</span>
                        <span style={{ color: '#64748b' }}>{new Date(ledger.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#475569' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Value:</span><strong>₹{ledger.bill_amount}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid:</span><strong style={{ color: '#16a34a' }}>₹{ledger.amount_received}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '3px' }}>
                          <span>Balance:</span><strong style={{ color: ledger.pending_amount > 0 ? '#dc2626' : '#16a34a' }}>₹{ledger.pending_amount}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <button onClick={() => window.print()} style={{ width: '100%', marginTop: '16px', padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ Print Statement</button>
            </div>
          )}

          {/* Order Review Drawer */}
          {selectedOrder && activeTab === 'pending' && (
            <div style={{ width: '400px', backgroundColor: '#ffffff', borderRadius: '8px', border: '2px solid #2563eb', padding: '25px', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }}>
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
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>₹{orderItems.reduce((acc, curr) => acc + ((curr.products?.unit_price || 0) * curr.quantity), 0).toLocaleString('en-IN')}</span>
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
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}>{(line.products?.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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

export default withAuth(OwnerDashboard, ['owner']);