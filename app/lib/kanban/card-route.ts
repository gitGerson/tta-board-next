const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CARD_KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function cardKey(cardId: string): string {
  if (!UUID_PATTERN.test(cardId)) {
    throw new Error("Invalid card ID.");
  }

  const bytes = cardId
    .replaceAll("-", "")
    .match(/.{2}/g)!
    .map((hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .join("");

  return btoa(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function cardIdFromKey(key: string): string | null {
  if (!CARD_KEY_PATTERN.test(key)) return null;

  try {
    const bytes = atob(
      key.replaceAll("-", "+").replaceAll("_", "/") + "==",
    );
    const hex = Array.from(bytes, (byte) =>
      byte.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
    const cardId = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");

    return UUID_PATTERN.test(cardId) ? cardId : null;
  } catch {
    return null;
  }
}

export function cardPath(cardId: string): string {
  return `/c/${cardKey(cardId)}`;
}
