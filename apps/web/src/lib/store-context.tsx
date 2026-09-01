"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CompanySettings, DriverType, OrderType, UserRole } from "@direct/shared";
import * as demo from "@/lib/demo-store";

type StoreContextValue = {
  ready: boolean;
  state: demo.DemoState;
  refresh: () => void;
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
      order_type: OrderType;
    },
  ) => string | undefined;
  claimOrder: (orderId: string, driverId: string) => string | undefined;
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
    doc_type: "selfie" | "id" | "vehicle_registration",
    file_name: string,
  ) => void;
  approveDocument: (docId: string, approve: boolean) => void;
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
  rejectOrder: (orderId: string) => string | undefined;
  addDriver: (input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    driver_type: DriverType;
  }) => string | undefined;
  removeDriver: (driverId: string) => string | undefined;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<demo.DemoState>(demo.initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = demo.applySubscriptionFreeze(demo.loadState());
    demo.saveState(loaded);
    setState(loaded);
    setReady(true);
  }, []);

  const commit = useCallback((next: demo.DemoState) => {
    demo.saveState(next);
    setState(next);
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      ready,
      state,
      refresh: () => setState(demo.loadState()),
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
      createOrder: (clientId, input) => {
        const r = demo.createOrder(state, clientId, input);
        if (r.error) return r.error;
        commit(r.state);
      },
      claimOrder: (orderId, driverId) => {
        const r = demo.claimOrder(state, orderId, driverId);
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
      },
      requestPay: (driverId, opts) => commit(demo.requestSubscriptionPayment(state, driverId, opts)),
      confirmWhish: (txId) => commit(demo.confirmWhish(state, txId)),
      updateSettings: (partial) =>
        commit({ ...state, settings: { ...state.settings, ...partial } }),
      addDocument: (driverId, doc_type, file_name) =>
        commit(demo.addDocument(state, driverId, doc_type, file_name)),
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
    [ready, state, commit],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
