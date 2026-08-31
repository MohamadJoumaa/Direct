import { NextResponse } from "next/server";

/**
 * Creates a Whish Pay collect request. The secret stays on the server.
 * Without WHISH_CHANNEL / WHISH_SECRET the route reports "not configured"
 * and the client falls back to the manual pay-then-admin-confirm flow.
 */
export async function POST(req: Request) {
  const channel = process.env.WHISH_CHANNEL;
  const secret = process.env.WHISH_SECRET;
  const websiteUrl = process.env.WHISH_WEBSITE_URL ?? "https://direct.delivery";
  const baseUrl =
    process.env.WHISH_BASE_URL ?? "https://lb.sandbox.whish.money/itel-service/api";

  if (!channel || !secret) {
    return NextResponse.json({ configured: false });
  }

  let body: { amount?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const externalId = Date.now();

  try {
    const res = await fetch(`${baseUrl}/payment/whish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        channel,
        secret,
        websiteurl: websiteUrl,
      },
      body: JSON.stringify({
        amount,
        currency: "USD",
        invoice: body.note ?? "Direct driver subscription",
        externalId,
        successCallbackUrl: `${websiteUrl}/api/whish/status`,
        failureCallbackUrl: `${websiteUrl}/api/whish/status`,
        successRedirectUrl: websiteUrl,
        failureRedirectUrl: websiteUrl,
      }),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || data?.status === false) {
      return NextResponse.json(
        { error: data?.dialog?.message ?? "Whish rejected the request" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      configured: true,
      externalId: String(externalId),
      collectUrl: data?.data?.collectUrl ?? null,
      whishId: data?.data?.whishId ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Whish is unreachable" }, { status: 502 });
  }
}
