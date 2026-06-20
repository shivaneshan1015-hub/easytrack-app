import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import Head from 'next/head';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role: 'owner' } }
        });
        if (signUpError) throw signUpError;
        if (data.user) {
          await supabase.from('profiles').upsert([{
            id: data.user.id,
            full_name: fullName,
            email,
            role: 'owner'
          }]);
          if (data.session) {
            // Email confirmation disabled — session is active, go straight to dashboard
            router.push('/dashboard');
          } else {
            // Email confirmation required — tell the user to check their inbox
            setForgotMessage(`✅ Account created! Check your inbox at ${email} to confirm and activate your account.`);
          }
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profile?.role === 'agent') {
          router.push('/agent');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address first.');
    setIsLoading(true);
    setError('');
    setForgotMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm`,
      });
      if (error) throw error;
      setForgotMessage(`✅ Password reset link sent to ${email}. Check your inbox.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>EasyTrack — Sign In</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=DM+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @media (max-width: 767px) {
            .et-root { flex-direction: column !important; }
            .et-brand { display: none !important; }
            .et-form-panel {
              width: 100% !important;
              min-height: 100vh;
              padding: 48px 24px !important;
              justify-content: flex-start !important;
              padding-top: 64px !important;
            }
          }
        `}</style>
      </Head>

      <div style={styles.root} className="et-root">
        {/* Left panel */}
        <div style={styles.brandPanel} className="et-brand">
          <div style={styles.brandInner}>
            <div style={styles.logo}>
              <span style={styles.logoMark}>ET</span>
              <span style={styles.logoText}>EasyTrack</span>
            </div>
            <h1 style={styles.tagline}>
              Distribution<br />
              <em style={{ fontStyle: 'italic', opacity: 0.7 }}>made</em>{' '}
              <span style={{ color: '#4ade80' }}>simple.</span>
            </h1>
            <p style={styles.subTagline}>
              Manage routes, agents, invoices &amp; collections — built for
              distributors across India.
            </p>
            <div style={styles.pillRow}>
              {['Route Mapping', 'Live Tracking', 'Smart Invoicing', 'Ledger Reports'].map((f) => (
                <span key={f} style={styles.pill}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{ ...styles.circle, width: 360, height: 360, right: -100, top: -80, opacity: 0.06 }} />
          <div style={{ ...styles.circle, width: 220, height: 220, right: 60, bottom: 60, opacity: 0.08 }} />
        </div>

        {/* Right panel */}
        <div style={styles.formPanel} className="et-form-panel">
          <div style={styles.formCard}>

            <div style={styles.formHeader}>
              <h2 style={styles.formTitle}>
                {mode === 'login' && 'Welcome back'}
                {mode === 'register' && 'Create account'}
                {mode === 'forgot' && 'Reset password'}
              </h2>
              <p style={styles.formSubtitle}>
                {mode === 'login' && 'Sign in to your distributor account'}
                {mode === 'register' && 'Set up your EasyTrack workspace'}
                {mode === 'forgot' && 'We will send a reset link to your email'}
              </p>
            </div>

            {error && <div style={styles.errorBox}>⚠ {error}</div>}
            {forgotMessage && <div style={styles.successBox}>{forgotMessage}</div>}

            {/* ── FORGOT PASSWORD FORM ── */}
            {mode === 'forgot' ? (
              <form onSubmit={handleForgotPassword} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={styles.input}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                >
                  {isLoading ? 'Sending...' : '→ Send Reset Link'}
                </button>
              </form>
            ) : (
              /* ── LOGIN / REGISTER FORM ── */
              <form onSubmit={handleSubmit} style={styles.form}>
                {mode === 'register' && (
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Full Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      style={styles.input}
                    />
                  </div>
                )}

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={styles.label}>Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        style={styles.forgotBtn}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  {/* Password input with show/hide toggle */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      style={{ ...styles.input, paddingRight: '44px', width: '100%', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                >
                  {isLoading
                    ? 'Please wait...'
                    : mode === 'login' ? '→ Sign In' : '→ Create Account'}
                </button>
              </form>
            )}

            <div style={styles.switchRow}>
              {mode === 'login' && (
                <>
                  Don&apos;t have an account?{' '}
                  <button style={styles.switchBtn} onClick={() => { setMode('register'); setError(''); }}>
                    Register here
                  </button>
                </>
              )}
              {mode === 'register' && (
                <>
                  Already have an account?{' '}
                  <button style={styles.switchBtn} onClick={() => { setMode('login'); setError(''); }}>
                    Sign in
                  </button>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  Remember your password?{' '}
                  <button style={styles.switchBtn} onClick={() => { setMode('login'); setError(''); setForgotMessage(''); }}>
                    Back to Sign In
                  </button>
                </>
              )}
            </div>

            {mode === 'login' && (
              <div style={styles.roleNote}>
                <strong>Agents:</strong> Use the same login — you&apos;ll be routed to the Agent Portal automatically.
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    backgroundColor: '#0f172a',
  },
  brandPanel: {
    flex: 1,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f2942 100%)',
    padding: '60px 56px',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  brandInner: { position: 'relative', zIndex: 1, maxWidth: 440 },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 },
  logoMark: {
    backgroundColor: '#4ade80', color: '#0f172a',
    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18,
    borderRadius: 8, width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    letterSpacing: '-0.5px',
  },
  logoText: {
    fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 22,
    color: '#f8fafc', letterSpacing: '-0.5px',
  },
  tagline: {
    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 52,
    color: '#f8fafc', lineHeight: 1.1, margin: '0 0 20px 0', letterSpacing: '-2px',
  },
  subTagline: { fontSize: 16, color: '#94a3b8', lineHeight: 1.7, margin: '0 0 36px 0', maxWidth: 340 },
  pillRow: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  pill: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)', color: '#4ade80',
    border: '1px solid rgba(74, 222, 128, 0.25)', borderRadius: 100,
    padding: '6px 14px', fontSize: 12, fontWeight: 500, letterSpacing: '0.3px',
  },
  circle: { position: 'absolute', borderRadius: '50%', border: '1px solid #4ade80' },
  formPanel: {
    width: 480, backgroundColor: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 40px',
  },
  formCard: { width: '100%', maxWidth: 380 },
  formHeader: { marginBottom: 32 },
  formTitle: {
    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 30,
    color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-1px',
  },
  formSubtitle: { fontSize: 14, color: '#64748b', margin: 0 },
  errorBox: {
    backgroundColor: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', borderRadius: 8, padding: '12px 16px',
    fontSize: 13, marginBottom: 20,
  },
  successBox: {
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    color: '#166534', borderRadius: 8, padding: '12px 16px',
    fontSize: 13, marginBottom: 20,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151', letterSpacing: '0.2px' },
  input: {
    padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: 15, color: '#0f172a',
    backgroundColor: '#f8fafc', outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, padding: '0', lineHeight: 1,
  },
  forgotBtn: {
    background: 'none', border: 'none', color: '#2563eb',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", padding: 0,
  },
  submitBtn: {
    marginTop: 8, padding: '14px 20px',
    backgroundColor: '#0f172a', color: '#ffffff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.3px',
  },
  switchRow: { marginTop: 24, textAlign: 'center', fontSize: 13, color: '#64748b' },
  switchBtn: {
    background: 'none', border: 'none', color: '#2563eb',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", padding: 0,
  },
  roleNote: {
    marginTop: 20, backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0', borderRadius: 8,
    padding: '10px 14px', fontSize: 12, color: '#166534', lineHeight: 1.5,
  },
};