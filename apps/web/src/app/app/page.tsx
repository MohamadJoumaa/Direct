"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AppIndexPage() {
  const router = useRouter();
  const { ready, user, effectiveRole } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (effectiveRole === "admin") router.replace("/app/admin");
    else if (effectiveRole === "driver") router.replace("/app/driver");
    else router.replace("/app/client");
  }, [ready, user, effectiveRole, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-xl">
      Opening your app…
    </div>
  );
}
