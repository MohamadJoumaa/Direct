"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Driver, DriverAccountAction } from "@/lib/demo-store";
import type { Dictionary } from "@/lib/i18n/en";

export function DriverAccountActions({
  driver,
  dict,
  size = "sm",
  setDriverAccountAction,
  setDriverPaymentWaived,
}: {
  driver: Driver;
  dict: Dictionary;
  size?: "sm" | "lg";
  setDriverAccountAction: (driverId: string, action: DriverAccountAction) => string | undefined;
  setDriverPaymentWaived: (driverId: string, waived: boolean) => string | undefined;
}) {
  const payFrozen = driver.subscription_status === "frozen" && !driver.payment_waived;
  const showUnfreeze = driver.admin_frozen || payFrozen;

  function run(action: DriverAccountAction, ok: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const err = setDriverAccountAction(driver.id, action);
    if (err) toast.error(err);
    else toast.success(ok);
  }

  function toggleWaiver() {
    const next = !driver.payment_waived;
    const err = setDriverPaymentWaived(driver.id, next);
    if (err) toast.error(err);
    else toast.success(next ? dict.admin.paymentWaivedToast : dict.admin.paymentRequiredToast);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showUnfreeze ? (
        <Button
          size={size}
          variant="outline"
          className="touch-target rounded-full"
          onClick={() => run("unfreeze", dict.admin.driverUnfrozenToast)}
        >
          {dict.admin.unfreezeDriver}
        </Button>
      ) : (
        <Button
          size={size}
          variant="outline"
          className="touch-target rounded-full"
          disabled={driver.banned}
          onClick={() => run("freeze", dict.admin.driverFrozenToast, dict.admin.confirmFreeze)}
        >
          {dict.admin.freezeDriver}
        </Button>
      )}
      {driver.banned ? (
        <Button
          size={size}
          variant="outline"
          className="touch-target rounded-full"
          onClick={() => run("unban", dict.admin.driverUnbannedToast)}
        >
          {dict.admin.unbanDriver}
        </Button>
      ) : (
        <Button
          size={size}
          variant="destructive"
          className="touch-target rounded-full"
          onClick={() => run("ban", dict.admin.driverBannedToast, dict.admin.confirmBan)}
        >
          {dict.admin.banDriver}
        </Button>
      )}
      <Button
        size={size}
        variant={driver.payment_waived ? "secondary" : "outline"}
        className="touch-target rounded-full"
        onClick={toggleWaiver}
      >
        {driver.payment_waived ? dict.admin.revokeUnpaidAccess : dict.admin.allowUnpaidAccess}
      </Button>
    </div>
  );
}
