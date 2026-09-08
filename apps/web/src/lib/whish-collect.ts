/** Client helpers for Whish Pay merchant collect (not P2P). */

const RETURN_KEY = "direct-whish-return";

export function pickWhishPayUrl(data: {
  collectUrl?: string | null;
  whishUrl?: string | null;
}): string | null {
  for (const value of [data.collectUrl, data.whishUrl]) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

export function openWhishPayUrl(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

type WhishReturn = { result: string | null; externalId: string | null };

export function readWhishReturnParams(): WhishReturn {
  const params = new URLSearchParams(window.location.search);
  const fromUrl: WhishReturn = {
    result: params.get("whish"),
    externalId: params.get("externalId"),
  };
  if (fromUrl.result || fromUrl.externalId) {
    try {
      sessionStorage.setItem(RETURN_KEY, JSON.stringify(fromUrl));
    } catch {
      /* ignore quota / private mode */
    }
    params.delete("whish");
    params.delete("externalId");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    );
    return fromUrl;
  }
  try {
    const stored = sessionStorage.getItem(RETURN_KEY);
    if (stored) return JSON.parse(stored) as WhishReturn;
  } catch {
    /* ignore */
  }
  return { result: null, externalId: null };
}

export function clearWhishReturnParams() {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
}

