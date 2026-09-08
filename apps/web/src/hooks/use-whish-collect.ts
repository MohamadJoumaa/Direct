"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { WhishKind } from "@/lib/demo-store";
import { pendingApiWhishTx } from "@/lib/demo-store";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import {
  clearWhishReturnParams,
  openWhishPayUrl,
  pickWhishPayUrl,
  readWhishReturnParams,
} from "@/lib/whish-collect";

const POLL_MS = 4000;

type CreateResponse = {
  configured?: boolean;
  externalId?: string;
  collectUrl?: string | null;
  whishUrl?: string | null;
  error?: string;
};

type StatusResponse = {
  configured?: boolean;
  paid?: boolean;
  status?: string;
  error?: string;
};

export function useWhishCollect(opts: { kind: WhishKind; dueAmount: number }) {
  const { user } = useAuth();
  const { state, requestPay, confirmWhish } = useStore();
  const { dict } = useI18n();
  const [busy, setBusy] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const inFlight = useRef(false);
  const handledReturn = useRef(false);

  const pendingApiTx = user
    ? pendingApiWhishTx(state, user.id, opts.kind)
    : undefined;
  const pendingId = pendingApiTx?.id;
  const pendingExternalId = pendingApiTx?.external_id ?? null;
  const whishNumber = state.settings.whish_number;
  const liveStatus = pendingExternalId ? dict.driver.waitingForPayment : null;

  const checkStatus = useCallback(
    async (options?: { silent?: boolean; externalId?: string | null }) => {
      const externalId = options?.externalId ?? pendingExternalId;
      const txId = pendingId;
      if (!externalId && !txId) return false;
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        if (!externalId) {
          if (!options?.silent) toast.info(dict.driver.notPaidYet);
          return false;
        }
        const res = await fetch("/api/whish/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalId }),
        });
        const data = (await res.json()) as StatusResponse;
        if (!res.ok || data.error) {
          if (!options?.silent) {
            toast.error(data.error ?? dict.driver.couldNotCheckPayment);
          }
          return false;
        }
        if (data.configured === false) {
          setApiAvailable(false);
          if (!options?.silent) toast.info(dict.driver.whishNotConfigured);
          return false;
        }
        setApiAvailable(true);
        if (data.paid) {
          confirmWhish(txId ?? externalId);
          toast.success(
            opts.kind === "commission"
              ? dict.driver.commissionPaymentConfirmed
              : dict.driver.paymentConfirmed,
          );
          return true;
        }
        if (!options?.silent) toast.info(dict.driver.notPaidYet);
        return false;
      } catch {
        if (!options?.silent) toast.error(dict.driver.couldNotCheckPayment);
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [
      pendingExternalId,
      pendingId,
      confirmWhish,
      opts.kind,
      dict.driver.notPaidYet,
      dict.driver.whishNotConfigured,
      dict.driver.commissionPaymentConfirmed,
      dict.driver.paymentConfirmed,
      dict.driver.couldNotCheckPayment,
    ],
  );

  const payWithWhish = useCallback(async () => {
    if (!user) return;
    if (opts.kind === "commission" && opts.dueAmount <= 0) {
      toast.info(dict.driver.accruingTodayHint);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/whish/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: opts.dueAmount,
          returnOrigin: window.location.origin,
          note:
            opts.kind === "commission"
              ? `Direct commission — ${user.full_name}`
              : `Direct subscription — ${user.full_name}`,
        }),
      });
      const data = (await res.json()) as CreateResponse;
      if (data.configured === false) {
        setApiAvailable(false);
        toast.info(dict.driver.whishNotConfigured);
        return;
      }
      if (!res.ok || !data.externalId) {
        toast.error(data.error ?? dict.driver.whishCreateFailed);
        return;
      }
      setApiAvailable(true);
      requestPay(user.id, {
        source: "api",
        externalId: data.externalId,
        kind: opts.kind,
        amount: opts.dueAmount,
      });
      const payUrl = pickWhishPayUrl(data);
      if (payUrl) {
        toast.success(dict.driver.whishOpened);
        openWhishPayUrl(payUrl);
      } else {
        toast.info(dict.driver.whishOpenedNoUrl);
      }
    } catch {
      setApiAvailable(false);
      toast.info(dict.driver.whishUnreachable);
    } finally {
      setBusy(false);
    }
  }, [
    user,
    requestPay,
    opts.kind,
    opts.dueAmount,
    dict.driver.accruingTodayHint,
    dict.driver.whishNotConfigured,
    dict.driver.whishCreateFailed,
    dict.driver.whishOpened,
    dict.driver.whishOpenedNoUrl,
    dict.driver.whishUnreachable,
  ]);

  const logManualPaid = useCallback(() => {
    if (!user) return;
    if (opts.kind === "commission" && opts.dueAmount <= 0) {
      toast.info(dict.driver.accruingTodayHint);
      return;
    }
    requestPay(user.id, { kind: opts.kind, amount: opts.dueAmount });
    toast.success(dict.driver.paidLogged);
  }, [
    user,
    requestPay,
    opts.kind,
    opts.dueAmount,
    dict.driver.accruingTodayHint,
    dict.driver.paidLogged,
  ]);

  useEffect(() => {
    if (!pendingExternalId) return;
    const tick = () => {
      void checkStatus({ silent: true });
    };
    const start = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pendingExternalId, checkStatus]);

  useEffect(() => {
    if (handledReturn.current) return;
    const { result, externalId } = readWhishReturnParams();
    if (!result && !externalId) return;
    handledReturn.current = true;
    clearWhishReturnParams();
    if (result === "failed") {
      toast.info(dict.driver.whishPayFailed);
    }
    const t = window.setTimeout(() => {
      void checkStatus({
        silent: result === "failed",
        externalId,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [checkStatus, dict.driver.whishPayFailed]);

  return {
    busy,
    apiAvailable,
    liveStatus,
    pendingApiTx,
    whishNumber,
    payWithWhish,
    checkStatus: () => checkStatus({ silent: false }),
    logManualPaid,
  };
}
