import { NextResponse } from "next/server";
import {
  dashboardReturnUrl,
  fetchCollectStatus,
  getWhishEnv,
  parseExternalId,
  redirectBaseOrigin,
} from "@/lib/whish-server";

/**
 * Whish success/failure callback. Never unlocks from the callback alone —
 * re-checks POST /payment/collect/status, then sends the driver back to the app.
 * Demo-store activation still happens in the client after a paid status poll.
 */
async function handleCallback(req: Request) {
  const url = new URL(req.url);
  let externalRaw: unknown = url.searchParams.get("externalId");

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/json")) {
        const body = (await req.json()) as Record<string, unknown>;
        externalRaw = body.externalId ?? body.external_id ?? externalRaw;
      } else {
        const form = await req.formData();
        externalRaw =
          form.get("externalId") ?? form.get("external_id") ?? externalRaw;
      }
    } catch {
      /* keep query value */
    }
  }

  const externalId = parseExternalId(externalRaw);
  const appOrigin = redirectBaseOrigin(req);
  if (externalId == null) {
    return NextResponse.redirect(
      new URL("/app/driver/dashboard?whish=failed", appOrigin),
      303,
    );
  }

  const hint = url.searchParams.get("result") === "failure" ? "failed" : "return";
  const env = getWhishEnv();
  if (!env) {
    return NextResponse.redirect(
      dashboardReturnUrl(appOrigin, externalId, hint),
      303,
    );
  }

  try {
    const result = await fetchCollectStatus(env, externalId);
    return NextResponse.redirect(
      dashboardReturnUrl(
        appOrigin,
        externalId,
        result.paid ? "paid" : hint === "failed" ? "failed" : "pending",
      ),
      303,
    );
  } catch {
    return NextResponse.redirect(
      dashboardReturnUrl(appOrigin, externalId, hint),
      303,
    );
  }
}

export async function GET(req: Request) {
  return handleCallback(req);
}

export async function POST(req: Request) {
  return handleCallback(req);
}
