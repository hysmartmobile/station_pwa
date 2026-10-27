const configuredBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Accept a host, /api, or legacy /api/v1 base URL without ever creating
// duplicated paths such as /api/v1/api/me. This API currently mounts routes
// under /api (not /api/v1), so normalize every configuration to that root.
function normalizeApiBase(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  const withoutLegacyVersion = trimmed.replace(/\/api\/v1$/i, '').replace(/\/v1$/i, '');
  const withoutApi = withoutLegacyVersion.replace(/\/api$/i, '');
  return `${withoutApi}/api`;
}
const BASE = normalizeApiBase(configuredBase);

export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
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
