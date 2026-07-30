type AttemptRecord = {
  failures: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
const attempts = new Map<string, AttemptRecord>();

export function isLoginRateLimited(key: string, now = Date.now()): boolean {
  const record = attempts.get(key);

  if (!record || record.resetAt <= now) {
    attempts.delete(key);
    return false;
  }

  return record.failures >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const record = attempts.get(key);

  if (!record || record.resetAt <= now) {
    attempts.set(key, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }

  record.failures += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}

export function resetLoginRateLimiter(): void {
  attempts.clear();
}
