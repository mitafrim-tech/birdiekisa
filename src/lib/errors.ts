/**
 * Map raw Supabase / PostgREST / unknown errors into safe,
 * user-facing strings. Never surface schema details, constraint names,
 * or internal status text to end users.
 */

type MaybeCoded = { code?: string; message?: string };

function getCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as MaybeCoded).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

function knownMessage(err: unknown): string | undefined {
  // Allow our own RPC errors that we authored ourselves to pass through.
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as MaybeCoded).message;
    if (typeof m === "string") {
      if (m === "Not authenticated") return "Kirjaudu sisään";
      if (m === "Not authorized") return "Ei oikeuksia";
      if (m === "Invalid join code") return "Virheellinen kutsulinkki";
    }
  }
  return undefined;
}

export function toUserMessage(err: unknown, fallback = "Toiminto epäonnistui"): string {
  // Log full details for developers; never to UI.
  if (typeof console !== "undefined") console.error(err);

  const known = knownMessage(err);
  if (known) return known;

  const code = getCode(err);
  switch (code) {
    case "23505":
      return "Tietue on jo olemassa";
    case "23503":
      return "Liitettyä tietoa puuttuu";
    case "23514":
      return "Tiedot eivät kelpaa";
    case "42501":
      return "Ei oikeuksia";
    case "PGRST301":
    case "PGRST302":
      return "Kirjaudu sisään";
    default:
      return fallback;
  }
}