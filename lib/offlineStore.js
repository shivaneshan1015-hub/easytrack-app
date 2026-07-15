// EasyTrack-specific offline stores for the agent app: a cache of the agent's
// open bills (for offline browsing) and an outbox queue of delivery/payment
// confirmations that couldn't reach Supabase live. Built on lib/idb.js.

import { openDB, getAll, put, del, clear } from './idb';

const DB_NAME = 'easytrack-agent';
const DB_VERSION = 1;
const OPEN_BILLS_STORE = 'openBills';
const OUTBOX_STORE = 'outbox';

let dbPromise = null;

function getDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(OPEN_BILLS_STORE)) {
        db.createObjectStore(OPEN_BILLS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'clientRef' });
      }
    });
  }
  return dbPromise;
}

// ─── Open bills cache ───────────────────────────────────────────────────────

export async function setCachedOpenBills(bills) {
  const db = await getDb();
  if (!db) return;
  await clear(db, OPEN_BILLS_STORE);
  for (const bill of bills) await put(db, OPEN_BILLS_STORE, bill);
}

export async function getCachedOpenBills() {
  const db = await getDb();
  if (!db) return [];
  return getAll(db, OPEN_BILLS_STORE);
}

// ─── Outbox (queued delivery/payment confirmations) ────────────────────────

const outboxListeners = new Set();

async function notifyOutboxListeners() {
  const items = await getOutbox();
  outboxListeners.forEach((cb) => cb(items));
}

export function subscribeOutbox(cb) {
  outboxListeners.add(cb);
  getOutbox().then(cb);
  return () => outboxListeners.delete(cb);
}

export async function enqueueDeliveryAction(item) {
  const db = await getDb();
  if (!db) return;
  await put(db, OUTBOX_STORE, item);
  await notifyOutboxListeners();
}

export async function getOutbox() {
  const db = await getDb();
  if (!db) return [];
  return getAll(db, OUTBOX_STORE);
}

export async function updateOutboxItem(clientRef, patch) {
  const db = await getDb();
  if (!db) return;
  const items = await getAll(db, OUTBOX_STORE);
  const existing = items.find((i) => i.clientRef === clientRef);
  if (!existing) return;
  await put(db, OUTBOX_STORE, { ...existing, ...patch });
  await notifyOutboxListeners();
}

export async function removeOutboxItem(clientRef) {
  const db = await getDb();
  if (!db) return;
  await del(db, OUTBOX_STORE, clientRef);
  await notifyOutboxListeners();
}
