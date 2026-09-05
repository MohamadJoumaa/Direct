"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Settings,
  Store,
  Truck,
  User,
  Wallet,
  Warehouse,
  History,
  Shield,
  FileText,
} from "lucide-react";
import { ProfilePhoto } from "@/components/profile-photo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { profilePhotoUrl } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import type { UserRole } from "@direct/shared";
import { cn } from "@/lib/utils";
import { useDriverGeolocation } from "@/hooks/use-driver-geolocation";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function NotificationBell() {
  const { user } = useAuth();
  const { state, markNotificationRead } = useStore();
  if (!user) return null;
  const notifs = state.notifications.filter((n) => n.user_id === user.id);
  const unread = notifs.filter((n) => !n.read).length;
  if (notifs.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative touch-target">
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {notifs.map((n) => (
            <button
              key={n.id}
              type="button"
              className={cn(
                "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-start transition-colors hover:bg-muted/50",
                !n.read && "bg-primary/5",
              )}
              onClick={() => {
                if (!n.read) markNotificationRead(n.id);
              }}
            >
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, effectiveRole, isAdmin, driver } = useAuth();
  const { logout, setViewingAs, state } = useStore();
  const { dict } = useI18n();
  useDriverGeolocation();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-easy">{dict.common.pleaseSignIn}</p>
        <Link
          href="/login"
          className="touch-target inline-flex h-12 items-center rounded-lg bg-primary px-6 text-lg text-primary-foreground"
        >
          {dict.common.logIn}
        </Link>
      </div>
    );
  }

  const clientLinks = [
    { href: "/app/client", label: dict.nav.home, icon: LayoutDashboard },
    { href: "/app/client/new", label: dict.nav.newOrder, icon: Package },
    { href: "/app/client/history", label: dict.nav.history, icon: History },
    { href: "/app/profile", label: dict.nav.profile, icon: User },
  ];

  const businessLinks = [
    { href: "/app/client", label: dict.nav.home, icon: LayoutDashboard },
    { href: "/app/client/new", label: dict.nav.newOrder, icon: Package },
    { href: "/app/client/history", label: dict.nav.history, icon: History },
    { href: "/app/profile", label: dict.nav.profile, icon: User },
  ];

  const driverLinks = [
    { href: "/app/driver", label: dict.nav.ordersTab, icon: Package },
    { href: "/app/driver/history", label: dict.nav.history, icon: History },
    { href: "/app/driver/dashboard", label: dict.nav.money, icon: Wallet },
    { href: "/app/profile", label: dict.nav.profile, icon: User },
  ];

  const adminLinks = [
    { href: "/app/admin", label: dict.nav.ordersTab, icon: Package },
    { href: "/app/admin/drivers", label: dict.nav.drivers, icon: Truck },
    { href: "/app/admin/warehouses", label: dict.nav.warehouses, icon: Warehouse },
    { href: "/app/admin/businesses", label: dict.nav.businesses, icon: Store },
    { href: "/app/admin/money", label: dict.nav.budget, icon: Wallet },
    { href: "/app/admin/documents", label: dict.nav.documents, icon: FileText },
    { href: "/app/admin/settings", label: dict.nav.settings, icon: Settings },
    { href: "/app/admin/reports", label: dict.nav.reports, icon: Shield },
    { href: "/app/profile", label: dict.nav.profile, icon: User },
  ];

  const links =
    effectiveRole === "admin"
      ? adminLinks
      : effectiveRole === "driver"
        ? driverLinks
        : effectiveRole === "business"
          ? businessLinks
          : clientLinks;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo-icon.png"
                alt="Direct logo"
                width={41}
                height={32}
                className="h-8 w-auto"
                unoptimized
              />
              <span className="text-xl font-extrabold tracking-tight">Direct</span>
            </Link>
            {title ? (
              <span className="hidden text-muted-foreground sm:inline">· {title}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <Select
                value={state.viewingAs ?? "admin"}
                onValueChange={(v) => {
                  const role = (v as UserRole | "admin" | null) ?? "admin";
                  if (role === "admin") {
                    setViewingAs(null);
                    router.push("/app/admin");
                  } else {
                    setViewingAs(role);
                    if (role === "driver") router.push("/app/driver");
                    else router.push("/app/client");
                  }
                }}
                items={[
                  { label: dict.admin.viewAsAdmin, value: "admin" },
                  { label: dict.admin.viewAsClient, value: "client" },
                  { label: dict.admin.viewAsBusiness, value: "business" },
                  { label: dict.admin.viewAsDriver, value: "driver" },
                ]}
              >
                <SelectTrigger className="touch-target min-w-40 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="admin">{dict.admin.viewAsAdmin}</SelectItem>
                    <SelectItem value="client">{dict.admin.viewAsClient}</SelectItem>
                    <SelectItem value="business">{dict.admin.viewAsBusiness}</SelectItem>
                    <SelectItem value="driver">{dict.admin.viewAsDriver}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : null}
            {driver ? (
              <Badge variant={driver.is_online ? "default" : "secondary"} className="text-sm">
                <MapPin />
                {driver.is_online ? dict.common.online : dict.common.offline}
              </Badge>
            ) : null}
            <NotificationBell />
            <Link
              href="/app/profile"
              className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ProfilePhoto
                src={profilePhotoUrl(state, user.id)}
                name={user.full_name}
                className="size-11"
              />
              <span className="hidden text-base font-medium sm:inline">{user.full_name}</span>
            </Link>
            <LanguageToggle />
            <ThemeToggle />
            <Button
              variant="outline"
              size="lg"
              className="touch-target rounded-full"
              onClick={() => {
                logout();
                router.push("/");
              }}
            >
              <LogOut data-icon="inline-start" />
              {dict.common.logOut}
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "touch-target inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
