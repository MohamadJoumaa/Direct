import Constants from "expo-constants";
import { WHISH_MAX_AMOUNT_USD, isWhishCollectPaid } from "@direct/shared";
import type { WhishKind } from "@direct/core";

/**
 * Mobile side of the Whish Pay contract.
 *
 * The channel and secret live on the web deployment and never ship in this
 * bundle, so every call goes through the existing `/api/whish/*` routes -- the
 * same single collect surface the website uses. See
 * `packages/shared/src/payment-rules.md`; the rules there are binding here.
 */
export type CreateCollectResult =
  | { ok: true; configured: true; externalId: string; payUrl: string | null }
  | { ok: true; configured: false }
  | { ok: false; error: "unreachable" | "rejected" };

export type CollectStatusResult =
  | { ok: true; configured: boolean; paid: boolean; status: string | null }
  | { ok: false; error: "unreachable" };

const REQUEST_TIMEOUT_MS = 12_000;

export function webOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const extra = Constants.expoConfig?.extra as { webUrl?: string } | undefined;
  return (extra?.webUrl ?? "").replace(/\/+$/, "");
}

async function postJson(path: string, body: unknown): Promise<unknown | null> {
  const origin = webOrigin();
  if (!origin) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    if (!res.ok && res.status !== 200) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Whish caps a single collect; subscription + penalty + backlog must all fit. */
export function isPayableAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= WHISH_MAX_AMOUNT_USD;
}

export async function createCollect(
  amountUsd: number,
  kind: WhishKind,
): Promise<CreateCollectResult> {
  if (!isPayableAmount(amountUsd)) return { ok: false, error: "rejected" };

  const data = await postJson("/api/whish/create", {
    amount: amountUsd,
    note:
      kind === "commission" ? "Direct company commission" : "Direct driver subscription",
  });
  if (data == null || typeof data !== "object") return { ok: false, error: "unreachable" };

  const body = data as {
    configured?: boolean;
    externalId?: string;
    collectUrl?: string | null;
    whishUrl?: string | null;
    error?: string;
  };
  if (body.error) return { ok: false, error: "rejected" };
  // No channel/secret on the web deployment: the UI must fall back to the
  // manual "I already paid" flow, never pretend the collect succeeded.
  if (body.configured === false) return { ok: true, configured: false };
  if (!body.externalId) return { ok: false, error: "rejected" };

  return {
    ok: true,
    configured: true,
    externalId: String(body.externalId),
    payUrl: body.collectUrl ?? body.whishUrl ?? null,
  };
}

/**
 * Re-verifies a collect by `externalId`.
 *
 * `paid` is only ever true when the server said so *and* the raw status string
 * is exactly "success". Redirect params, deep links, and a browser that simply
 * closed prove nothing and never reach this function.
 */
export async function checkCollectStatus(externalId: string): Promise<CollectStatusResult> {
  const data = await postJson("/api/whish/status", { externalId });
  if (data == null || typeof data !== "object") return { ok: false, error: "unreachable" };

  const body = data as { configured?: boolean; paid?: boolean; status?: string | null };
  const status = body.status ?? null;
  return {
    ok: true,
    configured: body.configured !== false,
    paid: body.paid === true && isWhishCollectPaid(status),
    status,
  };
}
