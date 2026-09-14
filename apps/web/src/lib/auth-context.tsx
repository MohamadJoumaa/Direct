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
  const sessionUser = state.profiles.find((p) => p.id === state.sessionUserId) ?? null;
  // isAdmin always reflects the real signed-in session, never the
  // impersonated identity, so admin nav keeps working while impersonating.
  const isAdmin = sessionUser?.role === "admin";
  const impersonating = isAdmin && state.viewingAs != null;
  const impersonatedProfile = impersonating
    ? (state.profiles.find((p) => p.id === state.viewingAsUserId) ?? null)
    : null;
  // `user` (and everything derived from it) is the impersonated profile
  // while impersonating — an admin viewing "as client" sees the demo
  // client's own orders, not an empty/duplicate list under the admin's id.
  const user = impersonatedProfile ?? sessionUser;
  const driver = user ? (state.drivers.find((d) => d.id === user.id) ?? null) : null;
  const effectiveRole = impersonating
    ? (impersonatedProfile?.role ?? state.viewingAs)
    : (sessionUser?.role ?? null);

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
