/**
 * Friendly UI errors; details go to Metro logs.
 */

export function logTechnicalError(scope: string, err: unknown) {
  const raw = normalizeRaw(err);
  const low = raw.toLowerCase();
  // Don't dump scary red stacks for expected gateway blips during demos
  if (
    low.includes('504') ||
    low.includes('502') ||
    low.includes('gateway') ||
    low.includes('timed out') ||
    low.includes('timeout')
  ) {
    console.log(`[${scope}] ${raw}`);
    return;
  }
  console.log(`[${scope}] ${raw}`);
}

function normalizeRaw(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'object' && (err as any).message) return String((err as any).message);
  if (typeof err === 'object' && (err as any).technical) return String((err as any).technical);
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

  if (
    low.includes('invalid login') ||
    low.includes('authenticationerror') ||
    low.includes('invalid credentials')
  ) {
    return 'Wrong email or password.';
  }

  if (
    low.includes('not permitted') ||
    low.includes('login to access') ||
    low.includes('not whitelisted') ||
    low.includes('authentication required')
  ) {
    return 'Session expired. Please sign in again.';
  }

  if (
    low.includes('modulenotfounderror') ||
    low.includes('no module named') ||
    low.includes('ako_stock_take.doctype')
  ) {
    return 'Server app needs an update. Contact admin.';
  }

  if (low.includes('504') || low.includes('gateway timeout')) {
    return 'Server is waking up (timeout). Wait ~20s and try again.';
  }
  if (low.includes('502') || low.includes('bad gateway')) {
    return 'Server is restarting. Try again in a moment.';
  }
  if (low.includes('503')) {
    return 'Server busy. Try again shortly.';
  }
  if (low.includes('timeout') || low.includes('timed out') || low.includes('aborted')) {
    return 'Request timed out. Try again.';
  }
  if (low.includes('network request failed') || low.includes('cannot reach')) {
    return 'No connection to ERPNext. Check internet.';
  }
  if (low.includes('json parse') || low.includes('unexpected character')) {
    return 'Bad response from server. Retry.';
  }
  if (low.includes('permission') || low.includes('not allowed')) {
    return 'No permission for stock take. Ask admin for roles.';
  }

  const firstLine = raw.split('\n')[0].replace(/<[^>]+>/g, '').trim();
  if (firstLine.length > 110 || /Error:|Traceback|exc_type/i.test(firstLine)) {
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
