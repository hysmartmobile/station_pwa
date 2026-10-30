const configuredBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '';

const trimmedBase = configuredBase.trim().replace(/\/+$/, '');

const BASE = trimmedBase
  ? (/\/api$/i.test(trimmedBase) ? trimmedBase : `${trimmedBase}/api`)
  : (import.meta.env.DEV ? 'http://localhost:3001/api' : '');

export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
  if (!BASE) {
    throw new Error(
      'The API URL is not configured for this deployment. Set VITE_API_URL before building the production app.'
    );
  }

  const response = await fetch(`${BASE}${path}`, {
    method, signal,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const serverMessage = payload?.error?.message || `Request failed (${response.status})`;
    const requestId = payload?.error?.requestId || response.headers.get('X-Request-Id') || null;
    // Include the correlation ID in the visible message: users can now give support
    // the exact request that failed instead of seeing an unhelpful generic error.
    const error = new Error(requestId ? `${serverMessage} (Request ID: ${requestId})` : serverMessage);
    error.status = response.status;
    error.code = payload?.error?.code;
    error.requestId = requestId;
    if (error.code === 'TRIAL_EXPIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hysmart:trial-expired', { detail: { message: error.message } }));
    }
    throw error;
  }
  return payload.data ?? payload;
}
