import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import Head from 'next/head';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const finishSignIn = async () => {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { router.replace('/login'); return; }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

      if (!profile) {
        // First-time Google sign-in — no invite existed, so provision as owner
        // (same default the manual "Register" form uses).
        await supabase.from('profiles').upsert([{
          id: user.id,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
          email: user.email,
          role: 'owner',
        }]);
        router.replace('/dashboard');
        return;
      }

      router.replace(profile.role === 'agent' ? '/agent' : '/dashboard');
    };
    finishSignIn();
  }, [router]);

  return (
    <>
      <Head><title>EasyTrack — Signing you in…</title></Head>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#64748b', fontSize: 15 }}>
        Signing you in...
      </div>
    </>
  );
}
