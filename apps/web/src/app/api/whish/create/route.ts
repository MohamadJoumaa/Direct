import { NextResponse } from "next/server";
import {
  callbackUrl,
  collectPayUrl,
  dashboardReturnUrl,
  getWhishEnv,
  parseCollectAmount,
  resolveAppOrigin,
} from "@/lib/whish-server";

/**
 * Creates a Whish Pay collect request. The secret stays on the server.
 * Without WHISH_CHANNEL / WHISH_SECRET the route reports "not configured"
 * and the client falls back to the manual pay-then-admin-confirm flow.
 */
export async function POST(req: Request) {
  const env = getWhishEnv();
  if (!env) {
    return NextResponse.json({ configured: false });
  }

  let body: { amount?: number; note?: string; returnOrigin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const amount = parseCollectAmount(body.amount);
  if (amount == null) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const externalId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const appOrigin = resolveAppOrigin(req, body.returnOrigin);

  try {
    const res = await fetch(`${env.baseUrl}/payment/whish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        channel: env.channel,
        secret: env.secret,
        websiteurl: env.websiteUrl,
      },
      body: JSON.stringify({
        amount,
        currency: "USD",
        invoice: body.note ?? "Direct driver subscription",
        externalId,
        successCallbackUrl: callbackUrl(appOrigin, externalId, "success"),
        failureCallbackUrl: callbackUrl(appOrigin, externalId, "failure"),
        successRedirectUrl: dashboardReturnUrl(appOrigin, externalId, "return"),
        failureRedirectUrl: dashboardReturnUrl(appOrigin, externalId, "failed"),
      }),
      cache: "no-store",
    });
    const data: unknown = await res.json().catch(() => null);
    const failed =
      !res.ok ||
      (data &&
        typeof data === "object" &&
        (data as { status?: boolean }).status === false);
    if (failed) {
      const message =
        data && typeof data === "object"
          ? (data as { dialog?: { message?: string } }).dialog?.message
          : undefined;
      return NextResponse.json(
        { error: message ?? "Whish rejected the request" },
        { status: 502 },
      );
    }
    const payUrl = collectPayUrl(data);
    return NextResponse.json({
      configured: true,
      externalId: String(externalId),
      collectUrl: payUrl,
      whishUrl: payUrl,
      whishId:
        data && typeof data === "object"
          ? ((data as { data?: { whishId?: string } }).data?.whishId ?? null)
          : null,
    });
  } catch {
    return NextResponse.json({ error: "Whish is unreachable" }, { status: 502 });
  }
}
