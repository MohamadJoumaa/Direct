import React, { createContext, useContext, useMemo } from "react";
import type { UserRole } from "@direct/shared";
import type { Driver, Profile } from "@direct/core";
import { useStore } from "@/lib/store-context";

/**
 * Same derivation as the website: `user` / `driver` / `effectiveRole` follow the
 * impersonated profile, while `isAdmin` always reflects the real signed-in
 * session so admin chrome keeps working while viewing as someone else.
 */
type AuthContextValue = {
  ready: boolean;
  user: Profile | null;
  driver: Driver | null;
  effectiveRole: UserRole | null;
  isAdmin: boolean;
  /** True while an admin is viewing the app as another role. */
  impersonating: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, state } = useStore();
  const sessionUser = state.profiles.find((p) => p.id === state.sessionUserId) ?? null;
  const isAdmin = sessionUser?.role === "admin";
  const impersonating = isAdmin && state.viewingAs != null;
  const impersonatedProfile = impersonating
    ? (state.profiles.find((p) => p.id === state.viewingAsUserId) ?? null)
    : null;
  const user = impersonatedProfile ?? sessionUser;
  const driver = user ? (state.drivers.find((d) => d.id === user.id) ?? null) : null;
  const effectiveRole = impersonating
    ? (impersonatedProfile?.role ?? state.viewingAs)
    : (sessionUser?.role ?? null);

  const value = useMemo(
    () => ({ ready, user, driver, effectiveRole, isAdmin, impersonating }),
    [ready, user, driver, effectiveRole, isAdmin, impersonating],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
