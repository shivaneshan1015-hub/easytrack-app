import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash && hash.includes('access_token')) {
      router.replace('/auth/confirm' + hash);
    } else if (search && new URLSearchParams(search).get('code')) {
      router.replace('/auth/confirm' + search);
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}