
/**
 * HySmart Station — Durable Offline Meter Reading Queue
 *
 * Database: hysmart-station-local-ops
 * Version: 2
 * Store: meter-reading-outbox
 *
 * Compatibility:
 * - Preserves existing database and object-store names.
 * - Preserves all five existing exported function names.
 * - Preserves the existing record fields.
 * - Does not change API endpoints or meter-reading payload structure.
 *
 * Security:
 * - Records are isolated by userId.
 * - Existing records are preserved during database upgrades.
 * - Immutable record identity cannot be changed by updateMeterReading().
 * - Reused idempotency keys cannot silently overwrite different readings.
 */

const DB_NAME = 'hysmart-station-local-ops';
const DB_VERSION = 2;
const STORE = 'meter-reading-outbox';

const VALID_STATES = new Set([
  'pending',
  'syncing',
  'blocked',
  'failed',
]);

const MAX_ID_LENGTH = 256;
const MAX_ERROR_LENGTH = 1000;

/**
 * Create a consistent error.
 */
function createError(message, name = 'OfflineQueueError') {
  const error = new Error(message);
  error.name = name;
  return error;
}

/**
 * Check that a value is a non-empty string.
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate the endpoint without imposing a new API route contract.
 *
 * Existing application endpoints are preserved, but absolute external
 * URLs and protocol-relative URLs are not accepted.
 */
function validateEndpoint(endpoint) {
  if (
    !isNonEmptyString(endpoint) ||
    !endpoint.startsWith('/') ||
    endpoint.startsWith('//') ||
    endpoint.includes('\\')
  ) {
    throw createError('Invalid offline reading endpoint.');
  }

  let parsed;

  try {
    parsed = new URL(endpoint, window.location.origin);
  } catch {
    throw createError('Invalid offline reading endpoint.');
  }

  if (parsed.origin !== window.location.origin) {
    throw createError('Offline reading endpoint must be same-origin.');
  }

  return endpoint;
}

/**
 * Validate the minimum record identity.
 *
 * Do not require payload.stationId here because existing application
 * payload structures may differ between reading types.
 */
function validateRecordInput({ userId, stationId, endpoint, payload }) {
  if (!isNonEmptyString(userId)) {
    throw createError('A valid user ID is required for offline storage.');
  }

  if (!isNonEmptyString(stationId)) {
    throw createError('A valid station ID is required for offline storage.');
  }

  validateEndpoint(endpoint);

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw createError('A valid meter reading payload is required.');
  }

  if (!isNonEmptyString(payload.idempotencyKey)) {
    throw createError(
      'Cannot queue a reading without an idempotency key.'
    );
  }

  if (payload.idempotencyKey.length > MAX_ID_LENGTH) {
    throw createError('The reading idempotency key is too long.');
  }

  return true;
}

/**
 * Open and upgrade the IndexedDB database.
 *
 * Version 1 records are preserved.
 * Version 2 adds indexes useful for queue management.
 */
function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      createError(
        'Durable offline storage is unavailable in this browser.',
        'NotSupportedError'
      )
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let upgradeError = null;

    let request;

    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;

      try {
        let store;

        if (!db.objectStoreNames.contains(STORE)) {
          store = db.createObjectStore(STORE, {
            keyPath: 'id',
          });
        } else {
          store = transaction.objectStore(STORE);
        }

        // Preserve existing indexes and create missing indexes.
        if (!store.indexNames.contains('userId')) {
          store.createIndex('userId', 'userId', {
            unique: false,
          });
        }

        if (!store.indexNames.contains('createdAt')) {
          store.createIndex('createdAt', 'createdAt', {
            unique: false,
          });
        }

        if (!store.indexNames.contains('stationId')) {
          store.createIndex('stationId', 'stationId', {
            unique: false,
          });
        }

        if (!store.indexNames.contains('state')) {
          store.createIndex('state', 'state', {
            unique: false,
          });
        }
      } catch (error) {
        upgradeError = error;

        try {
          transaction.abort();
        } catch {
          // The transaction may already have been aborted.
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      // Another browser tab may request a database upgrade.
      db.onversionchange = () => {
        db.close();
      };

      if (!settled) {
        settled = true;
        resolve(db);
      } else {
        db.close();
      }
    };

    request.onerror = () => {
      if (settled) return;

      settled = true;

      reject(
        upgradeError ||
        request.error ||
        createError('Could not open offline storage.')
      );
    };

    request.onblocked = () => {
      // Existing tabs may still be holding an older database connection.
      // Do not falsely report a successful upgrade.
      if (!settled) {
        settled = true;

        reject(
          createError(
            'Offline storage upgrade is blocked. Close other HySmart Station tabs and try again.',
            'InvalidStateError'
          )
        );
      }
    };
  });
}

