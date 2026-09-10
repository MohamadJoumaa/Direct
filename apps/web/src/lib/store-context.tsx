"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CompanySettings, DriverType, UserRole } from "@direct/shared";
import * as demo from "@/lib/demo-store";
import { measureDriverLegs, measureRouteKm } from "@/lib/route-distance";

type StoreContextValue = {
  ready: boolean;
  state: demo.DemoState;
  reset: () => void;
  register: (input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    business_name?: string;
    business_address?: string;
    business_lat?: number;
    business_lng?: number;
    driver_type?: DriverType;
  }) => string | undefined;
  login: (identifier: string, password: string) => string | undefined;
  logout: () => void;
  setViewingAs: (role: UserRole | null) => void;
  createOrder: (
    clientId: string,
    input: {
      pickup_address: string;
      pickup_lat: number;
      pickup_lng: number;
      dropoff_address: string;
      dropoff_lat: number;
      dropoff_lng: number;
      product_description: string;
    },
  ) => Promise<{ error?: string; orderNumber?: number }>;
  claimOrder: (orderId: string, driverId: string) => string | undefined;
  declineOffer: (orderId: string, driverId: string) => string | undefined;
  advanceOrder: (
    orderId: string,
    actorId: string,
    action: "picked_up" | "at_warehouse" | "in_transit" | "arrived",
  ) => string | undefined;
  confirmDelivery: (
    orderId: string,
    userId: string,
    who: "client" | "driver",
    stars?: number,
  ) => string | undefined;
  reportClient: (orderId: string, reporterId: string, reason: string) => string | undefined;
  resolveReport: (reportId: string, upheld: boolean) => void;
  updateLocation: (driverId: string, lat: number, lng: number) => void;
  setOnline: (driverId: string, online: boolean, lat?: number, lng?: number) => string | undefined;
  requestPay: (driverId: string, opts?: demo.RequestPayOpts) => void;
  confirmWhish: (txId: string) => void;
  updateSettings: (settings: Partial<CompanySettings>) => void;
  addDocument: (
    driverId: string,
    doc_type: "selfie" | "id" | "vehicle_registration" | "driver_license",
    file_name: string,
    file_data?: string,
  ) => void;
  approveDocument: (docId: string, approve: boolean) => void;
  markNotificationRead: (notifId: string) => void;
  addCheckin: (
    orderId: string,
    driverId: string,
    status: "on_time" | "late" | "missed",
    note: string,
  ) => void;
  updateBusinessOrderCosts: (
    businessId: string,
    input: {
      order_min_usd: number;
      order_max_usd: number;
      order_min_lbp: number;
      order_max_lbp: number;
    },
  ) => string | undefined;
  updateProfile: (
    userId: string,
    input: {
      full_name?: string;
      phone?: string;
      email?: string;
      business_name?: string;
      business_address?: string;
      business_lat?: number;
      business_lng?: number;
      avatar_url?: string;
    },
  ) => string | undefined;
  cancelOrder: (orderId: string, clientId: string) => string | undefined;
  rejectOrder: (orderId: string) => string | undefined;
  addDriver: (input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    driver_type?: DriverType;
  }) => string | undefined;
  removeDriver: (driverId: string) => string | undefined;
  setDriverAccountAction: (
    driverId: string,
    action: demo.DriverAccountAction,
  ) => string | undefined;
  setDriverPaymentWaived: (driverId: string, waived: boolean) => string | undefined;
  setDriverRevenueMode: (driverId: string, mode: demo.Driver["revenue_mode"]) => string | undefined;
  addWarehouse: (input: { name: string; address: string; lat: number; lng: number }) => void;
  removeWarehouse: (warehouseId: string) => string | undefined;
  addWarehouseProduct: (input: {
    warehouse_id: string;
    name: string;
    quantity: number;
    note?: string;
  }) => void;
  removeWarehouseProduct: (productId: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

async function measurePendingLegs(current: demo.DemoState) {
  const pending = demo.pendingDispatchOrders(current);
  const points = demo.dispatchDriverPoints(current);
  const legsByOrder = new Map<string, Awaited<ReturnType<typeof measureDriverLegs>>>();
  await Promise.all(
    pending.map(async (order) => {
      const legs = await measureDriverLegs(
        points,
        { lat: order.pickup_lat, lng: order.pickup_lng },
        { lat: order.dropoff_lat, lng: order.dropoff_lng },
      );
      legsByOrder.set(order.id, legs);
    }),
  );
  return legsByOrder;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<demo.DemoState>(demo.initialState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commit = useCallback((next: demo.DemoState) => {
    demo.saveState(next);
    stateRef.current = next;
    setState(next);
  }, []);

  const runDispatchPass = useCallback(async () => {
    const current = stateRef.current;
    if (demo.pendingDispatchOrders(current).length === 0) return;
    const legsByOrder = await measurePendingLegs(current);
    const next = demo.tickDispatch(stateRef.current, legsByOrder);
    if (next === stateRef.current) return;
    commit(next);
  }, [commit]);

  useEffect(() => {
    const loaded = demo.applySubscriptionFreeze(demo.loadState());
    demo.saveState(loaded);
    stateRef.current = loaded;
    setState(loaded);
    setReady(true);

    function onStorage(e: StorageEvent) {
      if (e.key !== demo.STORAGE_KEY || !e.newValue) return;
      const next = demo.loadState();
      stateRef.current = next;
      setState(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      void runDispatchPass();
    }, 5000);
    return () => window.clearInterval(id);
  }, [ready, runDispatchPass]);

  const value = useMemo<StoreContextValue>(
    () => ({
      ready,
      state,
      reset: () => commit(demo.resetDemo()),
      register: (input) => {
        const r = demo.registerUser(state, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      login: (identifier, password) => {
        const r = demo.loginUser(state, identifier, password);
        if (r.error) return r.error;
        commit(r.state);
      },
      logout: () => commit({ ...state, sessionUserId: null, viewingAs: null }),
      setViewingAs: (role) => commit({ ...state, viewingAs: role }),
      createOrder: async (clientId, input) => {
        const distanceKm = await measureRouteKm(
          { lat: input.pickup_lat, lng: input.pickup_lng },
          { lat: input.dropoff_lat, lng: input.dropoff_lng },
        );
        const r = demo.createOrder(stateRef.current, clientId, { ...input, distanceKm });
        if (r.error || !r.order) return { error: r.error };
        const legs = await measureDriverLegs(
          demo.dispatchDriverPoints(r.state),
          { lat: r.order.pickup_lat, lng: r.order.pickup_lng },
          { lat: r.order.dropoff_lat, lng: r.order.dropoff_lng },
        );
        commit(demo.reconcileOrderDispatch(r.state, r.order.id, legs));
        return { orderNumber: r.order.order_number };
      },
      claimOrder: (orderId, driverId) => {
        const r = demo.claimOrder(state, orderId, driverId);
        if (r.error) return r.error;
        commit(r.state);
      },
      declineOffer: (orderId, driverId) => {
        const r = demo.declineOffer(state, orderId, driverId);
        if (r.error) return r.error;
        commit(r.state);
      },
      advanceOrder: (orderId, actorId, action) => {
        const r = demo.advanceOrder(state, orderId, actorId, action);
        if (r.error) return r.error;
        commit(r.state);
      },
      confirmDelivery: (orderId, userId, who, stars) => {
        const r = demo.confirmDelivery(state, orderId, userId, who, stars);
        if (r.error) return r.error;
        commit(r.state);
      },
      reportClient: (orderId, reporterId, reason) => {
        const r = demo.reportClient(state, orderId, reporterId, reason);
        if (r.error) return r.error;
        commit(r.state);
      },
      resolveReport: (reportId, upheld) => commit(demo.resolveReport(state, reportId, upheld)),
      updateLocation: (driverId, lat, lng) => {
        setState((prev) => {
          const next = demo.updateLocation(prev, driverId, lat, lng);
          demo.saveState(next);
          return next;
        });
      },
      setOnline: (driverId, online, lat, lng) => {
        const r = demo.setOnline(state, driverId, online, lat, lng);
        if (r.error) return r.error;
        commit(r.state);
        if (online) void runDispatchPass();
      },
      requestPay: (driverId, opts) => commit(demo.requestSubscriptionPayment(state, driverId, opts)),
      confirmWhish: (txId) => commit(demo.confirmWhish(state, txId)),
      updateSettings: (partial) =>
        commit({ ...state, settings: { ...state.settings, ...partial } }),
      addDocument: (driverId, doc_type, file_name, file_data) =>
        commit(demo.addDocument(state, driverId, doc_type, file_name, file_data)),
      markNotificationRead: (notifId) => {
        setState((prev) => {
          const next = demo.markNotificationRead(prev, notifId);
          demo.saveState(next);
          return next;
        });
      },
      approveDocument: (docId, approve) =>
        commit(demo.approveDocument(state, docId, approve)),
      addCheckin: (orderId, driverId, status, note) =>
        commit(demo.addCheckin(state, orderId, driverId, status, note)),
      updateBusinessOrderCosts: (businessId, input) => {
        const r = demo.updateBusinessOrderCosts(state, businessId, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      updateProfile: (userId, input) => {
        const r = demo.updateProfile(state, userId, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      cancelOrder: (orderId, clientId) => {
        const r = demo.cancelOrder(state, orderId, clientId);
        if (r.error) return r.error;
        commit(r.state);
      },
      rejectOrder: (orderId) => {
        const r = demo.rejectOrder(state, orderId);
        if (r.error) return r.error;
        commit(r.state);
      },
      addDriver: (input) => {
        const r = demo.addDriver(state, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      removeDriver: (driverId) => {
        const r = demo.removeDriver(state, driverId);
        if (r.error) return r.error;
        commit(r.state);
      },
      setDriverAccountAction: (driverId, action) => {
        const r = demo.setDriverAccountAction(state, driverId, action);
        if (r.error) return r.error;
        commit(r.state);
      },
      setDriverPaymentWaived: (driverId, waived) => {
        const r = demo.setDriverPaymentWaived(state, driverId, waived);
        if (r.error) return r.error;
        commit(r.state);
      },
      setDriverRevenueMode: (driverId, mode) => {
        const r = demo.setDriverRevenueMode(state, driverId, mode);
        if (r.error) return r.error;
        commit(r.state);
      },
      addWarehouse: (input) => commit(demo.addWarehouse(state, input)),
      removeWarehouse: (warehouseId) => {
        const r = demo.removeWarehouse(state, warehouseId);
        if (r.error) return r.error;
        commit(r.state);
      },
      addWarehouseProduct: (input) => commit(demo.addWarehouseProduct(state, input)),
      removeWarehouseProduct: (productId) =>
        commit(demo.removeWarehouseProduct(state, productId)),
    }),
    [ready, state, commit, runDispatchPass],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
