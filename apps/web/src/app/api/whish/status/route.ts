import { NextResponse } from "next/server";
import {
  fetchCollectStatus,
  getWhishEnv,
  parseExternalId,
} from "@/lib/whish-server";

/** Checks a Whish collect request. Returns { paid: boolean }. */
export async function POST(req: Request) {
  const env = getWhishEnv();
  if (!env) {
    return NextResponse.json({ configured: false, paid: false });
  }

  let body: { externalId?: string | number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const externalId = parseExternalId(body.externalId);
  if (externalId == null) {
    return NextResponse.json({ error: "Invalid externalId" }, { status: 400 });
  }

  try {
    const result = await fetchCollectStatus(env, externalId);
    return NextResponse.json({
      configured: true,
      paid: result.paid,
      status: result.status,
    });
  } catch {
    return NextResponse.json({ error: "Whish is unreachable" }, { status: 502 });
  }
}

/**
 * Whish may GET the callback URL. This JSON poll endpoint is not a payment
 * callback — forward to the handler that re-verifies collect status.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dest = new URL("/api/whish/callback", url.origin);
  url.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
  return NextResponse.redirect(dest, 303);
}