/**
 * Run an IndexedDB transaction and resolve only after it completes.
 *
 * The operation callback must be synchronous. Do not await network
 * requests or other asynchronous work inside an IndexedDB transaction.
 */
async function withStore(mode, operation) {
  const db = await openDb();

  try {
    return await new Promise((resolve, reject) => {
      let transaction;
      let operationResult;
      let settled = false;

      try {
        transaction = db.transaction(STORE, mode);

        const store = transaction.objectStore(STORE);

        operationResult = operation(store);
      } catch (error) {
        try {
          transaction?.abort();
        } catch {
          // Ignore an already completed transaction.
        }

        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        if (settled) return;

        settled = true;

        // IDBRequest.result is available once its transaction completes.
        if (
          operationResult &&
          typeof operationResult === 'object' &&
          'onsuccess' in operationResult
        ) {
          resolve(operationResult.result);
        } else {
          resolve(operationResult);
        }
      };

      transaction.onerror = () => {
        if (settled) return;

        settled = true;

        reject(
          transaction.error ||
          createError('Offline storage transaction failed.')
        );
      };

      transaction.onabort = () => {
        if (settled) return;

        settled = true;

        reject(
          transaction.error ||
          createError('Offline storage transaction was cancelled.')
        );
      };
    });
  } finally {
    db.close();
  }
}

/**
 * Compare records when an idempotency key already exists.
 *
 * The same key must never silently represent a different operation.
 */
function stableJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }

  if (value && typeof value === 'object') {
    const normalized = {};

    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) {
        normalized[key] = stableJsonValue(value[key]);
      }
    }

    return normalized;
  }

  return value;
}

function isSameReading(existing, incoming) {
  try {
    return (
      existing.id === incoming.id &&
      existing.userId === incoming.userId &&
      existing.stationId === incoming.stationId &&
      existing.endpoint === incoming.endpoint &&
      JSON.stringify(stableJsonValue(existing.payload)) ===
        JSON.stringify(stableJsonValue(incoming.payload))
    );
  } catch {
    return false;
  }
}

/**
 * Queue a meter reading for later synchronization.
 *
 * Duplicate behavior:
 * - Same key + same user/station/endpoint/payload:
 *   Return the existing record without resetting its state.
 *
 * - Same key + different data:
 *   Reject instead of overwriting the existing reading.
 */
export async function queueMeterReading({
  userId,
  stationId,
  endpoint,
  payload,
}) {
  validateRecordInput({
    userId,
    stationId,
    endpoint,
    payload,
  });

  const id = payload.idempotencyKey;

  const record = {
    id,
    userId,
    stationId,
    endpoint,
    payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'pending',
    lastError: null,
    attemptCount: 0,
    nextAttemptAt: null,
  };

  return withStore('readwrite', (store) => {
    const existingRequest = store.get(id);

    existingRequest.onsuccess = () => {
      const existing = existingRequest.result;

      if (!existing) {
        store.add(record);
        return;
      }

      // Existing records are intentionally left unchanged. The comparison
      // below rejects a key that belongs to different content.
    };

    return existingRequest;
  }).then(async (existing) => {
    if (!existing) {
      return record;
    }

    if (!isSameReading(existing, record)) {
      throw createError(
        'This idempotency key already belongs to a different queued reading.',
        'ConstraintError'
      );
    }

    return existing;
  });
}

/**
 * List queued readings belonging to one user.
 *
 * Results are returned in chronological order.
 */
