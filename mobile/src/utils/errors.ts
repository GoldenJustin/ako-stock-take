/**
 * Map technical ERPNext / network errors to short UI copy.
 * Full details always go to Metro / device logs via console.error.
 */

export function logTechnicalError(scope: string, err: unknown) {
  const raw = normalizeRaw(err);
  console.error(`[${scope}]`, raw);
  if (err && typeof err === 'object') {
    console.error(`[${scope}] object:`, JSON.stringify(err, null, 2).slice(0, 2000));
  }
}

function normalizeRaw(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'object' && (err as any).message) return String((err as any).message);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Short message safe for Toast / UI */
export function toUserMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const raw = normalizeRaw(err);
  const low = raw.toLowerCase();

  // Credentials
  if (
    low.includes('invalid login') ||
    low.includes('authenticationerror') ||
    low.includes('invalid credentials')
  ) {
    return 'Wrong email or password.';
  }

  // Not logged in / guest
  if (
    low.includes('not permitted') ||
    low.includes('login to access') ||
    low.includes('not whitelisted') ||
    low.includes('authentication required')
  ) {
    return 'Session expired or API not ready. Update server app and try again.';
  }

  // Module / install issues
  if (
    low.includes('modulenotfounderror') ||
    low.includes('no module named') ||
    low.includes('ako_stock_take.doctype') ||
    low.includes('ako_stock_take.do')
  ) {
    return 'Server app needs update. Run update-erpnext-app.sh on the server.';
  }

  // HTTP / gateway
  if (low.includes('504') || low.includes('gateway timeout')) {
    return 'Server timed out. Wait a minute and retry.';
  }
  if (low.includes('502') || low.includes('bad gateway')) {
    return 'Server gateway error. Restart backend container.';
  }
  if (low.includes('503')) {
    return 'Server busy. Try again shortly.';
  }
  if (low.includes('timeout') || low.includes('timed out') || low.includes('aborted')) {
    return 'Request timed out. Check connection and retry.';
  }
  if (low.includes('network request failed') || low.includes('cannot reach')) {
    return 'Cannot reach ERPNext. Check internet and server URL.';
  }
  if (low.includes('json parse') || low.includes('unexpected character')) {
    return 'Server returned an invalid response. Retry or check ERPNext.';
  }

  // Permission / roles
  if (low.includes('permission') || low.includes('not allowed')) {
    return 'No permission. Ask admin for Stock Take roles.';
  }

  // Keep short — strip traceback noise
  const firstLine = raw.split('\n')[0].replace(/<[^>]+>/g, '').trim();
  if (firstLine.length > 120) {
    return fallback;
  }
  // Avoid showing Python class names on screen
  if (/Error:|Traceback|File \"|exc_type/i.test(firstLine)) {
    return fallback;
  }
  return firstLine || fallback;
}

export class UserFacingError extends Error {
  technical: string;
  constructor(userMessage: string, technical?: string) {
    super(userMessage);
    this.name = 'UserFacingError';
    this.technical = technical || userMessage;
  }
}
