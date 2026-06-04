import { useState, useEffect } from 'react';
import { useAuth, withAuth } from '../hooks/useAuth';

function AgentPortal() {
  const { supabase, profile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState('booking');

  // Core App State
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [billNumber, setBillNumber] = useState('');

  // Phase 1 Booking States
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [selectedShopData, setSelectedShopData] = useState(null); // full shop object
  const [isNewShop, setIsNewShop] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState({ lat: null, lng: null });
  const [gpsStatus, setGpsStatus] = useState('Not Anchored');
  const [productCatalog, setProductCatalog] = useState([]);
  const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GPS capture for existing shop
  const [shopGpsStatus, setShopGpsStatus] = useState('');
  const [isCapturingShopGps, setIsCapturingShopGps] = useState(false);

  // Phase 2 States
  const [searchBillNumber, setSearchBillNumber] = useState('');
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);

  const generateFreshBillTag = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setBillNumber(`ET-2026-${timestamp}-${randomSuffix}`);
  };

  async function loadInitialData() {
    const { data: empData } = await supabase.from('employees').select('name');
    if (empData) setEmployees(empData);

    // Load shops WITH latitude/longitude so we can detect missing GPS
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

  // When shop selection changes, update selectedShopData
  const handleShopSelect = (shopId) => {
    setSelectedShop(shopId);
    setShopGpsStatus('');
    if (!shopId) { setSelectedShopData(null); return; }
    const found = shops.find(s => s.id === shopId);
    setSelectedShopData(found || null);
  };

  // Capture GPS for an existing shop that has no location
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

        const { error } = await supabase
          .from('shops')
          .update({ latitude: lat, longitude: lng })
          .eq('id', selectedShopData.id);

        if (error) {
          setShopGpsStatus('❌ Failed to save location.');
        } else {
          setShopGpsStatus(`✅ Location saved! (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          // Update local shops list so button disappears
          setShops(shops.map(s => s.id === selectedShopData.id ? { ...s, latitude: lat, longitude: lng } : s));
          setSelectedShopData({ ...selectedShopData, latitude: lat, longitude: lng });
        }
        setIsCapturingShopGps(false);
      },
      () => {
        setShopGpsStatus('❌ Could not get location. Please allow GPS access.');
        setIsCapturingShopGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // GPS for new shop
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

  const handleBillSearch = async () => {
    if (!searchBillNumber.trim()) return alert('Please input a Bill Number.');
    const { data, error } = await supabase
      .from('transactions')
      .select(`id, bill_number, bill_amount, amount_received, pending_amount, status, shops ( name )`)
      .eq('bill_number', searchBillNumber.trim())
      .single();

    if (error || !data) { alert('Invoice not found or not yet approved.'); setMatchedOrder(null); return; }
    if (data.status === 'delivered' && parseFloat(data.pending_amount) <= 0) {
      alert('This bill is fully settled.'); setMatchedOrder(null); return;
    }
    setMatchedOrder(data);
    setAmountReceived('');
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!matchedOrder) return;
    const newCashInput = parseFloat(amountReceived) || 0;
    if (newCashInput <= 0) return alert('Please enter a valid amount greater than ₹0.');
    if (newCashInput > matchedOrder.pending_amount) return alert(`Max allowed: ₹${matchedOrder.pending_amount}`);

    setIsProcessingDelivery(true);
    try {
      const updatedAmountReceived = parseFloat(matchedOrder.amount_received || 0) + newCashInput;
      const finalRemainingPending = parseFloat(matchedOrder.bill_amount) - updatedAmountReceived;
      const { error } = await supabase.from('transactions').update({
        status: 'delivered', amount_received: updatedAmountReceived,
        pending_amount: finalRemainingPending, payment_mode: paymentMode,
        delivered_at: new Date().toISOString()
      }).eq('id', matchedOrder.id);
      if (error) throw error;
      alert(`✅ Payment logged! Collected ₹${newCashInput}. Remaining: ₹${finalRemainingPending}`);
      setSearchBillNumber(''); setMatchedOrder(null); setAmountReceived('');
    } catch (err) {
      alert('Failed to update collection.');
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

  // Does the selected existing shop have no GPS?
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

            {/* Employee Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Select Your Name</label>
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} disabled={profile?.role === 'agent'}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', backgroundColor: profile?.role === 'agent' ? '#f8fafc' : '#ffffff', color: '#0f172a' }}>
                <option value="">-- Choose Employee --</option>
                {employees.map((emp, idx) => <option key={idx} value={emp.name}>{emp.name}</option>)}
              </select>
            </div>

            {/* Bill Number */}
            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Auto-Generated Bill Tag</span>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>{billNumber}</strong>
            </div>

            {/* Shop Selection */}
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

                  {/* GPS capture button — only shown when shop has no GPS */}
                  {selectedShopMissingGps && (
                    <div style={{ marginTop: '12px', padding: '14px', backgroundColor: '#fffbeb', border: '1.5px solid #fbbf24', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
                        ⚠️ This shop has no GPS location saved. Since you are here now, please capture it!
                      </p>
                      <button
                        type="button"
                        onClick={captureShopGpsLocation}
                        disabled={isCapturingShopGps}
                        style={{ width: '100%', padding: '12px', backgroundColor: isCapturingShopGps ? '#94a3b8' : '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isCapturingShopGps ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                      >
                        {isCapturingShopGps ? '📡 Getting Location...' : '📍 Capture Shop Location Now'}
                      </button>
                      {shopGpsStatus && (
                        <p style={{ margin: '8px 0 0', fontSize: '13px', color: shopGpsStatus.includes('✅') ? '#16a34a' : '#dc2626', fontWeight: '500', textAlign: 'center' }}>
                          {shopGpsStatus}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Confirmation when GPS already exists */}
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

            {/* Order Items */}
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
          <div>
            <div style={{ marginBottom: '25px', display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="Enter Bill Number (e.g. ET-2026-...)" value={searchBillNumber} onChange={(e) => setSearchBillNumber(e.target.value)}
                style={{ flexGrow: 1, padding: '14px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '15px', backgroundColor: '#ffffff', color: '#0f172a' }} />
              <button type="button" onClick={handleBillSearch}
                style={{ padding: '0 20px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Search</button>
            </div>

            {matchedOrder && (
              <form onSubmit={handleConfirmDelivery} style={{ padding: '20px', border: '2px solid #16a34a', borderRadius: '10px', backgroundColor: '#f0fdf4' }}>
                <h3 style={{ margin: '0 0 15px', color: '#166534', fontSize: '18px' }}>📦 Secure Handover Gateway</h3>
                <div style={{ marginBottom: '15px', fontSize: '15px', color: '#1e293b' }}>
                  <p style={{ margin: '0 0 6px' }}><strong>Shop:</strong> {matchedOrder.shops?.name}</p>
                  <p style={{ margin: '0 0 6px' }}><strong>Total:</strong> ₹{matchedOrder.bill_amount}</p>
                  <p style={{ margin: '0' }}><strong>Balance:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '18px' }}>₹{matchedOrder.pending_amount}</span></p>
                </div>
                <hr style={{ border: '0', height: '1px', backgroundColor: '#bbf7d0', marginBottom: '20px' }} />
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Amount Collected (₹)</label>
                  <input type="number" min="1" placeholder="Enter amount collected" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #16a34a', fontSize: '16px', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#0f172a' }} />
                </div>
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#14532d', fontSize: '14px' }}>Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #16a34a', fontSize: '15px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <button type="submit" disabled={isProcessingDelivery}
                  style={{ width: '100%', padding: '16px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: isProcessingDelivery ? 0.7 : 1 }}>
                  {isProcessingDelivery ? 'Recording...' : '✔ Log Collection & Handover'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(AgentPortal, ['agent', 'owner']);