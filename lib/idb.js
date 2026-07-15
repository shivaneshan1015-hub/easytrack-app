// Minimal promisified IndexedDB wrapper — no external dependency.
// Covers exactly what the offline agent store needs: open a versioned DB with
// object stores, and get/getAll/put/del/clear against a named store.

function openDB(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion, e.newVersion);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; }).catch(reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(db, storeName, key) {
  return withStore(db, storeName, 'readonly', (store) => reqToPromise(store.get(key)));
}

async function getAll(db, storeName) {
  return withStore(db, storeName, 'readonly', (store) => reqToPromise(store.getAll()));
}

async function put(db, storeName, value) {
  return withStore(db, storeName, 'readwrite', (store) => reqToPromise(store.put(value)));
}

async function del(db, storeName, key) {
  return withStore(db, storeName, 'readwrite', (store) => reqToPromise(store.delete(key)));
}

async function clear(db, storeName) {
  return withStore(db, storeName, 'readwrite', (store) => reqToPromise(store.clear()));
}

export { openDB, get, getAll, put, del, clear };
