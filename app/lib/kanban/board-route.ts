const BOARD_KEY_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export function isBoardKey(value: string): boolean {
  return BOARD_KEY_PATTERN.test(value);
}

export function boardPath(routeKey: string): string {
  if (!isBoardKey(routeKey)) {
    throw new Error("Invalid board route key.");
  }

  return `/board/${routeKey}`;
}
