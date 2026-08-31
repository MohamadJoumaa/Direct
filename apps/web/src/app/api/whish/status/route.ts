import { NextResponse } from "next/server";

/** Checks a Whish collect request. Returns { paid: boolean }. */
export async function POST(req: Request) {
  const channel = process.env.WHISH_CHANNEL;
  const secret = process.env.WHISH_SECRET;
  const websiteUrl = process.env.WHISH_WEBSITE_URL ?? "https://direct.delivery";
  const baseUrl =
    process.env.WHISH_BASE_URL ?? "https://lb.sandbox.whish.money/itel-service/api";

  if (!channel || !secret) {
    return NextResponse.json({ configured: false, paid: false });
  }

  let body: { externalId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const externalId = Number(body.externalId);
  if (!Number.isFinite(externalId)) {
    return NextResponse.json({ error: "Invalid externalId" }, { status: 400 });
  }

  try {
    const res = await fetch(`${baseUrl}/payment/collect/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        channel,
        secret,
        websiteurl: websiteUrl,
      },
      body: JSON.stringify({ currency: "USD", externalId }),
      cache: "no-store",
    });
    const data = await res.json();
    const status: string | undefined = data?.data?.collectStatus;
    return NextResponse.json({
      configured: true,
      paid: status === "success",
      status: status ?? "unknown",
    });
  } catch {
    return NextResponse.json({ error: "Whish is unreachable" }, { status: 502 });
  }
}
