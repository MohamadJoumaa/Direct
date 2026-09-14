import React from "react";

import { AdminOrders } from "@/screens/admin-orders";
import { ClientHome } from "@/screens/client-home";
import { DriverHome } from "@/screens/driver-home";
import { useAuth } from "@/lib/auth-context";

/**
 * The home tab is whatever home means for the signed-in role. Dispatching here
 * rather than redirecting keeps a single tab route, so an admin switching
 * "view as" swaps the content without a navigation animation.
 */
export default function HomeTab() {
  const { effectiveRole } = useAuth();
  if (effectiveRole === "admin") return <AdminOrders />;
  if (effectiveRole === "driver") return <DriverHome />;
  return <ClientHome />;
}
