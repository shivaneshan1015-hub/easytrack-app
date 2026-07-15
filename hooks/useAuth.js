import { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const AuthContext = createContext(null);

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // { role: 'owner' | 'agent', full_name, ... }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Resolve current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      try { localStorage.setItem('et_profile_cache_v1', JSON.stringify({ userId, profile: data })); } catch (_) {}
    } else if (error?.code === 'PGRST116') {
      // Genuinely no matching profile row — don't fall back to stale cache.
      try { localStorage.removeItem('et_profile_cache_v1'); } catch (_) {}
      setProfile(null);
    } else {
      // Network-shaped failure (offline, unreachable, etc.) — fall back to the last known profile
      // for this same user rather than bouncing them out via withAuth's role check.
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem('et_profile_cache_v1') || 'null'); } catch (_) {}
      setProfile(cached && cached.userId === userId ? cached.profile : null);
    }
    setLoading(false);
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    try { localStorage.removeItem('et_profile_cache_v1'); } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ─── HOC: withAuth ────────────────────────────────────────────────────────────
// Usage: export default withAuth(MyPage, ['owner'])
// roles = array of allowed roles; empty array = any authenticated user
import { useRouter } from 'next/router';

export function withAuth(Component, allowedRoles = []) {
  return function ProtectedPage(props) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (loading) return;
      if (!user) { router.replace('/login'); return; }
      if (allowedRoles.length > 0 && !allowedRoles.includes(profile?.role)) {
        // Role mismatch — send agent back to their portal
        if (profile?.role === 'agent') router.replace('/agent');
        else router.replace('/login');
      }
    }, [user, profile, loading, router]);

    if (loading || !user) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#64748b', fontSize: 15 }}>
          Loading EasyTrack...
        </div>
      );
    }

    return <Component {...props} />;
  };
}