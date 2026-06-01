import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Dynamically load our new map component, explicitly disabling Server-Side-Rendering (SSR)
const InteractiveRouteMap = dynamic(() => import('../components/RouteMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
      Loading Live Field Routing Frame...
    </div>
  )
});

export default function OwnerDashboard() {
  // Navigation State Engine Panel ('pending' vs 'history' vs 'finance' vs 'map' vs 'admin')
  const [activeTab, setActiveTab] = useState('pending');

  // Core Data Lists
  const [pendingOrders, setPendingOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [registeredShops, setRegisteredShops] = useState([]);
  const [productsCatalog, setProductsCatalog] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]); // Running on-duty fleet state cache
  const [isLoading, setIsLoading] = useState(true);
  
  // New Admin Entry States
  const [newAgentName, setNewAgentName] = useState('');
  const [isAddingAgent, setIsAddingAgent] = useState(false);

  // Digital Statement of Accounts Tracker States
  const [selectedShopLedger, setSelectedShopLedger] = useState(null);
  const [shopLedgerHistory, setShopLedgerHistory] = useState([]);

  // 🧾 Targeted Printable Invoice States (With Lifecycle Gatekeepers)
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState(null);
  const [isReadyToPrint, setIsReadyToPrint] = useState(false);

  // Advanced Business Intelligence Matrix States
  const [financials, setFinancials] = useState({ 
    totalSales: 0, 
    totalCollected: 0, 
    totalOutstanding: 0,
    cashCollected: 0,
    upiCollected: 0,
    chequeCollected: 0,
    agentRankings: {},
    defaulterList: []
  });

  // Review Drawer States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedAgentForOrder, setSelectedAgentForOrder] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  async function loadPendingOrders() {
    setIsLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select(`id, bill_number, employee_name, bill_amount, created_at, shops ( id, name, phone_number )`)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    if (data) setPendingOrders(data);
    setIsLoading(false);
  }

  async function loadHistoryLedger() {
    setIsLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select(`id, bill_number, employee_name, bill_amount, amount_received, pending_amount, status, payment_mode, delivered_at, shops ( id, name, phone_number )`)
      .in('status', ['approved', 'delivered'])
      .order('created_at', { ascending: false });
    if (data) setHistoryOrders(data);
    setIsLoading(false);
  }

  async function calculateFinancialMetrics() {
    setIsLoading(true);
    const { data } = await supabase
      .from('transactions').select('bill_amount, amount_received, pending_amount, payment_mode, employee_name, created_at, shops(name)')
      .in('status', ['approved', 'delivered']);

    if (data) {
      let salesSum = 0; let collectedSum = 0; let creditSum = 0;
      let cashSum = 0; let upiSum = 0; let chequeSum = 0;
      let agents = {}; let shopsDebt = {};

      data.forEach(tx => {
        const amtValue = parseFloat(tx.bill_amount || 0);
        const recValue = parseFloat(tx.amount_received || 0);
        const pendValue = parseFloat(tx.pending_amount || 0);

        salesSum += amtValue;
        collectedSum += recValue;
        creditSum += pendValue;

        const mode = (tx.payment_mode || 'Cash').toLowerCase();
        if (mode.includes('cash')) cashSum += recValue;
        else if (mode.includes('upi') || mode.includes('gpay') || mode.includes('phonepe')) upiSum += recValue;
        else if (mode.includes('cheque')) chequeSum += recValue;

        if (tx.employee_name) {
          if (!agents[tx.employee_name]) agents[tx.employee_name] = { sales: 0, collected: 0 };
          agents[tx.employee_name].sales += amtValue;
          agents[tx.employee_name].collected += recValue;
        }

        if (pendValue > 0 && tx.shops?.name) {
          if (!shopsDebt[tx.shops.name]) shopsDebt[tx.shops.name] = 0;
          shopsDebt[tx.shops.name] += pendValue;
        }
      });

      const sortedDefaulters = Object.entries(shopsDebt)
        .map(([name, balance]) => ({ name, balance }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5);

      setFinancials({ 
        totalSales: salesSum, 
        totalCollected: collectedSum, 
        totalOutstanding: creditSum,
        cashCollected: cashSum,
        upiCollected: upiSum,
        chequeCollected: chequeSum,
        agentRankings: agents,
        defaulterList: sortedDefaulters
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
    const { data } = await supabase.from('products').select('id, name, unit_price, inventory_stock, is_active').order('name', { ascending: true });
    if (data) setProductsCatalog(data);
    setIsLoading(false);
  }

  async function loadActiveAgentsList() {
    const { data } = await supabase.from('employees').select('id, name').order('name', { ascending: true });
    if (data) setActiveAgents(data);
  }

  async function loadShopStatement(shopId, shopName) {
    setIsLoading(true);
    setSelectedShopLedger(shopName);
    const { data, error } = await supabase
      .from('transactions')
      .select('bill_number, bill_amount, amount_received, pending_amount, status, payment_mode, created_at, delivered_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    if (data) setShopLedgerHistory(data);
    setIsLoading(false);
  }

  // 📥 Fetch complete itemization rows and secure the lock state
  async function fetchAndPrintInvoice(order) {
    setIsLoading(true);
    setIsReadyToPrint(false); // Reset print readiness lock
    
    const { data, error } = await supabase
      .from('transaction_items')
      .select(`quantity, total_price, products ( name, unit_price )`)
      .eq('transaction_id', order.id);

    if (error) {
      console.error(error);
      alert("Failed to retrieve product lines for this invoice.");
      setIsLoading(false);
      return;
    }

    // Load data arrays completely into state data-cache container
    setSelectedPrintInvoice({ ...order, items: data || [] });
    setIsReadyToPrint(true); // Signal the lifecycle listener that data is mounted
    setIsLoading(false);
  }

  // 🖨️ Lifecycle Listener: Natively triggers print window ONLY when layout is fully populated
  useEffect(() => {
    if (isReadyToPrint && selectedPrintInvoice) {
      window.print();
      // Instantly wipe context frames post printing screen exit to restore dashboard state
      setIsReadyToPrint(false);
      setSelectedPrintInvoice(null);
    }
  }, [isReadyToPrint, selectedPrintInvoice]);

  useEffect(() => {
    setSelectedOrder(null);
    setSelectedShopLedger(null);
    setSelectedAgentForOrder('');
    if (activeTab === 'pending') {
      loadPendingOrders();
      loadActiveAgentsList();
    }
    else if (activeTab === 'history') loadHistoryLedger();
    else if (activeTab === 'finance') calculateFinancialMetrics();
    else if (activeTab === 'map') loadRouteMapLocations();
    else if (activeTab === 'admin') {
      loadMasterProducts();
      loadActiveAgentsList();
    }
  }, [activeTab]);

  const handleAddAgentSubmit = async (e) => {
    e.preventDefault();
    if (!newAgentName.trim()) return alert('Please type an booking agent name.');
    setIsAddingAgent(true);
    const { error } = await supabase.from('employees').insert([{ name: newAgentName.trim() }]);
    setIsAddingAgent(false);
    if (error) alert('Failed to insert booking agent record into database.');
    else {
      alert(`Success! Booking Field Agent "${newAgentName}" is now active.`);
      setNewAgentName('');
      loadActiveAgentsList();
    }
  };

  const handleReviewClick = async (order) => {
    setSelectedOrder(order);
    const { data } = await supabase.from('transaction_items').select(`id, quantity, total_price, products ( id, name, unit_price, inventory_stock )`).eq('transaction_id', order.id);
    if (data) setOrderItems(data);
  };

  const handleQuantityEdit = (index, newQty) => {
    const updated = [...orderItems];
    const qty = parseInt(newQty) || 0;
    updated[index].quantity = qty;
    const baseRate = updated[index].products?.unit_price || 0;
    updated[index].total_price = baseRate * qty;
    setOrderItems(updated);
  };

  const handleUpdateDraft = async () => {
    if (orderItems.some(item => item.quantity <= 0)) return alert('Quantity must be greater than 0.');
    setIsUpdating(true);
    try {
      let absoluteSum = 0;
      for (const item of orderItems) {
        absoluteSum += item.total_price;
        await supabase.from('transaction_items').update({ quantity: item.quantity, total_price: item.total_price }).eq('id', item.id);
      }
      await supabase.from('transactions').update({ bill_amount: absoluteSum }).eq('id', selectedOrder.id);
      alert('Order quantities updated successfully!');
      loadPendingOrders();
    } catch (err) { console.error(err); } finally { setIsUpdating(false); }
  };

  const handleApproveAndRelease = async () => {
    if (!selectedAgentForOrder) {
      return alert('⚠️ Operational Block: Please assign an active field agent before releasing this delivery route cargo.');
    }
    const stockShortage = orderItems.some(item => item.quantity > (item.products?.inventory_stock || 0));
    if (stockShortage) return alert('🚨 Cannot Release! Quantity exceeds warehouse stock levels.');
    setIsUpdating(true);
    try {
      for (const item of orderItems) {
        const currentStock = item.products?.inventory_stock || 0;
        await supabase.from('products').update({ inventory_stock: currentStock - item.quantity }).eq('id', item.products.id);
      }
      await supabase.from('transactions').update({ status: 'approved', employee_name: selectedAgentForOrder }).eq('id', selectedOrder.id);
      alert(`Order ${selectedOrder.bill_number} warehouse units deducted and dispatched via Agent "${selectedAgentForOrder}"!`);
      setSelectedOrder(null);
      setSelectedAgentForOrder('');
      loadPendingOrders();
    } catch (err) { alert('Inventory dispatch optimization error.'); } finally { setIsUpdating(false); }
  };

  const handleFinalizeDelivery = async (transactionId, totalBill, amountReceived, paymentMode) => {
    if (isNaN(amountReceived) || amountReceived < 0) {
      return alert('⚠️ Operational Block: Invalid collection amount entered.');
    }

    setIsUpdating(true);
    try {
      // Calculate outstanding credit exposure automatically
      const pendingAmount = totalBill - amountReceived;
      
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'delivered',
          amount_received: amountReceived,
          pending_amount: pendingAmount,
          payment_mode: paymentMode,
          delivered_at: new Date().toISOString() // Stamp real-time completion clock
        })
        .eq('id', transactionId);

      if (error) throw error;

      alert('🎉 Delivery route settlement successfully synchronized!');
      loadHistoryLedger(); // Refresh list data parameters instantly
    } catch (err) {
      console.error(err);
      alert('Failed to settle delivery parameters on database layers.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', color: '#0f172a', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar Command Rack */}
      <aside style={{ width: '260px', backgroundColor: '#0f172a', padding: '25px', color: '#ffffff' }} className="no-print">
        <h2 style={{ margin: '0 0 5px', fontSize: '22px', fontWeight: 'bold' }}>EasyTrack</h2>
        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '35px' }}>HQ Control Room</span>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div onClick={() => setActiveTab('pending')} style={{ padding: '12px 16px', backgroundColor: activeTab === 'pending' ? '#1e293b' : 'transparent', borderRadius: '6px', color: activeTab === 'pending' ? '#38bdf8' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>⏳ Pending Orders Queue</div>
          <div onClick={() => setActiveTab('history')} style={{ padding: '12px 16px', backgroundColor: activeTab === 'history' ? '#1e293b' : 'transparent', borderRadius: '6px', color: activeTab === 'history' ? '#38bdf8' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>📜 Dispatched Ledger</div>
          <div onClick={() => setActiveTab('finance')} style={{ padding: '12px 16px', backgroundColor: activeTab === 'finance' ? '#1e293b' : 'transparent', borderRadius: '6px', color: activeTab === 'finance' ? '#38bdf8' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>📈 Financial Insights</div>
          <div onClick={() => setActiveTab('map')} style={{ padding: '12px 16px', backgroundColor: activeTab === 'map' ? '#1e293b' : 'transparent', borderRadius: '6px', color: activeTab === 'map' ? '#38bdf8' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>🗺️ Route Visualizer Map</div>
          <div onClick={() => setActiveTab('admin')} style={{ padding: '12px 16px', backgroundColor: activeTab === 'admin' ? '#1e293b' : 'transparent', borderRadius: '6px', color: activeTab === 'admin' ? '#38bdf8' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>👥 Management Panel</div>
        </nav>
      </aside>

      {/* Main Board Arena */}
      <main style={{ flexGrow: 1, padding: '40px', boxSizing: 'border-box' }} className="no-print">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
          <div>
            <h1 style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>
              {activeTab === 'pending' && 'Pending Orders Queue'}
              {activeTab === 'history' && 'Dispatched & Delivery Ledger'}
              {activeTab === 'finance' && 'HQ Advanced Business Analytics'}
              {activeTab === 'map' && 'Route Visualizer Map'}
              {activeTab === 'admin' && 'HQ Management Control Board'}
            </h1>
          </div>
        </header>

        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
          
          <div style={{ flexGrow: 1 }}>
            {isLoading ? (
              <p style={{ padding: '20px', color: '#64748b' }}>Downloading workspace datasets...</p>
            ) : activeTab === 'pending' ? (
              /* ---------------- VIEW A: PENDING DRAFTS ---------------- */
              pendingOrders.length === 0 ? ( <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}><p style={{ margin: '0', color: '#64748b' }}>No pending orders waiting for review.</p></div> ) : (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}><th style={{ padding: '16px', color: '#475569' }}>Bill Number</th><th style={{ padding: '16px', color: '#475569' }}>Retailer Shop</th><th style={{ padding: '16px', color: '#475569' }}>Booking Agent</th><th style={{ padding: '16px', color: '#475569' }}>Provisional Amount</th><th style={{ padding: '16px', color: '#475569' }}>Actions</th></tr></thead>
                    <tbody>{pendingOrders.map((order) => ( <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '16px', fontWeight: 'bold' }}>{order.bill_number}</td><td style={{ padding: '16px' }}><span style={{ display: 'block', fontWeight: '500' }}>{order.shops?.name}</span></td><td style={{ padding: '16px', color: '#475569' }}>{order.employee_name}</td><td style={{ padding: '16px', fontWeight: 'bold', color: '#16a34a' }}>₹{order.bill_amount}</td><td style={{ padding: '16px' }}><button onClick={() => handleReviewClick(order)} style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Review & Edit</button></td></tr> ))}</tbody>
                  </table>
                </div>
              )
            ) : activeTab === 'history' ? (
              /* ---------------- VIEW B: DISPATCHED HISTORY LEDGER WITH INTERACTIVE FETCH PRINT HOOK ---------------- */
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}><th style={{ padding: '16px', color: '#475569' }}>Bill Number</th><th style={{ padding: '16px', color: '#475569' }}>Retailer Shop</th><th style={{ padding: '16px', color: '#475569' }}>Order Value</th><th style={{ padding: '16px', color: '#475569' }}>Collected</th><th style={{ padding: '16px', color: '#475569' }}>Payment Mode</th><th style={{ padding: '16px', color: '#475569' }}>Pending Amount</th><th style={{ padding: '16px', color: '#475569' }}>Status</th><th style={{ padding: '16px', color: '#475569', textAlign: 'center' }}>Actions</th></tr></thead>
                  <tbody>{historyOrders.map((order) => { 
                    let badgeLabel = '🚚 En Route'; let bgStyle = '#fef9c3'; let textStyle = '#854d0e'; 
                    if (order.status === 'delivered') { 
                      if (parseFloat(order.pending_amount) <= 0) { badgeLabel = '✓ Settled'; bgStyle = '#dcfce7'; textStyle = '#15803d'; } 
                      else { badgeLabel = '⚠️ Credit Balance'; bgStyle = '#fee2e2'; textStyle = '#991b1b'; } 
                    } 
                    return ( 
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold' }}>{order.bill_number}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ display: 'block', fontWeight: '500' }}>{order.shops?.name}</span>
                          <button onClick={() => loadShopStatement(order.shops?.id, order.shops?.name)} style={{ background: 'none', border: 'none', color: '#2563eb', padding: '0', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', marginTop: '2px' }}>
                            📊 Statement History
                          </button>
                        </td>
                        <td style={{ padding: '16px', fontWeight: '600' }}>₹{order.bill_amount}</td>
                        <td style={{ padding: '16px', color: '#16a34a', fontWeight: '600' }}>₹{order.amount_received}</td>
                        <td style={{ padding: '16px', color: '#475569', fontWeight: '500' }}><span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>💳 {order.payment_mode || 'Cash'}</span></td>
                        <td style={{ padding: '16px', color: order.pending_amount > 0 ? '#dc2626' : '#475569', fontWeight: '600' }}>₹{order.pending_amount}</td>
                        <td style={{ padding: '16px' }}><span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold', backgroundColor: bgStyle, color: textStyle }}>{badgeLabel}</span></td>
                        <td style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                          <button onClick={() => fetchAndPrintInvoice(order)} style={{ width: '100%', padding: '6px 12px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📥 Print Bill</button>
                          
                          {/* Real-time settlement injection loop */}
                          {order.status === 'approved' && (
                            <button 
                              onClick={() => {
                                const amt = prompt(`Enter amount collected by Agent for Bill ${order.bill_number} (Total: ₹${order.bill_amount}):`);
                                if (amt === null) return;
                                
                                const mode = prompt(`Enter Payment Mode (Cash, UPI, Cheque):`, 'Cash');
                                if (!mode) return;

                                handleFinalizeDelivery(order.id, parseFloat(order.bill_amount), parseFloat(amt), mode);
                              }} 
                              style={{ width: '100%', padding: '6px 12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                              🚚 Log Delivery
                            </button>
                          )}
                        </td>
                      </tr> 
                    ); 
                  })}</tbody>
                </table>
              </div>
            ) : activeTab === 'finance' ? (
              /* ---------------- VIEW C: HEAVY FINANCIAL INSIGHTS & INTEL ---------------- */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}><span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>GROSS OUTFLOW VALUE</span><strong style={{ fontSize: '24px', display: 'block', marginTop: '5px' }}>₹{financials.totalSales.toLocaleString('en-IN')}</strong></div>
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}><span style={{ fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>TOTAL CAPITAL RECOVERED</span><strong style={{ fontSize: '24px', display: 'block', color: '#16a34a', marginTop: '5px' }}>₹{financials.totalCollected.toLocaleString('en-IN')}</strong></div>
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1 }}><span style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626' }}>OUTSTANDING MARKET RISK</span><strong style={{ fontSize: '24px', display: 'block', color: '#dc2626', marginTop: '5px' }}>₹{financials.totalOutstanding.toLocaleString('en-IN')}</strong></div>
                </div>

                <div style={{ display: 'flex', gap: '30px' }}>
                  <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Liquid Collection Stream Breakdown</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span>💵 Handover Cash Ledger</span><strong style={{ color: '#16a34a' }}>₹{financials.cashCollected.toLocaleString('en-IN')}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><span>📱 Digital UPI Route Transfers</span><strong style={{ color: '#2563eb' }}>₹{financials.upiCollected.toLocaleString('en-IN')}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🏢 Uncleared Clearing Cheques</span><strong>₹{financials.chequeCollected.toLocaleString('en-IN')}</strong></div>
                    </div>
                  </div>

                  <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#991b1b' }}>⚠️ High Exposure Outstanding Shop Balances</h3>
                    {financials.defaulterList.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '14px' }}>All accounts clean across current lines.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {financials.defaulterList.map((shop, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span>{shop.name}</span>
                            <span style={{ fontWeight: 'bold', color: '#dc2626' }}>₹{shop.balance.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>👥 Field Force Revenue Performance Analysis</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '12px' }}>Agent Name Profile</th>
                        <th style={{ padding: '12px' }}>Gross Revenue Booked</th>
                        <th style={{ padding: '12px' }}>Recovered Cash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(financials.agentRankings).map(([name, data], i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{name}</td>
                          <td style={{ padding: '12px', color: '#2563eb' }}>₹{data.sales.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '12px', color: '#16a34a' }}>₹{data.collected.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'map' ? (
              /* ---------------- VIEW D: ROUTE VISUALIZER MAPS ---------------- */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
                
                {/* Live OpenStreetMap Interactive Module Frame */}
                <div>
                  <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#475569', fontWeight: 'bold' }}>📍 Live Grid Distribution Matrix</h3>
                  <InteractiveRouteMap shops={registeredShops} />
                </div>

                {/* Metadata Retail Shop Destination Information Grid */}
                <div>
                  <h3 style={{ fontSize: '16px', margin: '0 0 15px 0', color: '#475569', fontWeight: 'bold' }}>🏪 Registered Supply Destinations</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {registeredShops.map((shop) => { 
                      const hasCoordinates = shop.latitude && shop.longitude; 
                      const geoMapsUrl = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`; 
                      return ( 
                        <div key={shop.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#1e293b', fontWeight: 'bold' }}>{shop.name}</h3>
                            <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#64748b' }}>📞 {shop.phone_number || 'No WhatsApp Contact'}</p>
                            <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '12px', color: '#475569' }}>
                              {hasCoordinates ? ( 
                                <div>
                                  <span style={{ display: 'block', marginBottom: '2px' }}><strong>Lat:</strong> {parseFloat(shop.latitude).toFixed(5)}</span>
                                  <span style={{ display: 'block' }}><strong>Lng:</strong> {parseFloat(shop.longitude).toFixed(5)}</span>
                                </div> 
                              ) : ( 
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>📍 No GPS Coordinates Pinned</span> 
                              )}
                            </div>
                          </div>
                          {hasCoordinates ? ( 
                            <a href={geoMapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '10px', backgroundColor: '#0f172a', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>🗺️ View on Google Maps</a> 
                          ) : ( 
                            <button disabled style={{ width: '100%', padding: '10px', backgroundColor: '#e2e8f0', color: '#94a3b8', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'not-allowed' }}>Location Unavailable</button> 
                          )}
                        </div> 
                      ); 
                    })}
                  </div>
                </div>

              </div>
            ) : (
              /* 👥 ---------------- VIEW E: RECONCILED MANAGEMENT CONTROL PANEL ---------------- */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Add New Agent Profile</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Register an active field booking agent to your routing grid drop-downs instantly.</p>
                  <form onSubmit={handleAddAgentSubmit} style={{ display: 'flex', gap: '15px', maxWidth: '500px' }}>
                    <input type="text" placeholder="Enter Full Name (e.g. Anand Kumar)" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} style={{ flexGrow: 1, padding: '12px', border: '2px solid #cbd5e1', borderRadius: '6px', fontSize: '15px' }} />
                    <button type="submit" disabled={isAddingAgent} style={{ padding: '0 24px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>{isAddingAgent ? 'Saving...' : '➕ Add Agent'}</button>
                  </form>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Add New Product Variant</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Introduce a new product line, set its wholesale rate, and load initial warehouse boxes.</p>
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target;
                      const name = form.prodName.value.trim();
                      const price = parseFloat(form.prodPrice.value) || 0;
                      const stock = parseInt(form.prodStock.value) || 0;
                      if (!name) return alert('Please enter a product name.');

                      try {
                        const stringId = crypto.randomUUID();

                        const { error } = await supabase
                          .from('products')
                          .insert([{ 
                            id: stringId, 
                            name: name, 
                            unit_price: price, 
                            inventory_stock: stock, 
                            is_active: true 
                          }]);

                        if (error) throw error;

                        alert(`Success! "${name}" added to live catalog master.`);
                        form.reset();
                        loadMasterProducts();
                      } catch (err) {
                        console.error(err);
                        alert(`Database Error: ${err.message || 'Verify your connection constraints.'}`);
                      }
                    }} 
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}
                  >
                    <div style={{ flex: '1', minWidth: '200px' }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Product Variant Name</label><input type="text" name="prodName" placeholder="e.g. Premium Box Pack C" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} /></div>
                    <div style={{ width: '130px' }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Wholesale Price (₹)</label><input type="number" name="prodPrice" placeholder="450" min="0" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} /></div>
                    <div style={{ width: '130px' }}><label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Warehouse Stock</label><input type="number" name="prodStock" placeholder="100" min="0" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} /></div>
                    <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '41px' }}>📦 Add Product</button>
                  </form>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '30px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Wholesale Product Catalog Control Matrix</h3>
                  <p style={{ margin: '0 0 25px 0', fontSize: '13px', color: '#64748b' }}>Modify pricing models, naming headers, inventory stocks, or trigger soft deletion parameters safely.</p>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '16px', color: '#475569' }}>Editable Product Name</th>
                          <th style={{ padding: '16px', color: '#475569', width: '160px' }}>Wholesale Rate (₹)</th>
                          <th style={{ padding: '16px', color: '#475569', width: '160px' }}>Stock Volume (Boxes)</th>
                          <th style={{ padding: '16px', color: '#475569', width: '200px' }}>Management Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productsCatalog.filter(p => p.is_active !== false).map((prod, idx) => (
                          <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px' }}>
                              <input type="text" value={prod.name} onChange={(e) => {
                                const updated = [...productsCatalog]; const globalIdx = updated.findIndex(item => item.id === prod.id);
                                updated[globalIdx].name = e.target.value; setProductsCatalog(updated);
                              }} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            </td>
                            <td style={{ padding: '16px' }}>
                              <input type="number" value={prod.unit_price} onChange={(e) => {
                                const updated = [...productsCatalog]; const globalIdx = updated.findIndex(item => item.id === prod.id);
                                updated[globalIdx].unit_price = e.target.value; setProductsCatalog(updated);
                              }} style={{ width: '110px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#16a34a' }} />
                            </td>
                            <td style={{ padding: '16px' }}>
                              <input type="number" value={prod.inventory_stock} onChange={(e) => {
                                const updated = [...productsCatalog]; const globalIdx = updated.findIndex(item => item.id === prod.id);
                                updated[globalIdx].inventory_stock = e.target.value; setProductsCatalog(updated);
                              }} style={{ width: '110px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }} />
                            </td>
                            <td style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={async () => {
                                  const { error } = await supabase.from('products').update({ name: prod.name, unit_price: parseFloat(prod.unit_price) || 0, inventory_stock: parseInt(prod.inventory_stock) || 0 }).eq('id', prod.id);
                                  if (error) alert('Error saving adjustments.');
                                  else alert('Configuration parameters successfully synchronized!');
                                }}
                                style={{ padding: '8px 12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                              >Save</button>
                              <button 
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to remove "${prod.name}"? This soft-deletes the active view but keeps previous history data unharmed.`)) {
                                    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', prod.id);
                                    if (error) alert('Failed to update visibility matrix.');
                                    else { alert('Catalog master modified.'); loadMasterProducts(); }
                                  }
                                }}
                                style={{ padding: '8px 12px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                              >Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 📊 SIDE DRAWER: DIGITAL STATEMENT OF ACCOUNTS LEDGER TIMELINE */}
          {selectedShopLedger && activeTab === 'history' && (
            <div style={{ width: '450px', backgroundColor: '#ffffff', borderRadius: '8px', border: '2px solid #2563eb', padding: '25px', boxSizing: 'border-box' }} className="no-print">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0', fontSize: '16px', color: '#1e3a8a' }}>📜 Account Ledger: {selectedShopLedger}</h3>
                <button onClick={() => setSelectedShopLedger(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto', paddingRight: '5px' }}>
                {shopLedgerHistory.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>No running ledger records for this shop.</p>
                ) : (
                  shopLedgerHistory.map((ledger, idx) => (
                    <div key={idx} style={{ padding: '12px', borderLeft: '4px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '0 6px 6px 0', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 'bold' }}>
                        <span>🆔 {ledger.bill_number}</span>
                        <span style={{ color: '#64748b' }}>{new Date(ledger.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#475569' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Value Delivered:</span><strong style={{ color: '#0f172a' }}>₹{ledger.bill_amount}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Payment Clear:</span><strong style={{ color: '#16a34a' }}>₹{ledger.amount_received} ({ledger.payment_mode || 'Cash'})</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                          <span>Running Debt Balance:</span>
                          <strong style={{ color: ledger.pending_amount > 0 ? '#dc2626' : '#16a34a' }}>₹{ledger.pending_amount}</strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => window.print()} style={{ width: '100%', marginTop: '20px', padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                🖨️ Print Statement Timeline
              </button>
            </div>
          )}

          {/* Pending Review Side Drawer */}
          {selectedOrder && activeTab === 'pending' && (
            <div style={{ width: '400px', backgroundColor: '#ffffff', borderRadius: '8px', border: '2px solid #2563eb', padding: '25px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h3 style={{ margin: '0', fontSize: '18px', color: '#1e3a8a' }}>Order Review Suite</h3><button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px' }}>✕</button></div>
              <div style={{ marginBottom: '20px', fontSize: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}><p style={{ margin: '0 0 5px' }}><strong>Bill Target:</strong> {selectedOrder.bill_number}</p><p style={{ margin: '0' }}><strong>Location:</strong> {selectedOrder.shops?.name}</p></div>
              
              {/* Live Field Force Agent Dropdown Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#475569' }}>
                  🚚 Assign Distribution Route Agent
                </label>
                <select 
                  value={selectedAgentForOrder} 
                  onChange={(e) => setSelectedAgentForOrder(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '14px', color: '#0f172a' }}
                >
                  <option value="">-- Select Active Field Agent --</option>
                  {activeAgents.map(agent => (
                    <option key={agent.id} value={agent.name}>{agent.name}</option>
                  ))}
                </select>
              </div>

              <h4 style={{ fontSize: '14px', margin: '0 0 10px', color: '#475569' }}>Product Adjustments & Stock</h4>
              {orderItems.map((item, idx) => {
                const availableStock = item.products?.inventory_stock || 0; const isShortage = item.quantity > availableStock;
                return (
                  <div key={item.id} style={{ padding: '10px', backgroundColor: isShortage ? '#fff5f5' : '#f8fafc', borderRadius: '6px', marginBottom: '12px', border: isShortage ? '1px solid #fecaca' : '1px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ flexGrow: 1 }}><span style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: isShortage ? '#991b1b' : '#0f172a' }}>{item.products?.name}</span><span style={{ fontSize: '12px', color: isShortage ? '#dc2626' : '#64748b' }}>Warehouse Stock: {availableStock} boxes</span></div><input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityEdit(idx, e.target.value)} style={{ width: '65px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px', textAlign: 'center' }} /></div></div>
                );
              })}
              <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><span style={{ fontWeight: 'bold', color: '#475569' }}>Recalculated Bill:</span><span style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}>₹{orderItems.reduce((acc, curr) => acc + (curr.total_price || 0), 0).toLocaleString('en-IN')}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}><button onClick={handleUpdateDraft} disabled={isUpdating} style={{ width: '100%', padding: '10px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold' }}>💾 Save Running Adjustments</button><button onClick={handleApproveAndRelease} disabled={isUpdating} style={{ width: '100%', padding: '14px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🚀 Approve & Release for Delivery</button></div>
            </div>
          )}

        </div>
      </main>

      {/* 📄 ======== EXCLUSIVE PRINT PREVIEW COMPONENT MATERIAL FOR INDIVIDUAL INVOICES ======== */}
      {selectedPrintInvoice && (
        <div className="print-only-container" style={{ display: 'none', fontFamily: 'sans-serif', padding: '30px', color: '#000000' }}>
          
          {/* Header Block */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000000', paddingBottom: '15px', marginBottom: '25px' }}>
            <div>
              <h1 style={{ margin: '0 0 5px 0', fontSize: '26px', fontWeight: 'bold', letterSpacing: '1px' }}>EASYTRACK DISTRIBUTORS</h1>
              <p style={{ margin: '0', fontSize: '13px', color: '#333' }}>Wholesale Route Supply Lines & Logistics</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#555' }}>Madurai, Tamil Nadu, India</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: 'bold', color: '#444' }}>TAX INVOICE</h2>
              <p style={{ margin: '0', fontSize: '13px' }}><strong>Invoice No:</strong> {selectedPrintInvoice.bill_number}</p>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px' }}><strong>Date:</strong> {selectedPrintInvoice.delivered_at ? new Date(selectedPrintInvoice.delivered_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          {/* Metadata Grid Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '14px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', display: 'block', marginBottom: '4px' }}>Billed To:</span>
              <strong>{selectedPrintInvoice.shops?.name || 'Retail Store Partner'}</strong>
              {selectedPrintInvoice.shops?.phone_number && <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>📞 Phone: {selectedPrintInvoice.shops.phone_number}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', display: 'block', marginBottom: '4px' }}>Logistics Context:</span>
              <p style={{ margin: '0' }}><strong>Dispatched By Agent:</strong> {selectedPrintInvoice.employee_name || 'Route Fleet'}</p>
              <p style={{ margin: '4px 0 0 0' }}><strong>Current Status:</strong> {selectedPrintInvoice.status?.toUpperCase()}</p>
            </div>
          </div>

          {/* Itemized Line Rows Content */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000000', borderTop: '1px solid #000000', backgroundColor: '#f9f9f9' }}>
                <th style={{ padding: '10px 6px', textAlign: 'left' }}>S.No</th>
                <th style={{ padding: '10px 6px', textAlign: 'left' }}>Product Description Variant Name</th>
                <th style={{ padding: '10px 6px', textAlign: 'right' }}>Unit Rate</th>
                <th style={{ padding: '10px 6px', textAlign: 'center', width: '90px' }}>Quantity</th>
                <th style={{ padding: '10px 6px', textAlign: 'right', width: '120px' }}>Net Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedPrintInvoice.items?.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 6px' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 6px', fontWeight: 'bold' }}>{line.products?.name}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>₹{(line.products?.unit_price || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'center' }}>{line.quantity} Boxes</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>₹{parseFloat(line.total_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Ledger Aggregations Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <div style={{ width: '320px', fontSize: '14px', lineHeight: '2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc' }}>
                <span>Gross Order Subtotal:</span>
                <strong>₹{parseFloat(selectedPrintInvoice.bill_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc', color: '#15803d' }}>
                <span>Amount Paid Overage ({selectedPrintInvoice.payment_mode || 'Cash'}):</span>
                <strong>- ₹{parseFloat(selectedPrintInvoice.amount_received || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px double #000', paddingTop: '4px', fontSize: '16px' }}>
                <span><strong>Outstanding Owed Balance:</strong></span>
                <strong style={{ color: selectedPrintInvoice.pending_amount > 0 ? '#b91c1c' : '#15803d' }}>
                  ₹{parseFloat(selectedPrintInvoice.pending_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Footer Terms */}
          <div style={{ marginTop: '60px', borderTop: '1px solid #ddd', paddingTop: '15px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
            <p style={{ margin: '0' }}>* This is an electronically generated delivery distribution invoice record. No signature required. *</p>
            <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>Thank you for your valued partnership and business!</p>
          </div>

        </div>
      )}

      {/* Global Framework Dynamic Responsive Printing Engine Overrides Style Embed */}
      <style jsx global>{`
        @media print {
          /* 1. Hide the entire UI workspace frame when printing */
          .no-print, aside, main, header, section, table, button, div, form, label, input { 
            display: none !important; 
          }
          
          /* 2. Isolate and display only the dedicated invoice component block */
          .print-only-container { 
            display: block !important;
            width: 100% !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          @page {
            margin: 1.6cm;
            size: auto;
          }
        }
      `}</style>

    </div>
  );
}