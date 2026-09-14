import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { CompanySettings, DriverType, UserRole } from "@direct/shared";
import * as demo from "@direct/core";
import { measureDriverLegs, measureRouteKm } from "@/lib/route-distance";

/**
 * Expo binding for the shared application state.
 *
 * Deliberately the same context surface as
 * `apps/web/src/lib/store-context.tsx`: every method returns an error string or
 * `undefined` and screens surface it with a toast. Only persistence differs --
 * AsyncStorage instead of localStorage -- which is the seam the Supabase
 * cutover (Phase 2 Workstream A) replaces.
 */
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
    shop_address?: string;
    shop_lat?: number;
    shop_lng?: number;
    driver_type?: DriverType;
    vehicle?: string;
  }) => string | undefined;
  login: (identifier: string, password: string) => string | undefined;
  logout: () => void;
  setViewingAs: (role: UserRole | null) => void;
  refreshFromStorage: () => void;
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
      is_urgent?: boolean;
      price_usd?: number;
    },
  ) => Promise<{ error?: string; orderNumber?: number }>;
  updateOrderPrice: (orderId: string, clientId: string, priceUsd: number) => string | undefined;
  claimOrder: (orderId: string, driverId: string) => string | undefined;
  declineOffer: (orderId: string, driverId: string) => string | undefined;
  advanceOrder: (
    orderId: string,
    actorId: string,
    action: Parameters<typeof demo.advanceOrder>[3],
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
    userId: string,
    doc_type: demo.DocType,
    file_name: string,
    file_data?: string,
  ) => string | undefined;
  approveDocument: (docId: string, approve: boolean) => void;
  markNotificationRead: (notifId: string) => void;
  markNotificationsRead: (notifIds: string[]) => void;
  addCheckin: (
    orderId: string,
    driverId: string,
    status: demo.PrivateCheckin["status"],
    note: string,
  ) => void;
  updateBusinessOrderCosts: (
    businessId: string,
    input: Parameters<typeof demo.updateBusinessOrderCosts>[2],
  ) => string | undefined;
  updateProfile: (
    userId: string,
    input: Parameters<typeof demo.updateProfile>[3],
  ) => string | undefined;
  cancelOrder: (orderId: string, clientId: string) => string | undefined;
  rejectOrder: (orderId: string) => string | undefined;
  addDriver: (input: Parameters<typeof demo.addDriver>[1]) => string | undefined;
  addAdmin: (input: Parameters<typeof demo.addAdmin>[1]) => string | undefined;
  removeAdmin: (adminId: string) => string | undefined;
  setDriverAccountAction: (
    driverId: string,
    action: demo.DriverAccountAction,
  ) => string | undefined;
  setDriverPaymentWaived: (driverId: string, waived: boolean) => string | undefined;
  setDriverRevenueMode: (driverId: string, mode: demo.Driver["revenue_mode"]) => string | undefined;
  setDriverSubscriptionPlan: (
    driverId: string,
    plan: demo.Driver["subscription_plan"],
  ) => string | undefined;
  addWarehouse: (input: { name: string; address: string; lat: number; lng: number }) => void;
  updateWarehouse: (
    warehouseId: string,
    input: Parameters<typeof demo.updateWarehouse>[2],
  ) => string | undefined;
  removeWarehouse: (warehouseId: string) => string | undefined;
  addWarehouseProduct: (input: Parameters<typeof demo.addWarehouseProduct>[1]) => void;
  removeWarehouseProduct: (productId: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Persist without letting two saves race. AsyncStorage resolves out of order
 * under load, so an older snapshot could otherwise land last and roll back a
 * completed delivery. Only the newest snapshot is ever written.
 */
function createWriter() {
  let pending: demo.DemoState | null = null;
  let writing = false;

  async function drain() {
    if (writing) return;
    writing = true;
    try {
      while (pending) {
        const snapshot = pending;
        pending = null;
        await AsyncStorage.setItem(demo.STORAGE_KEY, demo.serializeState(snapshot));
      }
    } catch {
      // A failed write loses persistence, not the session: in-memory state is
      // still correct and the next mutation retries.
    } finally {
      writing = false;
    }
  }

  return (state: demo.DemoState) => {
    pending = state;
    void drain();
  };
}

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
  const saveState = useRef(createWriter()).current;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const commit = useCallback(
    (next: demo.DemoState) => {
      saveState(next);
      stateRef.current = next;
      setState(next);
    },
    [saveState],
  );

  const runDispatchPass = useCallback(async () => {
    const current = stateRef.current;
    if (demo.pendingDispatchOrders(current).length === 0) return;
    const legsByOrder = await measurePendingLegs(current);
    const next = demo.tickDispatch(stateRef.current, legsByOrder);
    if (next === stateRef.current) return;
    commit(next);
  }, [commit]);

  const hydrate = useCallback(async () => {
    const raw = await AsyncStorage.getItem(demo.STORAGE_KEY);
    const loaded = demo.applySubscriptionFreeze(demo.parseState(raw));
    saveState(loaded);
    stateRef.current = loaded;
    setState(loaded);
    setReady(true);
  }, [saveState]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // The web reads back on the `storage` event; a phone has no sibling tabs, but
  // it does get suspended. Returning to the foreground re-reads, so state a
  // background location task wrote is not silently overwritten.
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void hydrate();
    });
    return () => sub.remove();
  }, [ready, hydrate]);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      void runDispatchPass();
      // applySubscriptionFreeze returns the same reference when nothing
      // changed, so this is a no-op tick most of the time: no re-render,
      // no re-save.
      setState((prev) => {
        const next = demo.applySubscriptionFreeze(prev);
        if (next === prev) return prev;
        saveState(next);
        stateRef.current = next;
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [ready, runDispatchPass, saveState]);

  const value = useMemo<StoreContextValue>(
    () => ({
      ready,
      state,
      reset: () => commit(demo.seed()),
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
      logout: () =>
        commit({ ...state, sessionUserId: null, viewingAs: null, viewingAsUserId: null }),
      setViewingAs: (role) => {
        if (!role) {
          commit({ ...state, viewingAs: null, viewingAsUserId: null });
          return;
        }
        // Impersonation must carry an identity, not just a role label,
        // otherwise every impersonated view still runs as the admin.
        const representative = state.profiles.find((p) => p.role === role);
        commit({ ...state, viewingAs: role, viewingAsUserId: representative?.id ?? null });
      },
      refreshFromStorage: () => {
        void (async () => {
          const raw = await AsyncStorage.getItem(demo.STORAGE_KEY);
          const fresh = demo.parseState(raw);
          if (JSON.stringify(fresh.locations) === JSON.stringify(stateRef.current.locations)) {
            return;
          }
          stateRef.current = fresh;
          setState(fresh);
        })();
      },
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
      updateOrderPrice: (orderId, clientId, priceUsd) => {
        const r = demo.updateOrderPrice(state, orderId, clientId, priceUsd);
        if (r.error) return r.error;
        commit(r.state);
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
          saveState(next);
          stateRef.current = next;
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
      addDocument: (userId, doc_type, file_name, file_data) => {
        const r = demo.addDocument(state, userId, doc_type, file_name, file_data);
        if (r.error) return r.error;
        commit(r.state);
      },
      approveDocument: (docId, approve) => commit(demo.approveDocument(state, docId, approve)),
      markNotificationRead: (notifId) => {
        setState((prev) => {
          const next = demo.markNotificationRead(prev, notifId);
          saveState(next);
          stateRef.current = next;
          return next;
        });
      },
      markNotificationsRead: (notifIds) => {
        setState((prev) => {
          const next = demo.markNotificationsRead(prev, notifIds);
          if (next === prev) return prev;
          saveState(next);
          stateRef.current = next;
          return next;
        });
      },
      addCheckin: (orderId, driverId, status, note) =>
        commit(demo.addCheckin(state, orderId, driverId, status, note)),
      updateBusinessOrderCosts: (businessId, input) => {
        const r = demo.updateBusinessOrderCosts(state, businessId, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      updateProfile: (userId, input) => {
        const r = demo.updateProfile(state, state.sessionUserId, userId, input);
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
      addAdmin: (input) => {
        const r = demo.addAdmin(state, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      removeAdmin: (adminId) => {
        const r = demo.removeAdmin(state, adminId);
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
      setDriverSubscriptionPlan: (driverId, plan) => {
        const r = demo.setDriverSubscriptionPlan(state, driverId, plan);
        if (r.error) return r.error;
        commit(r.state);
      },
      addWarehouse: (input) => commit(demo.addWarehouse(state, input)),
      updateWarehouse: (warehouseId, input) => {
        const r = demo.updateWarehouse(state, warehouseId, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      removeWarehouse: (warehouseId) => {
        const r = demo.removeWarehouse(state, warehouseId);
        if (r.error) return r.error;
        commit(r.state);
      },
      addWarehouseProduct: (input) => commit(demo.addWarehouseProduct(state, input)),
      removeWarehouseProduct: (productId) =>
        commit(demo.removeWarehouseProduct(state, productId)),
    }),
    [ready, state, commit, runDispatchPass, saveState],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
