"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { UserRole } from "@direct/shared";
import { useStore } from "@/lib/store-context";
import type { Driver, Profile } from "@/lib/demo-store";

type AuthContextValue = {
  ready: boolean;
  user: Profile | null;
  driver: Driver | null;
  effectiveRole: UserRole | null;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore();
  const user = state.profiles.find((p) => p.id === state.sessionUserId) ?? null;
  const driver = user ? state.drivers.find((d) => d.id === user.id) ?? null : null;
  const isAdmin = user?.role === "admin";
  const effectiveRole =
    isAdmin && state.viewingAs ? state.viewingAs : (user?.role ?? null);

  const value = useMemo(
    () => ({ ready, user, driver, effectiveRole, isAdmin }),
    [ready, user, driver, effectiveRole, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
