"use client";

import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/demo-store";
import { useI18n } from "@/lib/i18n";
import { filterOrdersByQuery, ORDER_SEARCH_THRESHOLD } from "@/lib/order-search";

export function useOrderSearch<T extends Order>(
  orders: T[],
  extra?: (order: T) => string[],
) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const showSearch = orders.length > ORDER_SEARCH_THRESHOLD;
  const filtered = showSearch ? filterOrdersByQuery(orders, deferredQuery, extra) : orders;
  return { query, setQuery, showSearch, filtered };
}

export function OrderSearchField({
  show,
  value,
  onChange,
}: {
  show: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const { dict } = useI18n();
  if (!show) return null;
  return (
    <div className="relative max-w-md">
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={dict.common.searchOrders}
        aria-label={dict.common.searchOrders}
        autoComplete="off"
        className="h-11 ps-9"
      />
    </div>
  );
}
