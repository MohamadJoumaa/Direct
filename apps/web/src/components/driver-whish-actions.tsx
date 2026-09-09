"use client";

import { Loader2 } from "lucide-react";
import type { WhishKind } from "@/lib/demo-store";
import { Button } from "@/components/ui/button";
import { useWhishCollect } from "@/hooks/use-whish-collect";
import { fmt, useI18n } from "@/lib/i18n";

export function DriverWhishActions({
  kind,
  dueAmount,
  disabled,
}: {
  kind: WhishKind;
  dueAmount: number;
  disabled?: boolean;
}) {
  const { dict } = useI18n();
  const pay = useWhishCollect({ kind, dueAmount });
  const amountBlocked = kind === "commission" && dueAmount <= 0;
  const busy = pay.busy || disabled;
  const showManual =
    pay.apiAvailable !== true || !pay.pendingApiTx;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="touch-target h-12 rounded-full px-6 text-base font-semibold"
          disabled={busy || amountBlocked}
          aria-busy={pay.busy}
          onClick={() => void pay.payWithWhish()}
        >
          {pay.busy ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex size-5 animate-spin items-center justify-center">
                <Loader2 className="size-5" aria-hidden />
              </span>
              {dict.driver.checkingPayment}
            </span>
          ) : (
            dict.driver.payWithWhish
          )}
        </Button>
        {pay.pendingApiTx ? (
          <Button
            size="lg"
            variant="outline"
            className="touch-target h-12 rounded-full px-6 text-base font-semibold"
            disabled={busy}
            onClick={() => void pay.checkStatus()}
          >
            {dict.driver.checkPayment}
          </Button>
        ) : null}
        {showManual ? (
          <Button
            size="lg"
            variant="outline"
            className="touch-target h-12 rounded-full px-6 text-base font-semibold"
            disabled={busy || amountBlocked}
            onClick={pay.logManualPaid}
          >
            {dict.driver.iPaid}
          </Button>
        ) : null}
      </div>
      {pay.liveStatus ? (
        <p role="status" aria-atomic="true" className="text-base text-muted-foreground">
          {pay.liveStatus}
        </p>
      ) : null}
      <p className="text-base text-muted-foreground">
        {fmt(dict.driver.whishSupportNumber, { number: pay.whishNumber })}
      </p>
    </div>
  );
}
