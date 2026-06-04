import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      router.replace('/auth/confirm' + hash);
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}