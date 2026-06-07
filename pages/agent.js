import { useState, useEffect } from 'react';
import { useAuth, withAuth } from '../hooks/useAuth';
import { checkCreditAvailable } from '../lib/credit';

function AgentPortal() {
  const { supabase, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('booking');

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [billNumber, setBillNumber] = useState('');

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [selectedShopData, setSelectedShopData] = useState(null);
  const [isNewShop, setIsNewShop] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState({ lat: null, lng: null });
  const [gpsStatus, setGpsStatus] = useState('Not Anchored');
  const [productCatalog, setProductCatalog] = useState([]);
  const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [shopGpsStatus, setShopGpsStatus] = useState('');
  const [isCapturingShopGps, setIsCapturingShopGps] = useState(false);

  // Phase 2
  const [shopSearchText, setShopSearchText] = useState('');
  const [shopSearchResults, setShopSearchResults] = useState([]);
  const [selectedDeliveryShop, setSelectedDeliveryShop] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);

  // Leave states
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isApplyingLeave, setIsApplyingLeave] = useState(false);
  const [leaveMessage, setLeaveMessage] = useState('');
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);

  // Returns & Damage
  const [deliveredBills, setDeliveredBills] = useState([]);
  const [returnFormBill, setReturnFormBill] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnType, setReturnType] = useState('return');
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const generateFreshBillTag = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setBillNumber(`ET-2026-${timestamp}-${randomSuffix}`);
  };

  async function loadInitialData() {
    const { data: empData } = await supabase.from('employees').select('name');
    if (empData) setEmployees(empData);
    const { data: shopData } = await supabase.from('shops').select('id, name, latitude, longitude');
    if (shopData) setShops(shopData);
    const { data: prodData } = await supabase.from('products').select('id, name, unit_price').eq('is_active', true);
    if (prodData) setProductCatalog(prodData);
  }

  async function loadLeaveHistory() {
    setIsLoadingLeaves(true);
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('agent_id', profile?.id)
      .order('leave_date', { ascending: false });
    if (data) setLeaveHistory(data);
    setIsLoadingLeaves(false);
  }

  useEffect(() => {
    generateFreshBillTag();
    loadInitialData();
    if (profile?.role === 'agent' && profile?.full_name) {
      setSelectedEmployee(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'leave' && profile?.id) loadLeaveHistory();
  }, [activeTab, profile]);

  useEffect(() => {
    if (!shopSearchText.trim()) { setShopSearchResults([]); return; }
    const filtered = shops.filter(s => s.name.toLowerCase().includes(shopSearchText.toLowerCase()));
    setShopSearchResults(filtered.slice(0, 8));
  }, [shopSearchText, shops]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveDate) return alert('Please select a leave date.');
    setIsApplyingLeave(true);
    setLeaveMessage('');

    try {
      // Check if leave already exists for this date
      const { data: existing } = await supabase
        .from('leaves')
        .select('id')
        .eq('agent_id', profile.id)
        .eq('leave_date', leaveDate)
        .single();

      if (existing) {
        setLeaveMessage('❌ You already have a leave applied for this date.');
        setIsApplyingLeave(false);
        return;
      }

      // Apply leave
      const { error } = await supabase.from('leaves').insert([{
        agent_id: profile.id,
        agent_name: profile.full_name,
        leave_date: leaveDate,
        reason: leaveReason.trim() || 'Personal leave',
        status: 'approved'
      }]);

      if (error) throw error;

      // Auto-reassign pending deliveries for this date
      await autoReassignDeliveries(leaveDate);

      setLeaveMessage(`✅ Leave applied for ${new Date(leaveDate).toLocaleDateString('en-IN')}. Your deliveries have been reassigned.`);
      setLeaveDate('');
      setLeaveReason('');
      loadLeaveHistory();
    } catch (err) {
      setLeaveMessage('❌ Failed: ' + err.message);
    } finally {
      setIsApplyingLeave(false);
    }
  };

  const autoReassignDeliveries = async (date) => {
    // Get all approved transactions assigned to this agent
    const { data: myBills } = await supabase
      .from('transactions')
      .select('id, employee_name')
      .eq('employee_name', profile.full_name)
      .eq('status', 'approved');

    if (!myBills || myBills.length === 0) return;

    // Get all other active agents
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'agent')
      .neq('id', profile.id);

    if (!allProfiles || allProfiles.length === 0) return;

    // Get agents on leave on the same date
    const { data: onLeave } = await supabase
      .from('leaves')
      .select('agent_name')
      .eq('leave_date', date);

    const onLeaveNames = (onLeave || []).map(l => l.agent_name);

    // Available agents
    const available = allProfiles.filter(a => !onLeaveNames.includes(a.full_name));
    if (available.length === 0) return;

    // Get workload count for each available agent
    const workloads = await Promise.all(available.map(async (agent) => {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('employee_name', agent.full_name)
        .eq('status', 'approved');
      return { ...agent, workload: count || 0 };
    }));

    // Sort by least workload
    workloads.sort((a, b) => a.workload - b.workload);

    // Reassign bills round-robin to available agents
    for (let i = 0; i < myBills.length; i++) {
      const assignTo = workloads[i % workloads.length];
      await supabase
        .from('transactions')
        .update({ employee_name: assignTo.full_name })
        .eq('id', myBills[i].id);
    }
  };

  const handleDeliveryShopSelect = async (shop) => {
    setSelectedDeliveryShop(shop);
    setShopSearchText(shop.name);
    setShopSearchResults([]);
    setMatchedOrder(null);
    setAmountReceived('');
    setPendingBills([]);
    setDeliveredBills([]);
    setReturnFormBill(null);
    setReturnItems([]);
    setIsLoadingBills(true);

    const [pendingRes, deliveredRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, bill_number, bill_amount, amount_received, pending_amount, status')
        .eq('shop_id', shop.id)
        .or('status.eq.approved,and(status.eq.delivered,pending_amount.gt.0)')
        .order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('id, bill_number, bill_amount, created_at')
        .eq('shop_id', shop.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    if (!pendingRes.error && pendingRes.data) setPendingBills(pendingRes.data);
    if (!deliveredRes.error && deliveredRes.data) setDeliveredBills(deliveredRes.data);
    setIsLoadingBills(false);
  };

  const handleShopSelect = (shopId) => {
    setSelectedShop(shopId);
    setShopGpsStatus('');
    if (!shopId) { setSelectedShopData(null); return; }
    const found = shops.find(s => s.id === shopId);
    setSelectedShopData(found || null);
  };

  const captureShopGpsLocation = () => {
    if (!selectedShopData) return;
    setShopGpsStatus('Locating...');
    setIsCapturingShopGps(true);
    if (!navigator.geolocation) { setShopGpsStatus('GPS not supported.'); setIsCapturingShopGps(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const { error } = await supabase.from('shops').update({ latitude: lat, longitude: lng }).eq('id', selectedShopData.id);
        if (error) { setShopGpsStatus('❌ Failed to save.'); }
        else {
          setShopGpsStatus(`✅ Location saved! (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          setShops(shops.map(s => s.id === selectedShopData.id ? { ...s, latitude: lat, longitude: lng } : s));
          setSelectedShopData({ ...selectedShopData, latitude: lat, longitude: lng });
        }
        setIsCapturingShopGps(false);
      },
      () => { setShopGpsStatus('❌ Could not get location.'); setIsCapturingShopGps(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const captureGpsLocation = () => {
    setGpsStatus('Locating...');
    if (!navigator.geolocation) { setGpsStatus('GPS Not Supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setGpsCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }); setGpsStatus('📍 GPS Anchor Locked'); },
      () => setGpsStatus('Failed to capture coordinates'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...orderItems];
    updatedItems[index][field] = value;
    setOrderItems(updatedItems);
  };

  const addOrderItemRow = () => setOrderItems([...orderItems, { productId: '', quantity: 1 }]);
  const removeOrderItemRow = (index) => {
    if (orderItems.length > 1) setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  const handleOpenReturnForm = async (bill) => {
    if (returnFormBill?.id === bill.id) { setReturnFormBill(null); setReturnItems([]); return; }
    const { data: items, error } = await supabase
      .from('transaction_items')
      .select('id, quantity, product_id, total_price, products(id, name, unit_price)')
      .eq('transaction_id', bill.id);
    if (error || !items) return alert('Could not load bill items.');
    setReturnItems(items.map(item => ({ ...item, returnQty: 0 })));
    setReturnType('return');
    setReturnReason('');
    setReturnFormBill(bill);
  };

  const handleSubmitReturn = async () => {
    const toReturn = returnItems.filter(item => item.returnQty > 0);
    if (toReturn.length === 0) return alert('Enter a return quantity for at least one item.');
    setIsSubmittingReturn(true);
    try {
      const totalCredit = toReturn.reduce(
        (sum, item) => sum + parseFloat(item.products?.unit_price || 0) * item.returnQty, 0
      );
      const { data: ret, error: retErr } = await supabase
        .from('returns')
        .insert([{
          transaction_id: returnFormBill.id,
          shop_id: selectedDeliveryShop.id,
          agent_name: selectedEmployee || profile?.full_name || '',
          return_type: returnType,
          reason: returnReason.trim() || null,
          total_credit: totalCredit
        }])
        .select().single();
      if (retErr) throw retErr;
      const { error: riErr } = await supabase.from('return_items').insert(
        toReturn.map(item => ({
          return_id: ret.id,
          product_id: item.product_id,
          product_name: item.products?.name || '',
          quantity: item.returnQty,
          unit_price: parseFloat(item.products?.unit_price || 0)
        }))
      );
      if (riErr) throw riErr;
      // Restore stock only for returns (not damage — goods are unusable)
      if (returnType === 'return') {
        for (const item of toReturn) {
          const { data: prod } = await supabase.from('products').select('inventory_stock').eq('id', item.product_id).single();
          await supabase.from('products').update({
            inventory_stock: (prod?.inventory_stock || 0) + item.returnQty
          }).eq('id', item.product_id);
        }
      }
      alert(`✅ ${returnType === 'return' ? 'Return' : 'Damage'} recorded!\nCredit: ₹${totalCredit.toLocaleString('en-IN')}`);
      setDeliveredBills(prev => prev.filter(b => b.id !== returnFormBill.id));
      setReturnFormBill(null);
      setReturnItems([]);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!matchedOrder) return;
    const newCashInput = parseFloat(amountReceived) || 0;
    if (newCashInput <= 0) return alert('Please enter a valid amount.');
    if (newCashInput > parseFloat(matchedOrder.pending_amount)) return alert(`Max: ₹${matchedOrder.pending_amount}`);

    setIsProcessingDelivery(true);
    try {
      const updatedAmountReceived = parseFloat(matchedOrder.amount_received || 0) + newCashInput;
      const finalRemainingPending = parseFloat(matchedOrder.bill_amount) - updatedAmountReceived;
      const { error } = await supabase.from('transactions').update({
        status: 'delivered', amount_received: updatedAmountReceived,
        pending_amount: finalRemainingPending, payment_mode: paymentMode,
        delivered_at: new Date().toISOString()
      }).eq('id', matchedOrder.id).select();

      if (error) { alert('Update failed: ' + error.message); return; }
      alert(`✅ Collected ₹${newCashInput}. Remaining: ₹${finalRemainingPending}`);
      setMatchedOrder(null); setAmountReceived('');
      if (selectedDeliveryShop) handleDeliveryShopSelect(selectedDeliveryShop);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally { setIsProcessingDelivery(false); }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return alert('Please choose your name.');
    if (orderItems.some(item => !item.productId)) return alert('Please select a product for every row.');
    setIsSubmitting(true);
    let targetShopId = selectedShop;
    try {
      if (isNewShop) {
        if (!newShopName.trim()) throw new Error('Please enter a shop name.');
        const { data: shopData, error: shopErr } = await supabase.from('shops')
          .insert([{ name: newShopName.trim(), phone_number: whatsappNumber, latitude: gpsCoordinates.lat, longitude: gpsCoordinates.lng }])
          .select().single();
        if (shopErr) throw shopErr;
        targetShopId = shopData.id;
      }
      if (!targetShopId) throw new Error('Please select a shop.');
      let cumulativeBillSum = 0;
      const formulatedItems = orderItems.map(item => {
        const prod = productCatalog.find(p => p.id === item.productId);
        const rowSum = (prod ? prod.unit_price : 0) * item.quantity;
        cumulativeBillSum += rowSum;
        return { product_id: item.productId, quantity: item.quantity, total_price: rowSum };
      });
      // --- CREDIT LIMIT CHECK ---
      const { data: shopCredit, error: creditFetchErr } = await supabase
        .from('shops')
        .select('credit_limit, name')
        .eq('id', targetShopId)
        .single();
      console.log('[credit] shop row:', shopCredit, '| fetchErr:', creditFetchErr);
      if (creditFetchErr) throw new Error('Could not verify credit limit: ' + creditFetchErr.message);
      const creditLimit = parseFloat(shopCredit?.credit_limit ?? 0);
      console.log('[credit] creditLimit parsed:', creditLimit);
      if (creditLimit > 0) {
        const { data: openTx, error: txFetchErr } = await supabase
          .from('transactions')
          .select('bill_amount')
          .eq('shop_id', targetShopId)
          .neq('status', 'delivered');
        console.log('[credit] open transactions:', openTx, '| txFetchErr:', txFetchErr);
        const creditUsed = (openTx || []).reduce((s, tx) => s + parseFloat(tx.bill_amount || 0), 0);
        const available = Math.max(0, creditLimit - creditUsed);
        console.log('[credit] used:', creditUsed, '| new order:', cumulativeBillSum, '| available:', available);
        if (creditUsed + cumulativeBillSum > creditLimit) {
          const msg = `❌ Credit limit exceeded for ${shopCredit.name}.\n\nLimit: ₹${creditLimit.toLocaleString('en-IN')}\nAlready used: ₹${creditUsed.toLocaleString('en-IN')}\nThis order: ₹${cumulativeBillSum.toLocaleString('en-IN')}\nAvailable: ₹${available.toLocaleString('en-IN')}`;
          alert(msg);
          setIsSubmitting(false);
          return;
        }
      }
      const { data: txData, error: txErr } = await supabase.from('transactions')
        .insert([{ bill_number: billNumber, shop_id: targetShopId, employee_name: selectedEmployee, status: 'draft', bill_amount: cumulativeBillSum }])
        .select().single();
      if (txErr) {
        // Trigger fires 'credit_limit_exceeded'; human detail is in hint
        const msg = txErr.message === 'credit_limit_exceeded'
          ? 'Order blocked: Shop has reached its credit limit. Please collect payment before placing new orders.'
          : `Order failed: ${txErr.message}`;
        alert(msg);
        setIsSubmitting(false);
        return;
      }
      await supabase.from('transaction_items').insert(formulatedItems.map(item => ({ transaction_id: txData.id, ...item })));
      alert(`✅ Order ${billNumber} submitted!`);
      setOrderItems([{ productId: '', quantity: 1 }]);
      setNewShopName(''); setWhatsappNumber('');
      setGpsCoordinates({ lat: null, lng: null }); setGpsStatus('Not Anchored');
      setIsNewShop(false); setSelectedShop(''); setSelectedShopData(null); setShopGpsStatus('');
      generateFreshBillTag(); loadInitialData();
    } catch (err) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const selectedShopMissingGps = selectedShopData && !selectedShopData.latitude && !selectedShopData.longitude;
  const todayStr = new Date().toISOString().split('T')[0];

  const tabStyle = (tab) => ({
    flex: 1, padding: '10px', border: 'none', borderRadius: '6px',
    fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
    backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
    color: activeTab === tab ? '#2563eb' : '#475569'
  });

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: '20px', color: '#0f172a' }}>
      <div style={{ fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>

        <header style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: '0', color: '#1e293b', fontSize: '28px', fontWeight: 'bold' }}>EasyTrack</h1>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '14px' }}>Route Systems Portal</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '4px 14px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
            <span style={{ fontSize: '13px', color: '#166534', fontWeight: '500' }}>{profile?.full_name || selectedEmployee || 'Field Agent'}</span>
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', padding: '0 0 0 6px', borderLeft: '1px solid #d1fae5' }}>Sign out</button>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display: 'flex', borderRadius: '8px', backgroundColor: '#f1f5f9', padding: '4px', marginBottom: '25px', gap: '2px' }}>
          <button type="button" onClick={() => setActiveTab('booking')} style={tabStyle('booking')}>📝 Book Order</button>
          <button type="button" onClick={() => setActiveTab('delivery')} style={tabStyle('delivery')}>📦 Deliver & Collect</button>
          <button type="button" onClick={() => setActiveTab('leave')} style={tabStyle('leave')}>🏖️ Leave</button>
        </div>

        {/* ── PHASE 1: BOOK ORDER ── */}
        {activeTab === 'booking' ? (
          <form onSubmit={handleSubmitOrder}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Select Your Name</label>
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} disabled={profile?.role === 'agent'}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', backgroundColor: profile?.role === 'agent' ? '#f8fafc' : '#ffffff', color: '#0f172a' }}>
                <option value="">-- Choose Employee --</option>
                {employees.map((emp, idx) => <option key={idx} value={emp.name}>{emp.name}</option>)}
              </select>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Auto-Generated Bill Tag</span>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>{billNumber}</strong>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold' }}>Select Retailer Shop</label>
                <button type="button" onClick={() => { setIsNewShop(!isNewShop); setSelectedShop(''); setSelectedShopData(null); setShopGpsStatus(''); }}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                  {isNewShop ? '← Existing' : '➕ New Shop'}
                </button>
              </div>
              {!isNewShop ? (
                <div>
                  <select value={selectedShop} onChange={(e) => handleShopSelect(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value="">-- Select Existing Shop --</option>
                    {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}{!shop.latitude ? ' 📍 (No GPS)' : ''}</option>)}
                  </select>
                  {selectedShopMissingGps && (
                    <div style={{ marginTop: '12px', padding: '14px', backgroundColor: '#fffbeb', border: '1.5px solid #fbbf24', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#92400e', fontWeight: '500' }}>⚠️ No GPS saved. Capture it now!</p>
                      <button type="button" onClick={captureShopGpsLocation} disabled={isCapturingShopGps}
                        style={{ width: '100%', padding: '12px', backgroundColor: isCapturingShopGps ? '#94a3b8' : '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isCapturingShopGps ? 'not-allowed' : 'pointer' }}>
                        {isCapturingShopGps ? '📡 Getting Location...' : '📍 Capture Shop Location'}
                      </button>
                      {shopGpsStatus && <p style={{ margin: '8px 0 0', fontSize: '13px', color: shopGpsStatus.includes('✅') ? '#16a34a' : '#dc2626', fontWeight: '500', textAlign: 'center' }}>{shopGpsStatus}</p>}
                    </div>
                  )}
                  {selectedShopData && selectedShopData.latitude && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#16a34a' }}>✅ GPS: {parseFloat(selectedShopData.latitude).toFixed(4)}, {parseFloat(selectedShopData.longitude).toFixed(4)}</p>
                  )}
                </div>
              ) : (
                <div style={{ padding: '15px', border: '2px solid #2563eb', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <input type="text" placeholder="Store Name" value={newShopName} onChange={(e) => setNewShopName(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} />
                  <input type="tel" placeholder="WhatsApp Number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} />
                  <button type="button" onClick={captureGpsLocation}
                    style={{ width: '100%', padding: '12px', backgroundColor: gpsStatus.includes('Locked') ? '#10b981' : '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
                    {gpsStatus}
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px' }}>Order Items</label>
              {orderItems.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <select value={item.productId} onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                    style={{ flexGrow: 2, padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value="">-- Choose Product --</option>
                    {productCatalog.map((prod) => <option key={prod.id} value={prod.id}>{prod.name} (₹{prod.unit_price})</option>)}
                  </select>
                  <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    style={{ width: '70px', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', textAlign: 'center', backgroundColor: '#ffffff', color: '#0f172a' }} />
                  {orderItems.length > 1 && (
                    <button type="button" onClick={() => removeOrderItemRow(index)}
                      style={{ padding: '0 12px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOrderItemRow} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>➕ Add Product Line</button>
            </div>

            <button type="submit" disabled={isSubmitting}
              style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'Submitting...' : '🚀 Submit Order'}
            </button>
          </form>

        ) : activeTab === 'delivery' ? (
          /* ── PHASE 2: DELIVER & COLLECT ── */
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Search Shop Name</label>
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="Type shop name..." value={shopSearchText}
                  onChange={(e) => { setShopSearchText(e.target.value); if (!e.target.value) { setSelectedDeliveryShop(null); setPendingBills([]); setMatchedOrder(null); } }}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }} />
                {shopSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px' }}>
                    {shopSearchResults.map((shop) => (
                      <div key={shop.id} onClick={() => handleDeliveryShopSelect(shop)}
                        style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '15px' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}>
                        🏪 {shop.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedDeliveryShop && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '18px' }}>🏪</span>
                  <div>
                    <p style={{ margin: '0', fontWeight: 'bold', fontSize: '15px', color: '#166534' }}>{selectedDeliveryShop.name}</p>
                    <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>Select a pending bill below</p>
                  </div>
                  <button onClick={() => { setSelectedDeliveryShop(null); setShopSearchText(''); setPendingBills([]); setMatchedOrder(null); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>

                {isLoadingBills ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Loading bills...</p>
                ) : pendingBills.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0', color: '#64748b', fontSize: '14px' }}>✅ No pending bills for this shop</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>{pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''}:</p>
                    {pendingBills.map((bill) => (
                      <div key={bill.id} onClick={() => { setMatchedOrder({ ...bill, shops: selectedDeliveryShop }); setAmountReceived(''); }}
                        style={{ padding: '14px 16px', borderRadius: '8px', cursor: 'pointer', border: matchedOrder?.id === bill.id ? '2px solid #16a34a' : '1px solid #e2e8f0', backgroundColor: matchedOrder?.id === bill.id ? '#f0fdf4' : '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px' }}>{bill.bill_number}</p>
                            <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>Total: ₹{bill.bill_amount}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '16px', color: '#dc2626' }}>₹{bill.pending_amount}</p>
                            <p style={{ margin: '0', fontSize: '11px', color: '#94a3b8' }}>pending</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── RECENT DELIVERIES — RETURN / DAMAGE ── */}
            {selectedDeliveryShop && deliveredBills.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Recent Deliveries:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deliveredBills.map((bill) => (
                    <div key={bill.id}>
                      <div style={{ padding: '12px 14px', borderRadius: '8px', border: returnFormBill?.id === bill.id ? '2px solid #f97316' : '1px solid #e2e8f0', backgroundColor: returnFormBill?.id === bill.id ? '#fff7ed' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '13px' }}>{bill.bill_number}</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>₹{bill.bill_amount} · {new Date(bill.created_at).toLocaleDateString('en-IN')}</p>
                        </div>
                        <button type="button" onClick={() => handleOpenReturnForm(bill)}
                          style={{ padding: '7px 14px', backgroundColor: returnFormBill?.id === bill.id ? '#f1f5f9' : '#fff7ed', color: returnFormBill?.id === bill.id ? '#64748b' : '#c2410c', border: `1px solid ${returnFormBill?.id === bill.id ? '#e2e8f0' : '#fed7aa'}`, borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                          {returnFormBill?.id === bill.id ? '✕ Cancel' : '↩ Return/Damage'}
                        </button>
                      </div>

                      {returnFormBill?.id === bill.id && (
                        <div style={{ padding: '16px', border: '2px solid #f97316', borderRadius: '0 0 8px 8px', backgroundColor: '#fff7ed', marginTop: '-2px' }}>
                          <h4 style={{ margin: '0 0 12px', color: '#c2410c', fontSize: '15px' }}>↩ Record Return / Damage</h4>

                          {/* Type selector */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            {['return', 'damage'].map(t => (
                              <button key={t} type="button" onClick={() => setReturnType(t)}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${returnType === t ? (t === 'return' ? '#16a34a' : '#dc2626') : '#e2e8f0'}`, backgroundColor: returnType === t ? (t === 'return' ? '#f0fdf4' : '#fef2f2') : '#ffffff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', color: returnType === t ? (t === 'return' ? '#15803d' : '#dc2626') : '#475569' }}>
                                {t === 'return' ? '↩ Return' : '⚠️ Damage'}
                              </button>
                            ))}
                          </div>
                          <p style={{ margin: '0 0 12px', fontSize: '12px', color: returnType === 'return' ? '#15803d' : '#dc2626', fontWeight: '500' }}>
                            {returnType === 'return' ? '✅ Stock will be added back to inventory' : '⚠️ Stock will NOT be restored (goods are unusable)'}
                          </p>

                          {/* Items */}
                          <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Select quantities to return:</p>
                          {returnItems.map((item, idx) => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '6px', marginBottom: '6px', border: item.returnQty > 0 ? '1px solid #f97316' : '1px solid #e2e8f0' }}>
                              <div>
                                <p style={{ margin: '0', fontSize: '14px', fontWeight: '500' }}>{item.products?.name}</p>
                                <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>Delivered: {item.quantity} · ₹{item.products?.unit_price} each</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>Qty:</span>
                                <input type="number" min="0" max={item.quantity} value={item.returnQty}
                                  onChange={(e) => {
                                    const val = Math.min(parseInt(e.target.value) || 0, item.quantity);
                                    setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: val } : it));
                                  }}
                                  style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '14px', backgroundColor: '#ffffff', color: '#0f172a' }} />
                              </div>
                            </div>
                          ))}

                          {/* Credit preview */}
                          {returnItems.some(i => i.returnQty > 0) && (
                            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '6px', marginBottom: '12px', border: '1px solid #fed7aa', fontSize: '13px' }}>
                              Credit amount: <strong>₹{returnItems.reduce((sum, item) => sum + parseFloat(item.products?.unit_price || 0) * item.returnQty, 0).toLocaleString('en-IN')}</strong>
                            </div>
                          )}

                          {/* Reason */}
                          <input type="text" placeholder="Reason (e.g. shop rejected, expired, damaged in transit)" value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px', backgroundColor: '#ffffff', color: '#0f172a' }} />

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => { setReturnFormBill(null); setReturnItems([]); }}
                              style={{ flex: 1, padding: '12px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                              Cancel
                            </button>
                            <button type="button" onClick={handleSubmitReturn} disabled={isSubmittingReturn || !returnItems.some(i => i.returnQty > 0)}
                              style={{ flex: 2, padding: '12px', backgroundColor: isSubmittingReturn ? '#94a3b8' : '#f97316', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSubmittingReturn ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                              {isSubmittingReturn ? 'Recording...' : `✅ Record ${returnType === 'return' ? 'Return' : 'Damage'}`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchedOrder && (
              <form onSubmit={handleConfirmDelivery} style={{ padding: '20px', border: '2px solid #16a34a', borderRadius: '10px', backgroundColor: '#f0fdf4', marginTop: '10px' }}>
                <h3 style={{ margin: '0 0 15px', color: '#166534', fontSize: '18px' }}>📦 Collect Payment</h3>
                <div style={{ marginBottom: '15px', fontSize: '15px', color: '#1e293b' }}>
                  <p style={{ margin: '0 0 4px' }}><strong>Bill:</strong> {matchedOrder.bill_number}</p>
                  <p style={{ margin: '0 0 4px' }}><strong>Total:</strong> ₹{matchedOrder.bill_amount}</p>
                  <p style={{ margin: '0' }}><strong>Balance:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '18px' }}>₹{matchedOrder.pending_amount}</span></p>
                </div>
                <hr style={{ border: '0', height: '1px', backgroundColor: '#bbf7d0', marginBottom: '16px' }} />
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Amount Collected (₹)</label>
                  <input type="number" min="1" placeholder="Enter amount" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #16a34a', fontSize: '16px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#0f172a' }} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #16a34a', fontSize: '15px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setMatchedOrder(null)}
                    style={{ flex: 1, padding: '14px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>← Back</button>
                  <button type="submit" disabled={isProcessingDelivery}
                    style={{ flex: 2, padding: '14px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: isProcessingDelivery ? 0.7 : 1 }}>
                    {isProcessingDelivery ? 'Recording...' : '✔ Log Collection'}
                  </button>
                </div>
              </form>
            )}
          </div>

        ) : (
          /* ── LEAVE TAB ── */
          <div>
            {/* Apply Leave Form */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 'bold' }}>🏖️ Apply for Leave</h3>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Your pending deliveries will be automatically reassigned to available agents.</p>

              <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Leave Date</label>
                  <input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)}
                    min={todayStr}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box', color: '#0f172a' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Reason (optional)</label>
                  <input type="text" placeholder="e.g. Personal work, Medical, Family function" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box', color: '#0f172a' }} />
                </div>
                <button type="submit" disabled={isApplyingLeave}
                  style={{ padding: '14px', backgroundColor: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: isApplyingLeave ? 'not-allowed' : 'pointer', opacity: isApplyingLeave ? 0.7 : 1 }}>
                  {isApplyingLeave ? 'Applying...' : '✅ Apply Leave'}
                </button>
                {leaveMessage && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: leaveMessage.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${leaveMessage.includes('✅') ? '#bbf7d0' : '#fecaca'}`, fontSize: '13px', color: leaveMessage.includes('✅') ? '#166534' : '#dc2626', fontWeight: '500' }}>
                    {leaveMessage}
                  </div>
                )}
              </form>
            </div>

            {/* Leave History */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 'bold' }}>Leave History</h3>
              {isLoadingLeaves ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Loading...</p>
              ) : leaveHistory.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No leaves taken yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {leaveHistory.map((leave) => (
                    <div key={leave.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '14px' }}>
                          {new Date(leave.leave_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>{leave.reason}</p>
                      </div>
                      <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                        ✓ Approved
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(AgentPortal, ['agent', 'owner']);