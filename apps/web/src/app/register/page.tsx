"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PUBLIC_DRIVER_TYPES, DRIVER_TYPE_LABELS, type DriverType, type UserRole } from "@direct/shared";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DeliveryMap,
  MapsProvider,
  PlaceSearch,
  reverseGeocode,
  useMapsAvailable,
} from "@/components/delivery-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const inputClass =
  "h-12 rounded-xl border-transparent bg-muted text-base shadow-none focus-visible:border-foreground";

export default function RegisterPage() {
  return (
    <MapsProvider>
      <RegisterForm />
    </MapsProvider>
  );
}

function RegisterForm() {
  const router = useRouter();
  const { register } = useStore();
  const { dict } = useI18n();
  const mapsAvailable = useMapsAvailable();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [businessName, setBusinessName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPin, setShopPin] = useState<{ lat: number; lng: number } | null>(null);
  const [driverType, setDriverType] = useState<DriverType>("fast");

  const roleItems = [
    { label: dict.auth.roleClient, value: "client" },
    { label: dict.auth.roleBusiness, value: "business" },
    { label: dict.auth.roleDriver, value: "driver" },
  ];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(dict.auth.passwordsMustMatch);
      return;
    }
    if (role === "business") {
      const pin = shopPin ?? (!mapsAvailable ? { lat: 33.8938, lng: 35.5018 } : null);
      if (!pin || shopAddress.trim().length < 3) {
        toast.error(dict.auth.pinRequired);
        return;
      }
      const err = register({
        full_name: fullName,
        email,
        phone,
        password,
        role,
        business_name: businessName,
        business_address: shopAddress.trim(),
        business_lat: pin.lat,
        business_lng: pin.lng,
      });
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(dict.auth.accountCreated);
      router.push("/app");
      return;
    }
    const err = register({
      full_name: fullName,
      email,
      phone,
      password,
      role,
      driver_type: role === "driver" ? driverType : undefined,
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.auth.accountCreated);
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
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col justify-center px-4 py-10",
          role === "business" ? "max-w-xl" : "max-w-sm",
        )}
      >
        <h1 className="text-3xl font-extrabold tracking-tight">{dict.auth.createYourAccount}</h1>
        <p className="mt-2 text-base text-muted-foreground">{dict.auth.registerSub}</p>
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">{dict.auth.iAmA}</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              items={roleItems}
            >
              <SelectTrigger className={`${inputClass} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {roleItems.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">{dict.auth.fullName}</Label>
            <Input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          {role === "business" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">{dict.auth.businessName}</Label>
                <Input
                  className={inputClass}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">{dict.auth.shopLocation}</Label>
                <p className="text-sm text-muted-foreground">{dict.auth.shopLocationHint}</p>
                {mapsAvailable ? (
                  <PlaceSearch
                    placeholder={dict.order.searchPlace}
                    className="h-12 text-lg"
                    onSelect={(place) => {
                      setShopAddress(place.address);
                      setShopPin({ lat: place.lat, lng: place.lng });
                    }}
                  />
                ) : null}
                <Input
                  className={inputClass}
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder={dict.admin.address}
                  required
                />
                <DeliveryMap
                  standalone={false}
                  height="240px"
                  markers={
                    shopPin
                      ? [
                          {
                            id: "shop",
                            lat: shopPin.lat,
                            lng: shopPin.lng,
                            label: dict.auth.shopLocation,
                            kind: "pickup" as const,
                          },
                        ]
                      : []
                  }
                  onMapClick={async (lat, lng) => {
                    setShopPin({ lat, lng });
                    setShopAddress(await reverseGeocode(lat, lng));
                  }}
                  routeHint={dict.order.mapTip}
                />
              </div>
            </>
          ) : null}
          {role === "driver" ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">{dict.auth.driverType}</Label>
              <Select
                value={driverType}
                onValueChange={(v) => setDriverType(v as DriverType)}
                items={PUBLIC_DRIVER_TYPES.map((t) => ({
                  label: DRIVER_TYPE_LABELS[t],
                  value: t,
                }))}
              >
                <SelectTrigger className={`${inputClass} w-full`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PUBLIC_DRIVER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t}>
                        {DRIVER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">{dict.common.phone}</Label>
            <Input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">{dict.common.email}</Label>
            <Input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">{dict.common.password}</Label>
            <Input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">{dict.auth.confirmPassword}</Label>
            <Input
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <Button
            type="submit"
            className="touch-target mt-2 h-12 rounded-xl text-base font-semibold"
          >
            {dict.auth.createAccount}
          </Button>
        </form>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {dict.auth.alreadyRegistered}{" "}
          <Link
            href="/login"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            {dict.common.logIn}
          </Link>
        </p>
      </main>
    </div>
  );
}
