import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { WhishKind } from "@direct/core";

import { checkCollectStatus, createCollect } from "@/lib/whish";

const POLL_MS = 4_000;
/** Stop polling after ~4 minutes; the driver can re-check by hand after that. */
const MAX_POLLS = 60;

export type WhishPhase =
  | "idle"
  | "creating"
  | "awaiting"
  | "checking"
  | "paid"
  | "unconfigured"
  | "error";

export type WhishOutcome = {
  phase: WhishPhase;
  externalId: string | null;
  /** Dictionary key-independent reason, mapped to copy by the screen. */
  reason:
    | null
    | "not_configured"
    | "unreachable"
    | "create_failed"
    | "not_paid_yet"
    | "check_failed";
};

/**
 * Create → open → poll → confirm, mirroring the website's hook.
 *
 * The single rule this enforces: `onPaid` fires only after
 * `checkCollectStatus` re-verifies the collect by `externalId` and the raw
 * status is exactly "success". Closing the browser, a redirect, or a callback
 * never unlocks anything on its own.
 */
export function useWhishCollect({
  onCreated,
  onPaid,
}: {
  /** Called once the collect exists, so a pending tx can be logged. */
  onCreated?: (externalId: string) => void;
  onPaid: (externalId: string) => void;
}) {
  const [state, setState] = useState<WhishOutcome>({
    phase: "idle",
    externalId: null,
    reason: null,
  });

  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const verify = useCallback(
    async (externalId: string, quiet: boolean): Promise<boolean> => {
      if (!quiet) setState((s) => ({ ...s, phase: "checking" }));
      const result = await checkCollectStatus(externalId);
      if (!alive.current) return false;

      if (!result.ok) {
        setState((s) => ({ ...s, phase: quiet ? s.phase : "error", reason: "unreachable" }));
        return false;
      }
      if (result.paid) {
        setState({ phase: "paid", externalId, reason: null });
        onPaidRef.current(externalId);
        return true;
      }
      setState((s) => ({
        ...s,
        phase: quiet ? s.phase : "awaiting",
        reason: quiet ? s.reason : "not_paid_yet",
      }));
      return false;
    },
    [],
  );

  const poll = useCallback(
    (externalId: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void (async () => {
          polls.current += 1;
          const done = await verify(externalId, true);
          if (!done && alive.current && polls.current < MAX_POLLS) poll(externalId);
        })();
      }, POLL_MS);
    },
    [verify],
  );

  /** Re-check the moment the driver comes back from the Whish page. */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      setState((s) => {
        if (s.externalId && (s.phase === "awaiting" || s.phase === "checking")) {
          void verify(s.externalId, true);
        }
        return s;
      });
    });
    return () => sub.remove();
  }, [verify]);

  const start = useCallback(
    async (amountUsd: number, kind: WhishKind) => {
      polls.current = 0;
      setState({ phase: "creating", externalId: null, reason: null });

      const created = await createCollect(amountUsd, kind);
      if (!alive.current) return;

      if (!created.ok) {
        setState({
          phase: "error",
          externalId: null,
          reason: created.error === "unreachable" ? "unreachable" : "create_failed",
        });
        return;
      }
      if (!created.configured) {
        setState({ phase: "unconfigured", externalId: null, reason: "not_configured" });
        return;
      }

      onCreated?.(created.externalId);
      setState({ phase: "awaiting", externalId: created.externalId, reason: null });

      if (created.payUrl) {
        // An in-app browser keeps the driver inside Direct; whatever it returns
        // is discarded, because only the status re-check can unlock.
        try {
          await WebBrowser.openBrowserAsync(created.payUrl);
        } catch {
          // Falls through to polling: they may have paid in the Whish app.
        }
        if (!alive.current) return;
        await verify(created.externalId, true);
      }

      poll(created.externalId);
    },
    [onCreated, poll, verify],
  );

  const check = useCallback(async () => {
    if (!state.externalId) return;
    await verify(state.externalId, false);
  }, [state.externalId, verify]);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    polls.current = 0;
    setState({ phase: "idle", externalId: null, reason: null });
  }, []);

  return { ...state, start, check, reset };
}