export async function listMeterReadings(userId) {
  if (!isNonEmptyString(userId)) {
    return [];
  }

  const records = await withStore('readonly', (store) => {
    return store.index('userId').getAll(userId);
  });

  return (records || []).sort((a, b) => {
    const timeA = Date.parse(a.createdAt) || 0;
    const timeB = Date.parse(b.createdAt) || 0;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Update permitted synchronization metadata.
 *
 * Immutable fields:
 * - id
 * - userId
 * - stationId
 * - endpoint
 * - payload
 * - createdAt
 *
 * Existing sync code can continue updating state and lastError.
 */
export async function updateMeterReading(id, patch = {}) {
  if (!isNonEmptyString(id)) {
    throw createError('A valid offline reading ID is required.');
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw createError('Invalid offline reading update.');
  }

  const allowedFields = new Set([
    'state',
    'lastError',
    'attemptCount',
    'nextAttemptAt',
    'updatedAt',
  ]);

  for (const key of Object.keys(patch)) {
    if (!allowedFields.has(key)) {
      throw createError(
        `Updating the offline reading field "${key}" is not permitted.`
      );
    }
  }

  const safePatch = { ...patch };

  if (
    safePatch.state !== undefined &&
    (
      typeof safePatch.state !== 'string' ||
      !VALID_STATES.has(safePatch.state)
    )
  ) {
    throw createError('Invalid offline reading state.');
  }

  if (safePatch.lastError !== undefined) {
    if (
      safePatch.lastError !== null &&
      typeof safePatch.lastError !== 'string'
    ) {
      throw createError('Invalid offline reading error message.');
    }

    if (typeof safePatch.lastError === 'string') {
      safePatch.lastError = safePatch.lastError.slice(
        0,
        MAX_ERROR_LENGTH
      );
    }
  }

  if (safePatch.attemptCount !== undefined) {
    if (
      !Number.isInteger(safePatch.attemptCount) ||
      safePatch.attemptCount < 0
    ) {
      throw createError('Invalid offline reading attempt count.');
    }
  }

  if (safePatch.nextAttemptAt !== undefined) {
    if (
      safePatch.nextAttemptAt !== null &&
      (
        typeof safePatch.nextAttemptAt !== 'string' ||
        Number.isNaN(Date.parse(safePatch.nextAttemptAt))
      )
    ) {
      throw createError('Invalid next retry timestamp.');
    }
  }

  safePatch.updatedAt = new Date().toISOString();

  return withStore('readwrite', (store) => {
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;

      if (!existing) {
        return;
      }

      const updatedRecord = {
        ...existing,
        ...safePatch,

        // Explicitly preserve immutable identity and payload fields.
        id: existing.id,
        userId: existing.userId,
        stationId: existing.stationId,
        endpoint: existing.endpoint,
        payload: existing.payload,
        createdAt: existing.createdAt,
      };

      store.put(updatedRecord);
    };

    return getRequest;
  }).then((existing) => {
    if (!existing) {
      return null;
    }

    return {
      ...existing,
      ...safePatch,
      id: existing.id,
      userId: existing.userId,
      stationId: existing.stationId,
      endpoint: existing.endpoint,
      payload: existing.payload,
      createdAt: existing.createdAt,
    };
  });
}

/**
 * Remove a single queued reading.
 */
export async function removeMeterReading(id) {
  if (!isNonEmptyString(id)) {
    return;
  }

  await withStore('readwrite', (store) => {
    return store.delete(id);
  });
}

/**
 * Clear only the selected user's queued readings.
 *
 * Other users' records are never removed.
 * All deletions happen in one IndexedDB transaction.
 */
export async function clearMeterReadingsForUser(userId) {
  if (!isNonEmptyString(userId)) {
    return 0;
  }

  const db = await openDb();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const index = store.index('userId');

      let deletedCount = 0;
      let settled = false;

      const request = index.openCursor(
        IDBKeyRange.only(userId)
      );

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          return;
        }

        cursor.delete();
        deletedCount += 1;

        cursor.continue();
      };

      request.onerror = () => {
        try {
          transaction.abort();
        } catch {
          // Ignore an already aborted transaction.
        }
      };

      transaction.oncomplete = () => {
        if (settled) return;

        settled = true;
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        if (settled) return;

        settled = true;

        reject(
          transaction.error ||
          createError('Could not clear the offline queue.')
        );
      };

      transaction.onabort = () => {
        if (settled) return;

        settled = true;

        reject(
          transaction.error ||
          createError('Clearing the offline queue was cancelled.')
        );
      };
    });
  } finally {
    db.close();
  }
}
