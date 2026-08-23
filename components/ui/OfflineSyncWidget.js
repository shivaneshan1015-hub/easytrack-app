import { useState, useEffect } from 'react';
import { getOutbox, subscribeOutbox } from '../../lib/offlineStore';
import { trySyncNow } from '../../lib/syncEngine';

/**
 * Floating bottom-right widget displaying online/offline status and pending outbox count
 */
export default function OfflineSyncWidget({ supabase }) {
  const [isOnline, setIsOnline] = useState(true);
  const [outboxCount, setOutboxCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeOutbox((items) => {
      setOutboxCount(items ? items.length : 0);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    if (!supabase || isSyncing) return;
    setIsSyncing(true);
    try {
      await trySyncNow(supabase);
    } catch (e) {
      console.error('[OfflineSyncWidget] sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Only render floating widget if offline OR there are items waiting in the outbox
  if (isOnline && outboxCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        backgroundColor: '#0f172a',
        color: '#ffffff',
        padding: '10px 16px',
        borderRadius: '9999px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        fontWeight: 600,
        border: '1px solid #1e293b'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#22c55e' : '#f59e0b',
            boxShadow: `0 0 8px ${isOnline ? '#22c55e' : '#f59e0b'}`
          }}
        />
        <span>{isOnline ? 'Connected' : 'Offline Mode'}</span>
      </div>

      {outboxCount > 0 && (
        <span
          style={{
            backgroundColor: '#1e293b',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            color: '#38bdf8'
          }}
        >
          {outboxCount} pending
        </span>
      )}

      {isOnline && outboxCount > 0 && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          style={{
            backgroundColor: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}
