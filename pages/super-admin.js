import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth, withAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import StatWidget from '../components/ui/StatWidget';

function SuperAdminDashboard() {
  const { supabase, profile, signOut } = useAuth();
  const router = useRouter();

  const [organizations, setOrganizations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Modal states — Onboarding New Client
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newPlanTier, setNewPlanTier] = useState('starter');
  const [newMaxAgents, setNewMaxAgents] = useState(5);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Modal states — Custom Feature Overrides per Client
  const [customizingOrg, setCustomizingOrg] = useState(null);
  const [customFeatures, setCustomFeatures] = useState({
    enable_route_map: true,
    enable_custom_invoices: true,
    enable_whatsapp: true,
    enable_credit_engine: true,
    enable_custom_pricing: true,
    enable_leave_attendance: true,
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  async function loadOrganizations() {
    setIsLoading(true);
    try {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') {
        console.error('Error fetching orgs:', error);
      }

      // If organizations table doesn't exist yet, fall back to profiles with role='owner'
      if (!orgs || orgs.length === 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, created_at')
          .eq('role', 'owner');

        const simulatedOrgs = (owners || []).map(o => ({
          id: o.id,
          company_name: `${o.full_name}'s Distribution`,
          owner_name: o.full_name,
          owner_email: o.email,
          plan_tier: 'starter',
          max_agents: 5,
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: o.created_at || new Date().toISOString(),
          features: {
            enable_route_map: true,
            enable_custom_invoices: true,
            enable_whatsapp: true,
            enable_credit_engine: true,
            enable_custom_pricing: true,
            enable_leave_attendance: true,
          }
        }));
        setOrganizations(simulatedOrgs);
      } else {
        setOrganizations(orgs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleUpdateStatus = async (orgId, newStatus) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ status: newStatus })
        .eq('id', orgId);

      if (error && error.code !== '42P01') throw error;

      setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, status: newStatus } : o));
      showToast(`✅ Client status updated to ${newStatus}`);
    } catch (err) {
      showToast(`❌ Update failed: ${err.message}`);
    }
  };

  const handleExtendTrial = async (orgId, daysToAdd = 7) => {
    try {
      const org = organizations.find(o => o.id === orgId);
      const currentEnd = org?.trial_ends_at ? new Date(org.trial_ends_at) : new Date();
      const newEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('organizations')
        .update({ trial_ends_at: newEnd, status: 'trial' })
        .eq('id', orgId);

      if (error && error.code !== '42P01') throw error;

      setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, trial_ends_at: newEnd, status: 'trial' } : o));
      showToast(`✅ Extended trial by +${daysToAdd} days`);
    } catch (err) {
      showToast(`❌ Extension failed: ${err.message}`);
    }
  };

  const openCustomizeModal = (org) => {
    setCustomizingOrg(org);
    setCustomFeatures(org.features || {
      enable_route_map: true,
      enable_custom_invoices: true,
      enable_whatsapp: true,
      enable_credit_engine: true,
      enable_custom_pricing: true,
      enable_leave_attendance: true,
    });
  };

  const handleSaveCustomFeatures = async () => {
    if (!customizingOrg) return;
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ features: customFeatures })
        .eq('id', customizingOrg.id);

      if (error && error.code !== '42P01') console.warn('Feature save error:', error.message);

      setOrganizations(prev => prev.map(o => o.id === customizingOrg.id ? { ...o, features: customFeatures } : o));
      showToast(`✅ Custom module features saved for ${customizingOrg.company_name}!`);
      setCustomizingOrg(null);
    } catch (err) {
      showToast(`❌ Failed to save custom features: ${err.message}`);
    }
  };

  const handleProvisionClient = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newOwnerEmail.trim()) {
      return alert('Company name and owner email are required.');
    }
    setIsProvisioning(true);
    try {
      const newOrg = {
        id: crypto.randomUUID(),
        company_name: newCompanyName.trim(),
        owner_name: newOwnerName.trim() || 'Owner',
        owner_email: newOwnerEmail.trim(),
        plan_tier: newPlanTier,
        max_agents: parseInt(newMaxAgents) || 5,
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        features: customFeatures
      };

      const { error: orgError } = await supabase.from('organizations').insert([newOrg]);
      if (orgError && orgError.code !== '42P01') {
        console.warn('Could not insert org into DB:', orgError.message);
      }

      setOrganizations(prev => [newOrg, ...prev]);
      setShowAddModal(false);
      setNewCompanyName('');
      setNewOwnerName('');
      setNewOwnerEmail('');
      showToast(`🎉 Provisioned ${newOrg.company_name}! 7-Day Trial Activated.`);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsProvisioning(false);
    }
  };

  // KPI Calculations
  const totalClients = organizations.length;
  const activeClients = organizations.filter(o => o.status === 'active').length;
  const trialClients = organizations.filter(o => o.status === 'trial').length;
  const suspendedClients = organizations.filter(o => o.status === 'suspended').length;

  return (
    <>
      <Head>
        <title>EasyTrack — Super Admin Creator Panel</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Top Creator Navigation Bar */}
        <header style={{ borderBottom: '1px solid #1e293b', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Logo variant="dark" height={42} />
            <span style={{ backgroundColor: '#16a34a', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '9999px', letterSpacing: '0.05em' }}>
              SUPER ADMIN CREATOR
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => router.push('/dashboard')}
              title="Preview or test the distributor management dashboard as an admin"
              style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              📊 Test Distributor Dashboard
            </button>
            <button
              onClick={signOut}
              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px' }}>

          {/* Title Header & Provision Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '30px', fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
                Client Subscriptions & Custom Module Control
              </h1>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px' }}>
                Provision client accounts, toggle custom features per client requirement, and manage 7-day trials.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
            >
              + Onboard New Client
            </button>
          </div>

          {/* High Contrast KPI Metrics Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <StatWidget title="Total Clients" value={totalClients} icon="🏢" color="#38bdf8" bgTint="#1e293b" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
            <StatWidget title="Active Subscriptions" value={activeClients} icon="✅" color="#22c55e" bgTint="#14532d" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
            <StatWidget title="7-Day Active Trials" value={trialClients} icon="⏳" color="#f59e0b" bgTint="#78350f" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
            <StatWidget title="Suspended / Expired" value={suspendedClients} icon="🚫" color="#ef4444" bgTint="#7f1d1d" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
          </div>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div style={{ backgroundColor: '#14532d', border: '1px solid #22c55e', color: '#ffffff', padding: '12px 20px', borderRadius: '10px', marginBottom: '24px', fontWeight: 700, fontSize: '14px' }}>
              {toastMessage}
            </div>
          )}

          {/* Client Organizations Directory */}
          <Card title="Client Organizations Directory" subtitle="Manage client trial periods, custom module features, and subscription status" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} headerStyle={{ borderBottom: '1px solid #334155' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#cbd5e1' }}>Loading client directory...</div>
            ) : organizations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#cbd5e1' }}>No client organizations onboarded yet. Click "+ Onboard New Client" to start!</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#cbd5e1', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 16px' }}>Company & Owner</th>
                      <th style={{ padding: '12px 16px' }}>Plan & Seats</th>
                      <th style={{ padding: '12px 16px' }}>Custom Features</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Trial / Expiry</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map(org => {
                      const trialDaysLeft = org.trial_ends_at
                        ? Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
                        : 0;

                      return (
                        <tr key={org.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '15px' }}>{org.company_name}</div>
                            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                              {org.owner_name} ({org.owner_email || 'No email'})
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ backgroundColor: '#0f172a', border: '1px solid #475569', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>
                                {org.plan_tier || 'Starter'}
                              </span>
                              <span style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>
                                {org.max_agents || 5} Seats
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <button
                              onClick={() => openCustomizeModal(org)}
                              style={{ backgroundColor: '#0f172a', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              ⚙️ Customize Features
                            </button>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <Badge status={org.status === 'active' ? 'active' : org.status === 'trial' ? 'warning' : 'danger'}>
                              {org.status === 'active' ? 'Active Paid' : org.status === 'trial' ? '7-Day Trial' : 'Suspended'}
                            </Badge>
                          </td>
                          <td style={{ padding: '16px', fontSize: '13px' }}>
                            {org.status === 'trial' ? (
                              <span style={{ color: trialDaysLeft > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                                ⏳ {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left` : 'Expired'}
                              </span>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Paid Subscription</span>
                            )}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button
                                onClick={() => handleExtendTrial(org.id, 7)}
                                style={{ backgroundColor: '#334155', color: '#38bdf8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                +7 Days
                              </button>

                              {org.status !== 'active' && (
                                <button
                                  onClick={() => handleUpdateStatus(org.id, 'active')}
                                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Activate
                                </button>
                              )}

                              {org.status !== 'suspended' && (
                                <button
                                  onClick={() => handleUpdateStatus(org.id, 'suspended')}
                                  style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

        </main>

        {/* Modal 1: Onboard New Client */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', color: '#ffffff' }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", margin: '0 0 8px', fontSize: '22px' }}>Onboard New Client Organization</h2>
              <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 24px' }}>
                Provision a distributor account with an instant 7-Day Free Trial.
              </p>

              <form onSubmit={handleProvisionClient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Logistics Ltd."
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Owner Email</label>
                  <input
                    type="email"
                    placeholder="rahul@apexdistributors.com"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Plan Tier</label>
                    <select
                      value={newPlanTier}
                      onChange={(e) => setNewPlanTier(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                    >
                      <option value="starter">Starter</option>
                      <option value="growth">Growth</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>Max Agent Seats</label>
                    <input
                      type="number"
                      value={newMaxAgents}
                      onChange={(e) => setNewMaxAgents(e.target.value)}
                      min="1"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProvisioning}
                    style={{ flex: 2, padding: '12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: isProvisioning ? 'not-allowed' : 'pointer' }}
                  >
                    {isProvisioning ? 'Provisioning...' : 'Activate 7-Day Trial'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Custom Client Module Feature Toggles */}
        {customizingOrg && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', color: '#ffffff' }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", margin: '0 0 6px', fontSize: '22px' }}>Customize Features — {customizingOrg.company_name}</h2>
              <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 24px' }}>
                Toggle individual application modules for this client according to their custom requirements.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                {[
                  { key: 'enable_route_map', label: '🗺️ Route Optimizer Map (GPS Sequencing)', desc: 'Interactive Leaflet route planning for delivery agents' },
                  { key: 'enable_custom_invoices', label: '📄 Custom Letterhead PDF Invoicing', desc: 'Overlays client company letterhead on generated invoices' },
                  { key: 'enable_whatsapp', label: '📱 WhatsApp Payment Receipts', desc: 'Sends direct payment confirmation receipts to shop WhatsApp' },
                  { key: 'enable_credit_engine', label: '💳 Live Shop Credit Limits & Hold Engine', desc: 'Blocks orders when shop outstanding exceeds credit limit' },
                  { key: 'enable_custom_pricing', label: '💰 Shop-Specific Product Price Matrix', desc: 'Allows setting unique product pricing per retail store' },
                  { key: 'enable_leave_attendance', label: '🏖️ Leaves & Attendance Management', desc: 'Agent leave requests and daily GPS check-in attendance' },
                ].map(({ key, label, desc }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!customFeatures[key]}
                      onChange={(e) => setCustomFeatures({ ...customFeatures, [key]: e.target.checked })}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>{label}</div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCustomizingOrg(null)}
                  style={{ flex: 1, padding: '12px', backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomFeatures}
                  style={{ flex: 2, padding: '12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Feature Customizations
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

export default withAuth(SuperAdminDashboard, ['super_admin', 'owner']);
