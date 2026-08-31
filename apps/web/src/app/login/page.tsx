"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useStore();
  const { user, effectiveRole } = useAuth();
  const { dict } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user && effectiveRole) {
      const dest =
        effectiveRole === "admin"
          ? "/app/admin"
          : effectiveRole === "driver"
            ? "/app/driver"
            : "/app/client";
      router.replace(dest);
    }
  }, [user, effectiveRole, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = login(identifier, password);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.auth.welcomeBackToast);
    router.push("/app");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="Direct logo" width={45} height={35} className="h-9 w-auto" unoptimized />
          <span className="text-xl font-extrabold tracking-tight">Direct</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-24">
        <h1 className="text-3xl font-extrabold tracking-tight">{dict.auth.welcomeBack}</h1>
        <p className="mt-2 text-base text-muted-foreground">{dict.auth.loginSub}</p>
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="identifier" className="text-sm font-medium">
              {dict.auth.emailOrPhone}
            </Label>
            <Input
              id="identifier"
              className="h-12 rounded-xl border-transparent bg-muted text-base shadow-none focus-visible:border-foreground"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@email.com / 70xxxxxx"
              autoComplete="username"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-sm font-medium">
              {dict.common.password}
            </Label>
            <Input
              id="password"
              type="password"
              className="h-12 rounded-xl border-transparent bg-muted text-base shadow-none focus-visible:border-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button
            type="submit"
            className="touch-target mt-1 h-12 rounded-xl text-base font-semibold"
          >
            {dict.common.logIn}
          </Button>
        </form>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {dict.auth.newToDirect}{" "}
          <Link
            href="/register"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            {dict.auth.createAccount}
          </Link>
        </p>
        <div className="mt-10 rounded-xl bg-muted p-4 text-xs text-muted-foreground">
          <p className="font-semibold">{dict.auth.demoAccounts}</p>
          <p className="mt-1">admin@direct.lb / admin123</p>
          <p>client@direct.lb / client123</p>
          <p>fast@direct.lb / driver123</p>
        </div>
      </main>
    </div>
  );
}
