import { useState, useEffect } from 'react';
import { useAuth, withAuth } from '../hooks/useAuth';

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

  // Phase 2 — new shop-based search
  const [shopSearchText, setShopSearchText] = useState('');
  const [shopSearchResults, setShopSearchResults] = useState([]);
  const [selectedDeliveryShop, setSelectedDeliveryShop] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);
  const [isLoadingBills, setIsLoadingBills] = useState(false);

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
    const { data: prodData } = await supabase.from('products').select('id, name, unit_price');
    if (prodData) setProductCatalog(prodData);
  }

  useEffect(() => {
    generateFreshBillTag();
    loadInitialData();
    if (profile?.role === 'agent' && profile?.full_name) {
      setSelectedEmployee(profile.full_name);
    }
  }, [profile]);

  // Filter shops as user types
  useEffect(() => {
    if (!shopSearchText.trim()) {
      setShopSearchResults([]);
      return;
    }
    const filtered = shops.filter(s =>
      s.name.toLowerCase().includes(shopSearchText.toLowerCase())
    );
    setShopSearchResults(filtered.slice(0, 8));
  }, [shopSearchText, shops]);

  const handleDeliveryShopSelect = async (shop) => {
    setSelectedDeliveryShop(shop);
    setShopSearchText(shop.name);
    setShopSearchResults([]);
    setMatchedOrder(null);
    setAmountReceived('');
    setPendingBills([]);
    setIsLoadingBills(true);

    // Load all pending/approved bills for this shop
    const { data, error } = await supabase
      .from('transactions')
      .select('id, bill_number, bill_amount, amount_received, pending_amount, status')
      .eq('shop_id', shop.id)
      .in('status', ['approved', 'delivered'])
      .gt('pending_amount', 0)
      .order('created_at', { ascending: false });

    if (!error && data) setPendingBills(data);
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
    if (!navigator.geolocation) {
      setShopGpsStatus('GPS not supported on this device.');
      setIsCapturingShopGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const { error } = await supabase.from('shops').update({ latitude: lat, longitude: lng }).eq('id', selectedShopData.id);
        if (error) {
          setShopGpsStatus('❌ Failed to save location.');
        } else {
          setShopGpsStatus(`✅ Location saved! (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          setShops(shops.map(s => s.id === selectedShopData.id ? { ...s, latitude: lat, longitude: lng } : s));
          setSelectedShopData({ ...selectedShopData, latitude: lat, longitude: lng });
        }
        setIsCapturingShopGps(false);
      },
      () => { setShopGpsStatus('❌ Could not get location. Please allow GPS access.'); setIsCapturingShopGps(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const captureGpsLocation = () => {
    setGpsStatus('Locating Satellites...');
    if (!navigator.geolocation) { setGpsStatus('GPS Not Supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsStatus('📍 GPS Anchor Locked');
      },
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

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!matchedOrder) return;

    const newCashInput = parseFloat(amountReceived) || 0;
    if (newCashInput <= 0) return alert('Please enter a valid amount greater than ₹0.');
    if (newCashInput > parseFloat(matchedOrder.pending_amount)) {
      return alert(`Max allowed: ₹${matchedOrder.pending_amount}`);
    }

    setIsProcessingDelivery(true);
    try {
      const updatedAmountReceived = parseFloat(matchedOrder.amount_received || 0) + newCashInput;
      const finalRemainingPending = parseFloat(matchedOrder.bill_amount) - updatedAmountReceived;

      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'delivered',
          amount_received: updatedAmountReceived,
          pending_amount: finalRemainingPending,
          payment_mode: paymentMode,
          delivered_at: new Date().toISOString()
        })
        .eq('id', matchedOrder.id)
        .select();

      if (error) {
        alert('Update failed: ' + error.message + ' | Code: ' + error.code);
        return;
      }

      alert(`✅ Payment logged! Collected ₹${newCashInput}. Remaining: ₹${finalRemainingPending}`);
      setMatchedOrder(null);
      setAmountReceived('');
      // Reload bills for this shop
      if (selectedDeliveryShop) handleDeliveryShopSelect(selectedDeliveryShop);
    } catch (err) {
      alert('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingDelivery(false);
    }
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
        const { data: shopData, error: shopErr } = await supabase
          .from('shops')
          .insert([{ name: newShopName.trim(), phone_number: whatsappNumber, latitude: gpsCoordinates.lat, longitude: gpsCoordinates.lng }])
          .select().single();
        if (shopErr) throw shopErr;
        targetShopId = shopData.id;
      }

      if (!targetShopId) throw new Error('Please select a shop.');

      let cumulativeBillSum = 0;
      const formulatedItems = orderItems.map(item => {
        const productDetails = productCatalog.find(p => p.id === item.productId);
        const rowSum = (productDetails ? productDetails.unit_price : 0) * item.quantity;
        cumulativeBillSum += rowSum;
        return { product_id: item.productId, quantity: item.quantity, total_price: rowSum };
      });

      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .insert([{ bill_number: billNumber, shop_id: targetShopId, employee_name: selectedEmployee, status: 'draft', bill_amount: cumulativeBillSum }])
        .select().single();
      if (txErr) throw txErr;

      await supabase.from('transaction_items').insert(formulatedItems.map(item => ({ transaction_id: txData.id, ...item })));

      alert(`✅ Order ${billNumber} submitted!`);
      setOrderItems([{ productId: '', quantity: 1 }]);
      setNewShopName(''); setWhatsappNumber('');
      setGpsCoordinates({ lat: null, lng: null }); setGpsStatus('Not Anchored');
      setIsNewShop(false); setSelectedShop(''); setSelectedShopData(null);
      setShopGpsStatus('');
      generateFreshBillTag();
      loadInitialData();
    } catch (err) {
      alert(err.message);
    } finally { setIsSubmitting(false); }
  };

  const selectedShopMissingGps = selectedShopData && !selectedShopData.latitude && !selectedShopData.longitude;

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

        <div style={{ display: 'flex', borderRadius: '8px', backgroundColor: '#f1f5f9', padding: '4px', marginBottom: '25px' }}>
          <button type="button" onClick={() => setActiveTab('booking')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', backgroundColor: activeTab === 'booking' ? '#ffffff' : 'transparent', color: activeTab === 'booking' ? '#2563eb' : '#475569' }}>📝 Phase 1: Book Order</button>
          <button type="button" onClick={() => setActiveTab('delivery')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', backgroundColor: activeTab === 'delivery' ? '#ffffff' : 'transparent', color: activeTab === 'delivery' ? '#16a34a' : '#475569' }}>📦 Phase 2: Deliver & Collect</button>
        </div>

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
                  {isNewShop ? '← Back to existing' : '➕ Setup New Shop'}
                </button>
              </div>

              {!isNewShop ? (
                <div>
                  <select value={selectedShop} onChange={(e) => handleShopSelect(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value="">-- Select Existing Shop --</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}{!shop.latitude ? ' 📍 (No GPS)' : ''}
                      </option>
                    ))}
                  </select>

                  {selectedShopMissingGps && (
                    <div style={{ marginTop: '12px', padding: '14px', backgroundColor: '#fffbeb', border: '1.5px solid #fbbf24', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
                        ⚠️ This shop has no GPS location saved. Since you are here now, please capture it!
                      </p>
                      <button type="button" onClick={captureShopGpsLocation} disabled={isCapturingShopGps}
                        style={{ width: '100%', padding: '12px', backgroundColor: isCapturingShopGps ? '#94a3b8' : '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isCapturingShopGps ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                        {isCapturingShopGps ? '📡 Getting Location...' : '📍 Capture Shop Location Now'}
                      </button>
                      {shopGpsStatus && (
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: shopGpsStatus.includes('✅') ? '#16a34a' : '#dc2626', fontWeight: '500', textAlign: 'center' }}>
                          {shopGpsStatus}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedShopData && selectedShopData.latitude && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#16a34a' }}>
                      ✅ GPS on file: {parseFloat(selectedShopData.latitude).toFixed(4)}, {parseFloat(selectedShopData.longitude).toFixed(4)}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ padding: '15px', border: '2px solid #2563eb', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <input type="text" placeholder="Enter Store Name" value={newShopName} onChange={(e) => setNewShopName(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} />
                  <input type="tel" placeholder="WhatsApp Mobile Number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} />
                  <button type="button" onClick={captureGpsLocation}
                    style={{ width: '100%', padding: '12px', backgroundColor: gpsStatus.includes('Locked') ? '#10b981' : '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
                    {gpsStatus}
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px' }}>Book Order Items</label>
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
              <button type="button" onClick={addOrderItemRow}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '5px' }}>➕ Add Another Product Line</button>
            </div>

            <button type="submit" disabled={isSubmitting}
              style={{ width: '100%', padding: '16px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'Transmitting...' : '🚀 Submit Order Request'}
            </button>
          </form>

        ) : (
          /* ── PHASE 2: DELIVER & COLLECT ── */
          <div>
            {/* Shop Search */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Search Shop Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Type shop name to search..."
                  value={shopSearchText}
                  onChange={(e) => {
                    setShopSearchText(e.target.value);
                    if (!e.target.value) {
                      setSelectedDeliveryShop(null);
                      setPendingBills([]);
                      setMatchedOrder(null);
                    }
                  }}
                  style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', backgroundColor: '#ffffff', color: '#0f172a', boxSizing: 'border-box' }}
                />
                {/* Dropdown results */}
                {shopSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px' }}>
                    {shopSearchResults.map((shop) => (
                      <div
                        key={shop.id}
                        onClick={() => handleDeliveryShopSelect(shop)}
                        style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '15px', color: '#0f172a' }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                      >
                        🏪 {shop.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pending Bills for selected shop */}
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
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>
                      {pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''} found:
                    </p>
                    {pendingBills.map((bill) => (
                      <div
                        key={bill.id}
                        onClick={() => { setMatchedOrder({ ...bill, shops: selectedDeliveryShop }); setAmountReceived(''); }}
                        style={{
                          padding: '14px 16px', borderRadius: '8px', cursor: 'pointer',
                          border: matchedOrder?.id === bill.id ? '2px solid #16a34a' : '1px solid #e2e8f0',
                          backgroundColor: matchedOrder?.id === bill.id ? '#f0fdf4' : '#ffffff',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{bill.bill_number}</p>
                            <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>Bill: ₹{bill.bill_amount}</p>
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

            {/* Collection Form */}
            {matchedOrder && (
              <form onSubmit={handleConfirmDelivery} style={{ padding: '20px', border: '2px solid #16a34a', borderRadius: '10px', backgroundColor: '#f0fdf4', marginTop: '10px' }}>
                <h3 style={{ margin: '0 0 15px', color: '#166534', fontSize: '18px' }}>📦 Collect Payment</h3>
                <div style={{ marginBottom: '15px', fontSize: '15px', color: '#1e293b' }}>
                  <p style={{ margin: '0 0 4px' }}><strong>Bill:</strong> {matchedOrder.bill_number}</p>
                  <p style={{ margin: '0 0 4px' }}><strong>Shop:</strong> {matchedOrder.shops?.name}</p>
                  <p style={{ margin: '0 0 4px' }}><strong>Total Bill:</strong> ₹{matchedOrder.bill_amount}</p>
                  <p style={{ margin: '0' }}><strong>Balance Due:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '18px' }}>₹{matchedOrder.pending_amount}</span></p>
                </div>
                <hr style={{ border: '0', height: '1px', backgroundColor: '#bbf7d0', marginBottom: '16px' }} />
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Amount Collected Now (₹)</label>
                  <input type="number" min="1" placeholder="Enter amount collected" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
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
                    style={{ flex: 1, padding: '14px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    ← Back
                  </button>
                  <button type="submit" disabled={isProcessingDelivery}
                    style={{ flex: 2, padding: '14px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: isProcessingDelivery ? 0.7 : 1 }}>
                    {isProcessingDelivery ? 'Recording...' : '✔ Log Collection'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(AgentPortal, ['agent', 'owner']);