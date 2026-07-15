// Drains the offline outbox (queued delivery/payment confirmations) whenever
// connectivity looks like it's back. Each item is replayed via the
// sync_queued_delivery_payment RPC (see migrations/014), which is atomic and
// idempotent on the server side, so it's safe to retry an item that may have
// partially applied before a crash/close.

import { getOutbox, updateOutboxItem, removeOutboxItem } from './offlineStore';

export function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const msg = (err.message || '').toLowerCase();
  if (/fetch|network|failed to fetch|load failed|ERR_INTERNET_DISCONNECTED/i.test(msg)) return true;
  // A structured Postgrest/DB error always carries a `.code`; anything else
  // that still has a message but no code is treated as network-shaped.
  return !err.code && !!err.message;
}

let syncInProgress = false;

async function replayItem(supabase, item) {
  const { data, error } = await supabase.rpc('sync_queued_delivery_payment', {
    p_transaction_id: item.transactionId,
    p_client_ref: item.clientRef,
    p_cash_amount: item.cashAmount,
    p_payment_mode: item.paymentMode,
    p_collected_at: item.collectedAt,
  });
  if (error) throw error;
  return data;
}

export async function trySyncNow(supabase) {
  if (syncInProgress) return;
  const outbox = await getOutbox();
  if (outbox.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  syncInProgress = true;
  try {
    for (const item of outbox) {
      if (item.status === 'syncing') continue;
      await updateOutboxItem(item.clientRef, { status: 'syncing' });
      try {
        await replayItem(supabase, item);
        await removeOutboxItem(item.clientRef);
      } catch (err) {
        await updateOutboxItem(item.clientRef, {
          status: 'pending',
          attempts: (item.attempts || 0) + 1,
          lastError: err?.message || String(err),
        });
        // Stop the pass on the first failure that isn't network-shaped — a real
        // application error on one item shouldn't spin through the rest of the
        // queue retrying the same broken payload.
        if (!isNetworkError(err)) break;
      }
    }
  } finally {
    syncInProgress = false;
  }
}

export function startSyncEngine(supabase) {
  const sync = () => trySyncNow(supabase);
  const onVisible = () => { if (document.visibilityState === 'visible') sync(); };

  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', onVisible);
  const intervalId = setInterval(sync, 20000);
  sync();

  return () => {
    window.removeEventListener('online', sync);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(intervalId);
  };
}
