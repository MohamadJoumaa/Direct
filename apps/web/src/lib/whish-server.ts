/**
 * Server-only Whish Pay (merchant collect) helpers.
 * Verification is collect + /payment/collect/status by externalId — never P2P phone inquiry.
 */

export const WHISH_MAX_AMOUNT_USD = 10_000;

export type WhishEnv = {
  channel: string;
  secret: string;
  websiteUrl: string;
  baseUrl: string;
};

export function getWhishEnv(): WhishEnv | null {
  const channel = process.env.WHISH_CHANNEL;
  const secret = process.env.WHISH_SECRET;
  if (!channel || !secret) return null;
  return {
    channel,
    secret,
    websiteUrl: process.env.WHISH_WEBSITE_URL ?? "https://direct.delivery",
    baseUrl:
      process.env.WHISH_BASE_URL ??
      "https://lb.sandbox.whish.money/itel-service/api",
  };
}

export function parseCollectAmount(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > WHISH_MAX_AMOUNT_USD) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

export function originFromRequest(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}

/** Redirects must stay on this app (or the configured public site). */
export function resolveAppOrigin(req: Request, clientOrigin?: string): string {
  const requestOrigin = originFromRequest(req);
  const envOrigin = process.env.WHISH_WEBSITE_URL;
  const allowed = new Set(
    [requestOrigin, envOrigin].filter((v): v is string => Boolean(v)),
  );
  if (clientOrigin) {
    try {
      const origin = new URL(clientOrigin).origin;
      if (allowed.has(origin)) return origin;
    } catch {
      /* ignore invalid */
    }
  }
  return envOrigin || requestOrigin;
}

export function collectPayUrl(payload: unknown): string | null {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const data =
    root?.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  if (!data) return null;
  for (const key of ["collectUrl", "whishUrl", "url", "paymentUrl", "payUrl"]) {
    const value = data[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

export function parseExternalId(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function fetchCollectStatus(
  env: WhishEnv,
  externalId: number,
): Promise<{ paid: boolean; status: string }> {
  const res = await fetch(`${env.baseUrl}/payment/collect/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      channel: env.channel,
      secret: env.secret,
      websiteurl: env.websiteUrl,
    },
    body: JSON.stringify({ currency: "USD", externalId }),
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  const status =
    data && typeof data === "object"
      ? (data as { data?: { collectStatus?: string } }).data?.collectStatus
      : undefined;
  return {
    paid: status === "success",
    status: status ?? "unknown",
  };
}

export function dashboardReturnUrl(
  appOrigin: string,
  externalId: number,
  result: "return" | "failed" | "paid" | "pending",
): string {
  const dest = new URL("/app/driver/dashboard", appOrigin);
  dest.searchParams.set("whish", result);
  dest.searchParams.set("externalId", String(externalId));
  return dest.toString();
}

export function callbackUrl(
  appOrigin: string,
  externalId: number,
  result: "success" | "failure",
): string {
  const dest = new URL("/api/whish/callback", appOrigin);
  dest.searchParams.set("externalId", String(externalId));
  dest.searchParams.set("result", result);
  return dest.toString();
}
