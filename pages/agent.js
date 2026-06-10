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

  // Today's Beat Plan
  const [todaysBeat, setTodaysBeat] = useState([]);

  // Returns & Damage
  const [deliveredBills, setDeliveredBills] = useState([]);
  const [returnFormBill, setReturnFormBill] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnType, setReturnType] = useState('return');
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const [ownerUpiId, setOwnerUpiId] = useState('');
  const [ownerCompanyName, setOwnerCompanyName] = useState('EasyTrack');
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [myTarget, setMyTarget] = useState(null);
  const [myMonthSales, setMyMonthSales] = useState(0);
  const [myMonthCollected, setMyMonthCollected] = useState(0);
  const [periodStats, setPeriodStats] = useState(null);
  const [periodView, setPeriodView] = useState('today');
  const [myDeliveredBills, setMyDeliveredBills] = useState([]);
  const [myReturns, setMyReturns] = useState([]);

  // Attendance
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);

  // Shop statement
  const [shopStatement, setShopStatement] = useState([]);
  const [showShopStatement, setShowShopStatement] = useState(false);

  // Post-payment WhatsApp receipt
  const [lastPayment, setLastPayment] = useState(null);

  // Shop visit check-ins
  const [checkInOutcome, setCheckInOutcome] = useState('visited');
  const [checkInNote, setCheckInNote] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [todayCheckIns, setTodayCheckIns] = useState([]);

  // Expenses
  const [myExpenses, setMyExpenses] = useState([]);
  const [expenseCategory, setExpenseCategory] = useState('Travel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const [toasts, setToasts] = useState([]);
  const addToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const waLink = (phone, message) => {
    if (!phone) return null;
    let n = phone.replace(/[\s\-\(\)\+]/g, '');
    if (n.length === 10) n = '91' + n;
    return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
  };

  const generateFreshBillTag = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setBillNumber(`ET-2026-${timestamp}-${randomSuffix}`);
  };

  async function loadPeriodStats() {
    const agentName = profile?.full_name;
    if (!agentName) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('transactions')
      .select('bill_amount, amount_received, delivered_at')
      .eq('employee_name', agentName)
      .eq('status', 'delivered')
      .gte('delivered_at', weekStart.toISOString());
    const sum = (txns) => ({
      bills: txns.length,
      sales: txns.reduce((s, t) => s + parseFloat(t.bill_amount || 0), 0),
      collected: txns.reduce((s, t) => s + parseFloat(t.amount_received || 0), 0),
    });
    const todayTxns = (data || []).filter(t => t.delivered_at && new Date(t.delivered_at) >= todayStart);
    setPeriodStats({ today: sum(todayTxns), week: sum(data || []) });
  }

  async function loadMyTarget() {
    const agentName = profile?.full_name;
    if (!agentName) return;
    const month = new Date().toISOString().slice(0, 7);
    const { data: tgt } = await supabase.from('agent_targets')
      .select('sales_target, collection_target')
      .eq('agent_name', agentName)
      .eq('month', month)
      .maybeSingle();
    setMyTarget(tgt || null);
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: txns } = await supabase.from('transactions')
      .select('bill_amount, amount_received')
      .eq('employee_name', agentName)
      .gte('created_at', firstOfMonth)
      .in('status', ['approved', 'delivered']);
    const sales = (txns || []).reduce((s, t) => s + parseFloat(t.bill_amount || 0), 0);
    const collected = (txns || []).reduce((s, t) => s + parseFloat(t.amount_received || 0), 0);
    setMyMonthSales(sales);
    setMyMonthCollected(collected);
  }

  async function loadTodayAttendance() {
    const agentName = profile?.full_name;
    if (!agentName) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('attendance')
      .select('*').eq('agent_name', agentName).eq('date', today).maybeSingle();
    setTodayAttendance(data || null);
  }

  async function handleMarkPresent() {
    const agentName = profile?.full_name || selectedEmployee;
    if (!agentName) return;
    setIsMarkingAttendance(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('attendance')
      .upsert([{ agent_name: agentName, date: today }], { onConflict: 'agent_name,date' })
      .select().single();
    setIsMarkingAttendance(false);
    if (error) return alert('Failed: ' + error.message);
    setTodayAttendance(data);
    addToast('✅ Attendance marked — Present today!');
  }

  async function loadTodayCheckIns() {
    const agentName = profile?.full_name;
    if (!agentName) return;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('shop_visits')
      .select('id, shop_id, shop_name, visited_at, outcome, note')
      .eq('agent_name', agentName)
      .gte('visited_at', todayStart.toISOString())
      .order('visited_at', { ascending: false });
    if (data) setTodayCheckIns(data);
  }

  const handleCheckIn = () => {
    if (!selectedDeliveryShop) return;
    setIsCheckingIn(true);
    const doInsert = async (lat, lng) => {
      const { error } = await supabase.from('shop_visits').insert([{
        agent_name: profile?.full_name || selectedEmployee,
        shop_id: selectedDeliveryShop.id,
        shop_name: selectedDeliveryShop.name,
        outcome: checkInOutcome,
        note: checkInNote.trim() || null,
        latitude: lat || null,
        longitude: lng || null,
      }]);
      setIsCheckingIn(false);
      if (error) return alert('Check-in failed: ' + error.message);
      addToast(`📍 Checked in at ${selectedDeliveryShop.name}`);
      setCheckInNote('');
      setCheckInOutcome('visited');
      loadTodayCheckIns();
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => doInsert(pos.coords.latitude, pos.coords.longitude),
        () => doInsert(null, null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      doInsert(null, null);
    }
  };

  async function loadMyExpenses() {
    const agentName = profile?.full_name;
    if (!agentName) return;
    const { data } = await supabase.from('agent_expenses')
      .select('*')
      .eq('agent_name', agentName)
      .order('expense_date', { ascending: false });
    if (data) setMyExpenses(data);
  }

  async function handleSubmitExpense(e) {
    e.preventDefault();
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid amount.');
    if (!expenseDate) return alert('Select an expense date.');
    setIsSubmittingExpense(true);
    const { error } = await supabase.from('agent_expenses').insert([{
      agent_name: profile?.full_name || selectedEmployee,
      category: expenseCategory,
      amount: amt,
      note: expenseNote.trim() || null,
      expense_date: expenseDate,
      status: 'pending',
    }]);
    setIsSubmittingExpense(false);
    if (error) return alert('Failed to submit: ' + error.message);
    addToast(`✅ Expense submitted — ₹${amt.toLocaleString('en-IN')} (${expenseCategory})`);
    setExpenseAmount('');
    setExpenseNote('');
    setExpenseDate('');
    setExpenseCategory('Travel');
    loadMyExpenses();
  }

  async function loadMyReturnData() {
    const agentName = profile?.full_name;
    if (!agentName) return;
    const [{ data: rets }, { data: bills }] = await Promise.all([
      supabase.from('returns')
        .select('id, return_type, reason, total_credit, created_at, transaction_id, transactions(bill_number, shops(name)), return_items(product_name, quantity, unit_price)')
        .eq('agent_name', agentName)
        .order('created_at', { ascending: false }),
      supabase.from('transactions')
        .select('id, bill_number, bill_amount, shop_id, created_at, shops(name)')
        .eq('employee_name', agentName)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    if (rets) setMyReturns(rets);
    if (bills) {
      const returnedIds = new Set((rets || []).map(r => r.transaction_id).filter(Boolean));
      setMyDeliveredBills(bills.filter(b => !returnedIds.has(b.id)));
    }
  }

  async function loadInitialData() {
    const { data: empData } = await supabase.from('employees').select('name');
    if (empData) setEmployees(empData);
    const { data: shopData } = await supabase.from('shops').select('id, name, latitude, longitude, phone_number');
    if (shopData) setShops(shopData);
    const { data: prodData } = await supabase.from('products').select('id, name, unit_price').eq('is_active', true);
    if (prodData) setProductCatalog(prodData);
    try {
      const res = await fetch('/api/settings/public');
      if (res.ok) {
        const settings = await res.json();
        if (settings.upi_id) setOwnerUpiId(settings.upi_id);
        if (settings.company_name) setOwnerCompanyName(settings.company_name);
      }
    } catch (_) {}
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
    loadMyTarget();
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'leave' && profile?.id) loadLeaveHistory();
    if (activeTab === 'delivery') { loadTodaysBeat(); loadPeriodStats(); loadTodayCheckIns(); loadTodayAttendance(); }
    if (activeTab === 'returns') loadMyReturnData();
    if (activeTab === 'expenses') loadMyExpenses();
  }, [activeTab, profile, selectedEmployee]);

  async function loadTodaysBeat() {
    const dayOfWeek = new Date().getDay();
    const agentName = profile?.full_name || selectedEmployee;
    if (!agentName) return;
    const { data } = await supabase
      .from('beat_plans')
      .select('id, shops(id, name, address, phone_number, latitude, longitude)')
      .eq('day_of_week', dayOfWeek)
      .eq('employee_name', agentName);
    if (data) setTodaysBeat(data.map(b => b.shops).filter(Boolean));
  }

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
    setShopStatement([]);
    setShowShopStatement(false);
    setLastPayment(null);
    setIsLoadingBills(true);

    const [pendingRes, deliveredRes, stmtRes] = await Promise.all([
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
        .limit(10),
      supabase
        .from('transactions')
        .select('id, bill_number, bill_amount, amount_received, pending_amount, status, created_at')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (!pendingRes.error && pendingRes.data) setPendingBills(pendingRes.data);
    if (!stmtRes.error && stmtRes.data) setShopStatement(stmtRes.data);

    const deliveredData = deliveredRes.error ? [] : (deliveredRes.data || []);
    if (deliveredData.length > 0) {
      const txIds = deliveredData.map(b => b.id);
      const { data: existingReturns } = await supabase
        .from('returns')
        .select('transaction_id')
        .in('transaction_id', txIds);
      const returnedSet = new Set((existingReturns || []).map(r => r.transaction_id));
      setDeliveredBills(deliveredData.filter(b => !returnedSet.has(b.id)));
    } else {
      setDeliveredBills([]);
    }
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
          shop_id: selectedDeliveryShop?.id || returnFormBill?.shop_id,
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
      // Broadcast to dashboard in real-time
      try {
        const notifyChannel = supabase.channel('easytrack-live');
        notifyChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            notifyChannel.send({
              type: 'broadcast',
              event: 'return_recorded',
              payload: {
                return_type: returnType,
                agent_name: selectedEmployee || profile?.full_name || '',
                total_credit: totalCredit,
                reason: returnReason.trim() || null,
              }
            }).then(() => setTimeout(() => supabase.removeChannel(notifyChannel), 2000));
          }
        });
      } catch (_) {}
      // Restore stock only for returns (not damage — goods are unusable)
      if (returnType === 'return') {
        for (const item of toReturn) {
          const { data: prod } = await supabase.from('products').select('inventory_stock').eq('id', item.product_id).single();
          await supabase.from('products').update({
            inventory_stock: (prod?.inventory_stock || 0) + item.returnQty
          }).eq('id', item.product_id);
        }
      }
      addToast(`✅ ${returnType === 'return' ? 'Return' : 'Damage'} recorded — Credit: ₹${totalCredit.toLocaleString('en-IN')}`);
      setDeliveredBills(prev => prev.filter(b => b.id !== returnFormBill.id));
      setMyDeliveredBills(prev => prev.filter(b => b.id !== returnFormBill.id));
      setReturnFormBill(null);
      setReturnItems([]);
      loadMyReturnData();
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
      addToast(`✅ Collected ₹${newCashInput.toLocaleString('en-IN')} — Remaining: ₹${finalRemainingPending.toLocaleString('en-IN')}`);
      setLastPayment({
        billNumber: matchedOrder.bill_number,
        collected: newCashInput,
        remaining: finalRemainingPending,
        total: parseFloat(matchedOrder.bill_amount),
        shopPhone: selectedDeliveryShop?.phone_number,
      });
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
      if (creditFetchErr) throw new Error('Could not verify credit limit: ' + creditFetchErr.message);
      const creditLimit = parseFloat(shopCredit?.credit_limit ?? 0);
      if (creditLimit > 0) {
        const { data: openTx, error: txFetchErr } = await supabase
          .from('transactions')
          .select('bill_amount')
          .eq('shop_id', targetShopId)
          .neq('status', 'delivered');
        const creditUsed = (openTx || []).reduce((s, tx) => s + parseFloat(tx.bill_amount || 0), 0);
        const available = Math.max(0, creditLimit - creditUsed);
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
      addToast(`✅ Order ${billNumber} submitted!`);
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
    flex: 1, padding: '10px 6px', border: 'none', borderRadius: '6px',
    fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
    backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
    color: activeTab === tab ? '#2563eb' : '#475569',
    lineHeight: '1.3', textAlign: 'center'
  });

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: '20px 20px calc(74px + env(safe-area-inset-bottom))', color: '#0f172a' }}>
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
          <button type="button" onClick={() => setActiveTab('returns')} style={tabStyle('returns')}>↩ Returns</button>
          <button type="button" onClick={() => setActiveTab('expenses')} style={tabStyle('expenses')}>💰 Expenses</button>
          <button type="button" onClick={() => setActiveTab('leave')} style={tabStyle('leave')}>🏖️ Leave</button>
        </div>

        {/* ── PHASE 1: BOOK ORDER ── */}
        {activeTab === 'booking' ? (
          <form onSubmit={handleSubmitOrder}>
            {myTarget && (() => {
              const salesPct = myTarget.sales_target > 0 ? Math.min(100, Math.round(myMonthSales / myTarget.sales_target * 100)) : 0;
              const collPct = myTarget.collection_target > 0 ? Math.min(100, Math.round(myMonthCollected / myTarget.collection_target * 100)) : 0;
              return (
                <div style={{ marginBottom: '20px', backgroundColor: '#eff6ff', borderRadius: '8px', padding: '14px', border: '1px solid #bfdbfe' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 'bold', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🎯 {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} Targets
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {myTarget.sales_target > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                          <span style={{ color: '#475569' }}>Sales · ₹{myMonthSales.toLocaleString('en-IN')} / ₹{Number(myTarget.sales_target).toLocaleString('en-IN')}</span>
                          <span style={{ fontWeight: 'bold', color: salesPct >= 100 ? '#16a34a' : '#1e40af' }}>{salesPct}%</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#dbeafe', borderRadius: '3px' }}>
                          <div style={{ height: '100%', width: `${salesPct}%`, backgroundColor: salesPct >= 100 ? '#16a34a' : '#2563eb', borderRadius: '3px' }} />
                        </div>
                      </div>
                    )}
                    {myTarget.collection_target > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                          <span style={{ color: '#475569' }}>Collection · ₹{myMonthCollected.toLocaleString('en-IN')} / ₹{Number(myTarget.collection_target).toLocaleString('en-IN')}</span>
                          <span style={{ fontWeight: 'bold', color: collPct >= 100 ? '#16a34a' : '#1e40af' }}>{collPct}%</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#dbeafe', borderRadius: '3px' }}>
                          <div style={{ height: '100%', width: `${collPct}%`, backgroundColor: collPct >= 100 ? '#16a34a' : '#2563eb', borderRadius: '3px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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

            {/* ── ATTENDANCE BANNER ── */}
            {todayAttendance ? (
              <div style={{ marginBottom: '14px', padding: '10px 16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#15803d' }}>Present today</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Marked at {new Date(todayAttendance.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '14px', padding: '14px 16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '22px' }}>🟢</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e40af' }}>Start your day</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#3b82f6' }}>Tap to mark yourself present</p>
                </div>
                <button type="button" onClick={handleMarkPresent} disabled={isMarkingAttendance}
                  style={{ padding: '10px 18px', backgroundColor: isMarkingAttendance ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: isMarkingAttendance ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {isMarkingAttendance ? '...' : '✅ Mark Present'}
                </button>
              </div>
            )}

            {/* ── PERFORMANCE SUMMARY ── */}
            {periodStats && (() => {
              const stats = periodView === 'today' ? periodStats.today : periodStats.week;
              const eff = stats.sales > 0 ? Math.round((stats.collected / stats.sales) * 100) : 0;
              const fmt = (v) => v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toString();
              return (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>📊 My Performance</span>
                    <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                      <button type="button" onClick={() => setPeriodView('today')} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: periodView === 'today' ? '#0f172a' : '#f8fafc', color: periodView === 'today' ? '#ffffff' : '#475569' }}>Today</button>
                      <button type="button" onClick={() => setPeriodView('week')} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: periodView === 'week' ? '#0f172a' : '#f8fafc', color: periodView === 'week' ? '#ffffff' : '#475569', borderLeft: '1px solid #e2e8f0' }}>This Week</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div style={{ backgroundColor: '#eff6ff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Bills</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#2563eb' }}>{stats.bills}</p>
                    </div>
                    <div style={{ backgroundColor: '#eff6ff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Sales</p>
                      <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>₹{fmt(stats.sales)}</p>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Collected</p>
                      <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>₹{fmt(stats.collected)}</p>
                    </div>
                    <div style={{ backgroundColor: eff >= 80 ? '#f0fdf4' : '#fefce8', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Efficiency</p>
                      <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: eff >= 80 ? '#16a34a' : '#d97706' }}>{eff}%</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── TODAY'S CHECK-INS STRIP ── */}
            {todayCheckIns.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 'bold', color: '#15803d' }}>📍 Today's Check-ins ({todayCheckIns.length})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {todayCheckIns.map(c => (
                    <span key={c.id} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', backgroundColor: c.outcome === 'visited' ? '#dcfce7' : c.outcome === 'closed' ? '#fee2e2' : '#fef9c3', color: c.outcome === 'visited' ? '#15803d' : c.outcome === 'closed' ? '#dc2626' : '#854d0e', fontWeight: '500' }}>
                      {c.outcome === 'visited' ? '✅' : c.outcome === 'closed' ? '🔒' : '🚫'} {c.shop_name} · {new Date(c.visited_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── TODAY'S BEAT ── */}
            {todaysBeat.length > 0 && (
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 'bold', fontSize: '14px', color: '#15803d' }}>
                  📅 Today's Beat — {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]} ({todaysBeat.length} shop{todaysBeat.length > 1 ? 's' : ''})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todaysBeat.map(shop => (
                    <div key={shop.id} style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '10px 14px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{shop.name}</p>
                        {shop.address && <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#64748b' }}>{shop.address}</p>}
                        {shop.phone_number && <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>📞 {shop.phone_number}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginLeft: '10px', flexShrink: 0 }}>
                        {shop.phone_number && (() => { const link = waLink(shop.phone_number, `Hi, we'll be visiting your shop today. – ${ownerCompanyName}`); return link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 10px', backgroundColor: '#25d366', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>📱</a> : null; })()}
                        {shop.latitude && shop.longitude
                          ? <a href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} target="_blank" rel="noopener noreferrer"
                              style={{ padding: '6px 12px', backgroundColor: '#16a34a', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>📍 Maps</a>
                          : <span style={{ fontSize: '12px', color: '#94a3b8' }}>No GPS</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <button onClick={() => { setSelectedDeliveryShop(null); setShopSearchText(''); setPendingBills([]); setMatchedOrder(null); setShopStatement([]); setShowShopStatement(false); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>

                {/* ── CHECK-IN CARD ── */}
                {(() => {
                  const existing = todayCheckIns.find(c => c.shop_id === selectedDeliveryShop.id);
                  if (existing) {
                    return (
                      <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>📍</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0', fontSize: '13px', fontWeight: 'bold', color: '#15803d' }}>Checked in today</p>
                          <p style={{ margin: '0', fontSize: '11px', color: '#64748b' }}>{existing.outcome} · {new Date(existing.visited_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{existing.note ? ` · ${existing.note}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => { setCheckInOutcome('visited'); setCheckInNote(''); setTodayCheckIns(prev => prev.filter(c => c.id !== existing.id)); }}
                          style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#ffffff', color: '#64748b', cursor: 'pointer' }}>Update</button>
                      </div>
                    );
                  }
                  return (
                    <div style={{ marginBottom: '12px', padding: '14px', backgroundColor: '#fafafa', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>📍 Check In at this shop</p>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {[['visited','✅ Visited','#16a34a','#f0fdf4','#bbf7d0'],['no_answer','🚫 No Answer','#d97706','#fefce8','#fde68a'],['closed','🔒 Closed','#dc2626','#fef2f2','#fecaca']].map(([val,label,col,bg,border]) => (
                          <button key={val} type="button" onClick={() => setCheckInOutcome(val)}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: '6px', border: `2px solid ${checkInOutcome === val ? col : '#e2e8f0'}`, backgroundColor: checkInOutcome === val ? bg : '#ffffff', color: checkInOutcome === val ? col : '#64748b', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" placeholder="Note (optional)" value={checkInNote} onChange={e => setCheckInNote(e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#0f172a' }} />
                        <button type="button" onClick={handleCheckIn} disabled={isCheckingIn}
                          style={{ padding: '8px 16px', backgroundColor: isCheckingIn ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: isCheckingIn ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                          {isCheckingIn ? '...' : '📍 Check In'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── SHOP STATEMENT ── */}
                {shopStatement.length > 0 && (() => {
                  const totalOutstanding = shopStatement.reduce((s, t) => {
                    if (t.status === 'delivered') return s + parseFloat(t.pending_amount || 0);
                    if (t.status === 'approved' || t.status === 'draft') return s + parseFloat(t.bill_amount || 0);
                    return s;
                  }, 0);
                  return (
                    <div style={{ marginBottom: '12px' }}>
                      <button type="button" onClick={() => setShowShopStatement(v => !v)}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: totalOutstanding > 0 ? '#fef9c3' : '#f0fdf4', border: `1px solid ${totalOutstanding > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: showShopStatement ? '8px 8px 0 0' : '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                        <span>📊 Shop Statement ({shopStatement.length} bills)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {totalOutstanding > 0 && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>₹{totalOutstanding.toLocaleString('en-IN')} due</span>}
                          <span style={{ color: '#94a3b8' }}>{showShopStatement ? '▲' : '▼'}</span>
                        </span>
                      </button>
                      {showShopStatement && (
                        <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                          {totalOutstanding > 0 && (
                            <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 'bold' }}>Total Outstanding</span>
                              <span style={{ fontSize: '16px', color: '#dc2626', fontWeight: 'bold' }}>₹{totalOutstanding.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {shopStatement.map((t, i) => {
                            const isSettled = t.status === 'delivered' && parseFloat(t.pending_amount || 0) === 0;
                            const isPending = t.status === 'approved' || t.status === 'draft';
                            const balance = isPending ? parseFloat(t.bill_amount) : parseFloat(t.pending_amount || 0);
                            return (
                              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', gap: '8px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '13px' }}>{t.bill_number}</p>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ₹{parseFloat(t.bill_amount).toLocaleString('en-IN')}</p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  {isPending ? (
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706', backgroundColor: '#fef9c3', padding: '2px 8px', borderRadius: '10px' }}>⏳ Pending</span>
                                  ) : isSettled ? (
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>✅ Settled</span>
                                  ) : (
                                    <div>
                                      <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>₹{balance.toLocaleString('en-IN')} due</p>
                                      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>of ₹{parseFloat(t.bill_amount).toLocaleString('en-IN')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {isLoadingBills ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Loading bills...</p>
                ) : pendingBills.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0', color: '#64748b', fontSize: '14px' }}>✅ No pending bills for this shop</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>{pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''}:</p>
                    {pendingBills.map((bill) => {
                      const isCredit = bill.status === 'delivered';
                      const isSelected = matchedOrder?.id === bill.id;
                      return (
                        <div key={bill.id} onClick={() => { setMatchedOrder({ ...bill, shops: selectedDeliveryShop }); setAmountReceived(''); }}
                          style={{ padding: '14px 16px', borderRadius: '8px', cursor: 'pointer', border: isSelected ? '2px solid #16a34a' : isCredit ? '1px solid #fca5a5' : '1px solid #e2e8f0', backgroundColor: isSelected ? '#f0fdf4' : isCredit ? '#fff5f5' : '#ffffff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{bill.bill_number}</p>
                                {isCredit && (
                                  <span style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', letterSpacing: '0.3px' }}>CREDIT</span>
                                )}
                              </div>
                              <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>
                                Total: ₹{parseFloat(bill.bill_amount).toLocaleString('en-IN')}
                                {isCredit && parseFloat(bill.amount_received || 0) > 0 && ` · Paid: ₹${parseFloat(bill.amount_received).toLocaleString('en-IN')}`}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ margin: '0', fontWeight: 'bold', fontSize: '16px', color: '#dc2626' }}>₹{parseFloat(bill.pending_amount).toLocaleString('en-IN')}</p>
                              <p style={{ margin: '0', fontSize: '11px', color: '#94a3b8' }}>{isCredit ? 'balance due' : 'pending'}</p>
                              {isCredit && (() => {
                                const link = waLink(selectedDeliveryShop?.phone_number, `Hi, this is a reminder for your outstanding balance of ₹${parseFloat(bill.pending_amount).toLocaleString('en-IN')} on bill ${bill.bill_number} (Total: ₹${parseFloat(bill.bill_amount).toLocaleString('en-IN')}). Please arrange payment. – ${ownerCompanyName}`);
                                return link ? (
                                  <a href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                    style={{ display: 'inline-block', marginTop: '4px', fontSize: '11px', color: '#25d366', fontWeight: 'bold', textDecoration: 'none' }}>
                                    📱 Remind
                                  </a>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                <h3 style={{ margin: '0 0 12px', color: '#166534', fontSize: '18px' }}>
                  {matchedOrder.status === 'delivered' ? '💰 Collect Balance' : '📦 Collect Payment'}
                </h3>
                {matchedOrder.status === 'delivered' && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', marginBottom: '14px', fontSize: '12px', color: '#b91c1c', fontWeight: '500' }}>
                    ⚠️ Outstanding credit balance from a previous delivery
                  </div>
                )}
                <div style={{ marginBottom: '15px', fontSize: '15px', color: '#1e293b' }}>
                  <p style={{ margin: '0 0 4px' }}><strong>Bill:</strong> {matchedOrder.bill_number}</p>
                  <p style={{ margin: '0 0 4px' }}><strong>Total:</strong> ₹{parseFloat(matchedOrder.bill_amount).toLocaleString('en-IN')}</p>
                  {matchedOrder.status === 'delivered' && parseFloat(matchedOrder.amount_received || 0) > 0 && (
                    <p style={{ margin: '0 0 4px', color: '#16a34a' }}><strong>Collected so far:</strong> ₹{parseFloat(matchedOrder.amount_received).toLocaleString('en-IN')}</p>
                  )}
                  <p style={{ margin: '0' }}><strong>Balance:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '18px' }}>₹{parseFloat(matchedOrder.pending_amount).toLocaleString('en-IN')}</span></p>
                </div>
                <hr style={{ border: '0', height: '1px', backgroundColor: '#bbf7d0', marginBottom: '16px' }} />
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Amount Collected (₹)</label>
                  <input type="number" min="1" placeholder="Enter amount" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #16a34a', fontSize: '16px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#0f172a' }} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => { setPaymentMode(e.target.value); setShowUpiQr(false); }}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #16a34a', fontSize: '15px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                  {paymentMode === 'UPI' && ownerUpiId && parseFloat(amountReceived) > 0 && (
                    <button type="button" onClick={() => setShowUpiQr(true)}
                      style={{ width: '100%', marginTop: '10px', padding: '14px', backgroundColor: '#6d28d9', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', letterSpacing: '0.3px' }}>
                      📲 Show QR Code — ₹{parseFloat(amountReceived).toLocaleString('en-IN')}
                    </button>
                  )}
                  {paymentMode === 'UPI' && !ownerUpiId && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#f59e0b', fontWeight: '500' }}>⚠️ UPI ID not set — ask your owner to add it in Invoice Settings.</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setMatchedOrder(null)}
                    style={{ flex: 1, padding: '14px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>← Back</button>
                  <button type="submit" disabled={isProcessingDelivery}
                    style={{ flex: 2, padding: '14px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: isProcessingDelivery ? 0.7 : 1 }}>
                    {isProcessingDelivery ? 'Recording...' : matchedOrder.status === 'delivered' ? '✔ Record Collection' : '✔ Log Collection'}
                  </button>
                </div>
              </form>
            )}

            {/* ── WHATSAPP RECEIPT ── */}
            {lastPayment && (() => {
              const isFullyPaid = lastPayment.remaining <= 0;
              const msg = isFullyPaid
                ? `Hi, bill ${lastPayment.billNumber} of ₹${lastPayment.total.toLocaleString('en-IN')} is fully settled. Thank you for your payment! – ${ownerCompanyName}`
                : `Hi, received ₹${lastPayment.collected.toLocaleString('en-IN')} against bill ${lastPayment.billNumber}. Outstanding balance: ₹${lastPayment.remaining.toLocaleString('en-IN')}. Thank you! – ${ownerCompanyName}`;
              const link = waLink(lastPayment.shopPhone, msg);
              return (
                <div style={{ marginTop: '10px', padding: '14px 16px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '13px', color: '#15803d' }}>✅ Payment recorded</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{isFullyPaid ? 'Bill fully settled' : `₹${lastPayment.remaining.toLocaleString('en-IN')} still outstanding`}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', padding: '10px 16px', backgroundColor: '#25d366', color: '#ffffff', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textDecoration: 'none' }}>
                        📱 Send Receipt
                      </a>
                    )}
                    <button type="button" onClick={() => setLastPayment(null)}
                      style={{ padding: '10px 14px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              );
            })()}
          </div>

        ) : activeTab === 'returns' ? (
          /* ── RETURNS TAB ── */
          <div>
            {/* New Return Form */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 'bold' }}>↩ Record Return / Damage</h3>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Select a delivered bill to record a return or damage report.</p>
              {myDeliveredBills.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No recent deliveries available for return.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myDeliveredBills.map(bill => (
                    <div key={bill.id}>
                      <div style={{ padding: '12px 14px', borderRadius: '8px', border: returnFormBill?.id === bill.id ? '2px solid #f97316' : '1px solid #e2e8f0', backgroundColor: returnFormBill?.id === bill.id ? '#fff7ed' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '13px' }}>{bill.bill_number}</p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bill.shops?.name} · ₹{parseFloat(bill.bill_amount).toLocaleString('en-IN')} · {new Date(bill.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <button type="button" onClick={() => handleOpenReturnForm(bill)}
                          style={{ flexShrink: 0, padding: '7px 14px', backgroundColor: returnFormBill?.id === bill.id ? '#f1f5f9' : '#fff7ed', color: returnFormBill?.id === bill.id ? '#64748b' : '#c2410c', border: `1px solid ${returnFormBill?.id === bill.id ? '#e2e8f0' : '#fed7aa'}`, borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                          {returnFormBill?.id === bill.id ? '✕ Cancel' : '↩ Return / Damage'}
                        </button>
                      </div>
                      {returnFormBill?.id === bill.id && (
                        <div style={{ padding: '16px', border: '2px solid #f97316', borderRadius: '0 0 8px 8px', backgroundColor: '#fff7ed', marginTop: '-2px' }}>
                          <h4 style={{ margin: '0 0 12px', color: '#c2410c', fontSize: '15px' }}>↩ Record Return / Damage</h4>
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
                                  onChange={(e) => { const val = Math.min(parseInt(e.target.value) || 0, item.quantity); setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: val } : it)); }}
                                  style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '14px', backgroundColor: '#ffffff', color: '#0f172a' }} />
                              </div>
                            </div>
                          ))}
                          {returnItems.some(i => i.returnQty > 0) && (
                            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '6px', marginBottom: '12px', border: '1px solid #fed7aa', fontSize: '13px' }}>
                              Credit amount: <strong>₹{returnItems.reduce((sum, item) => sum + parseFloat(item.products?.unit_price || 0) * item.returnQty, 0).toLocaleString('en-IN')}</strong>
                            </div>
                          )}
                          <input type="text" placeholder="Reason (e.g. shop rejected, expired, damaged in transit)" value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px', backgroundColor: '#ffffff', color: '#0f172a' }} />
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => { setReturnFormBill(null); setReturnItems([]); }}
                              style={{ flex: 1, padding: '12px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
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
              )}
            </div>

            {/* My Returns History */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 'bold' }}>📋 My Returns History</h3>
              {myReturns.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No returns or damages recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myReturns.map(r => (
                    <div key={r.id} style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{r.transactions?.bill_number || '—'}</span>
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>{r.transactions?.shops?.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: r.return_type === 'return' ? '#dbeafe' : '#fee2e2', color: r.return_type === 'return' ? '#1d4ed8' : '#dc2626' }}>
                            {r.return_type === 'return' ? '↩ Return' : '⚠️ Damage'}
                          </span>
                          <span style={{ fontWeight: 'bold', color: r.return_type === 'return' ? '#2563eb' : '#dc2626', fontSize: '13px' }}>₹{parseFloat(r.total_credit || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      {(r.return_items || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                          {r.return_items.map((item, i) => (
                            <span key={i} style={{ fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px' }}>
                              {item.product_name} ×{item.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                        <span>{r.reason || '—'}</span>
                        <span>{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        ) : activeTab === 'expenses' ? (
          /* ── EXPENSES TAB ── */
          <div>
            {/* Submit Expense */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 'bold' }}>💰 Log an Expense</h3>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Submit field expenses for owner approval.</p>
              <form onSubmit={handleSubmitExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Category</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {['Travel', 'Food', 'Phone', 'Accommodation', 'Entertainment', 'Other'].map(cat => (
                      <button key={cat} type="button" onClick={() => setExpenseCategory(cat)}
                        style={{ padding: '10px 6px', borderRadius: '8px', border: `2px solid ${expenseCategory === cat ? '#2563eb' : '#e2e8f0'}`, backgroundColor: expenseCategory === cat ? '#eff6ff' : '#f8fafc', color: expenseCategory === cat ? '#2563eb' : '#475569', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                        {cat === 'Travel' ? '🚗' : cat === 'Food' ? '🍱' : cat === 'Phone' ? '📱' : cat === 'Accommodation' ? '🏨' : cat === 'Entertainment' ? '🎉' : '📦'} {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Amount (₹)</label>
                    <input type="number" min="1" step="0.01" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box', color: '#0f172a' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Date</label>
                    <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box', color: '#0f172a' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Note (optional)</label>
                  <input type="text" placeholder="e.g. Petrol for route, Client lunch" value={expenseNote} onChange={e => setExpenseNote(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', boxSizing: 'border-box', color: '#0f172a' }} />
                </div>
                <button type="submit" disabled={isSubmittingExpense}
                  style={{ padding: '14px', backgroundColor: isSubmittingExpense ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: isSubmittingExpense ? 'not-allowed' : 'pointer' }}>
                  {isSubmittingExpense ? 'Submitting...' : '✅ Submit Expense'}
                </button>
              </form>
            </div>

            {/* My Expense History */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 'bold' }}>📋 My Expense History</h3>
              {myExpenses.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No expenses submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myExpenses.map(exp => {
                    const isPending = exp.status === 'pending';
                    const isApproved = exp.status === 'approved';
                    return (
                      <div key={exp.id} style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: `1px solid ${isApproved ? '#bbf7d0' : isPending ? '#e2e8f0' : '#fecaca'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>₹{parseFloat(exp.amount).toLocaleString('en-IN')}</span>
                              <span style={{ fontSize: '12px', backgroundColor: '#f1f5f9', color: '#475569', padding: '1px 8px', borderRadius: '10px' }}>{exp.category}</span>
                            </div>
                            {exp.note && <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>{exp.note}</p>}
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#94a3b8' }}>{new Date(exp.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: isApproved ? '#dcfce7' : isPending ? '#fef9c3' : '#fee2e2', color: isApproved ? '#16a34a' : isPending ? '#ca8a04' : '#dc2626' }}>
                            {isApproved ? '✓ Approved' : isPending ? '⏳ Pending' : '✕ Rejected'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

      {/* UPI QR Modal */}
      {showUpiQr && ownerUpiId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '340px', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scan to Pay</p>
              <p style={{ margin: '0', fontSize: '22px', fontWeight: 'bold', color: '#6d28d9' }}>₹{parseFloat(amountReceived).toLocaleString('en-IN')}</p>
              {matchedOrder && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{matchedOrder.bill_number}</p>}
            </div>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', display: 'inline-block', marginBottom: '16px' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`upi://pay?pa=${ownerUpiId}&pn=${encodeURIComponent(ownerCompanyName)}&am=${parseFloat(amountReceived).toFixed(2)}&cu=INR&tn=${matchedOrder?.bill_number || 'Payment'}`)}`}
                alt="UPI QR Code"
                width={220}
                height={220}
                style={{ display: 'block', borderRadius: '4px' }}
              />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#475569' }}>UPI ID: <strong style={{ color: '#0f172a' }}>{ownerUpiId}</strong></p>
            <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#94a3b8' }}>Works with GPay, PhonePe, Paytm, BHIM</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setShowUpiQr(false)}
                style={{ flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                ← Back
              </button>
              <button type="button" onClick={() => { setShowUpiQr(false); }}
                style={{ flex: 2, padding: '12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                ✓ Payment Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 200, width: 'calc(100% - 32px)', maxWidth: '468px' }}>
          {toasts.map(t => (
            <div key={t.id} style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', padding: '0 0 0 12px', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTop: '2px solid #f1f5f9', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { tab: 'booking',  icon: '📝', label: 'Book Order' },
          { tab: 'delivery', icon: '📦', label: 'Deliver'    },
          { tab: 'returns',  icon: '↩',  label: 'Returns'    },
          { tab: 'expenses', icon: '💰', label: 'Expenses'   },
          { tab: 'leave',    icon: '🏖️', label: 'Leave'      },
        ].map(({ tab, icon, label }) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', color: activeTab === tab ? '#2563eb' : '#94a3b8', borderTop: `2px solid ${activeTab === tab ? '#2563eb' : 'transparent'}`, marginTop: '-2px' }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default withAuth(AgentPortal, ['agent', 'owner']);