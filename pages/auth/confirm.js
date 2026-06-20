import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import Head from 'next/head';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading' | 'set_password' | 'success' | 'magic_link'

  useEffect(() => {
    const handleAuth = async () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const queryParams = new URLSearchParams(search);
      const code = queryParams.get('code');

      // ── PKCE flow: ?code=xxx (Supabase v2 default) ──────────────────────────
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError('Link is invalid or has expired. Please request a new one.');
          setStatus('set_password');
          return;
        }
        const type = queryParams.get('type');
        if (type === 'magiclink' || type === 'email') {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
          if (profile?.role === 'agent') router.replace('/agent');
          else router.replace('/dashboard');
        } else {
          setStatus('set_password');
        }
        return;
      }

      // ── Implicit flow: #access_token=xxx ────────────────────────────────────
      if (!hash) {
        router.replace('/login');
        return;
      }

      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (!accessToken) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setError('Link is invalid or has expired. Please request a new one.');
        setStatus('set_password');
        return;
      }

      if (type === 'magiclink') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        if (profile?.role === 'agent') router.replace('/agent');
        else router.replace('/dashboard');
      } else {
        setStatus('set_password');
      }
    };

    handleAuth();
  }, [router]);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus('success');

      // Get role and redirect
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setTimeout(() => {
        if (profile?.role === 'agent') router.replace('/agent');
        else router.replace('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>EasyTrack — Confirm</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=DM+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div style={styles.root}>
        <div style={styles.card}>

          <div style={styles.logo}>
            <span style={styles.logoMark}>ET</span>
            <span style={styles.logoText}>EasyTrack</span>
          </div>

          {status === 'loading' && (
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 15 }}>
              Verifying your link...
            </p>
          )}

          {status === 'success' && (
            <div style={styles.successBox}>
              <div style={styles.successIcon}>✓</div>
              <h2 style={styles.successTitle}>Password Set!</h2>
              <p style={styles.successText}>Redirecting you now...</p>
            </div>
          )}

          {status === 'set_password' && (
            <>
              <div style={styles.header}>
                <h2 style={styles.title}>Set Your Password</h2>
                <p style={styles.subtitle}>Create a password to activate your account</p>
              </div>

              {error && <div style={styles.errorBox}>⚠ {error}</div>}

              <form onSubmit={handleSetPassword} style={styles.form}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={styles.input}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? 'Activating...' : '→ Activate My Account'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 400,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 32, justifyContent: 'center',
  },
  logoMark: {
    backgroundColor: '#4ade80', color: '#0f172a',
    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16,
    borderRadius: 7, width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    fontFamily: "'Syne', sans-serif", fontWeight: 700,
    fontSize: 20, color: '#0f172a', letterSpacing: '-0.5px',
  },
  header: { marginBottom: 28, textAlign: 'center' },
  title: {
    fontFamily: "'Syne', sans-serif", fontWeight: 800,
    fontSize: 24, color: '#0f172a', margin: '0 0 8px 0',
  },
  subtitle: { fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.5 },
  errorBox: {
    backgroundColor: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', borderRadius: 8, padding: '12px 16px',
    fontSize: 13, marginBottom: 20,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: {
    padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: 15,
    color: '#0f172a', backgroundColor: '#f8fafc',
    fontFamily: "'DM Sans', sans-serif", outline: 'none',
  },
  submitBtn: {
    marginTop: 8, padding: '14px 20px',
    backgroundColor: '#0f172a', color: '#ffffff',
    border: 'none', borderRadius: 10, fontSize: 15,
    fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
  },
  successBox: { textAlign: 'center', padding: '20px 0' },
  successIcon: {
    width: 60, height: 60, backgroundColor: '#dcfce7',
    color: '#16a34a', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 'bold', margin: '0 auto 20px',
  },
  successTitle: {
    fontFamily: "'Syne', sans-serif", fontWeight: 800,
    fontSize: 24, color: '#0f172a', margin: '0 0 10px 0',
  },
  successText: { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 },
};