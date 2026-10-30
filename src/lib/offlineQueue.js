const DB_NAME = 'hysmart-station-local-ops';
const DB_VERSION = 1;
const STORE = 'meter-reading-outbox';

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Durable offline storage is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
  });
}

async function withStore(mode, operation) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = operation(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error || new Error('Offline storage transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Offline storage transaction was cancelled.'));
    });
  } finally { db.close(); }
}

export async function queueMeterReading({ userId, stationId, endpoint, payload }) {
  if (!userId || !stationId || !payload?.idempotencyKey) throw new Error('Cannot queue a reading without user, station, and idempotency identity.');
  const record = {
    id: payload.idempotencyKey,
    userId,
    stationId,
    endpoint,
    payload,
    createdAt: new Date().toISOString(),
    state: 'pending',
    lastError: null,
  };
  await withStore('readwrite', (store) => store.put(record));
  return record;
}

export async function listMeterReadings(userId) {
  if (!userId) return [];
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).index('userId').getAll(userId);
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      request.onerror = () => reject(request.error || new Error('Could not read offline queue.'));
    });
  } finally { db.close(); }
}

export async function updateMeterReading(id, patch) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const get = store.get(id);
      get.onsuccess = () => { if (get.result) store.put({ ...get.result, ...patch }); };
      get.onerror = () => reject(get.error || new Error('Could not update offline queue.'));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not update offline queue.'));
    });
  } finally { db.close(); }
}

export async function removeMeterReading(id) {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearMeterReadingsForUser(userId) {
  const records = await listMeterReadings(userId);
  for (const record of records) await removeMeterReading(record.id);
}
