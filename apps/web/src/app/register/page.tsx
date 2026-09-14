"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Package, Truck } from "lucide-react";
import { type DriverType, type UserRole } from "@direct/shared";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { mapsConfigured } from "@/components/maps-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store-context";
import { useI18n, fmt, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BusinessShopLocation = dynamic(
  () => import("@/components/business-shop-location").then((mod) => mod.BusinessShopLocation),
  { ssr: false, loading: () => <div className="h-80 w-full rounded-xl bg-muted" /> },
);

const inputClass =
  "h-12 rounded-xl border-transparent bg-muted text-base shadow-none focus-visible:border-foreground";

/** The only two types a new driver can honestly pick for themselves: trusted is
 *  earned through document review, and the rest belong to the Direct team. */
const SIGNUP_DRIVER_TYPES = ["fast", "long_distance"] as const;

/**
 * What sits behind the sign-up popups, so closing one leaves the work Direct
 * actually does on screen instead of an empty page. Deliberately brand-neutral
 * photography — no other courier's livery anywhere in frame (see
 * public/register/CREDITS.md).
 */
function RegisterShowcase({ dict }: { dict: Dictionary }) {
  const tiles = [
    { src: "/register/parcels-stack.jpg", alt: dict.auth.photoParcelsAlt },
    { src: "/register/handover.jpg", alt: dict.auth.photoHandoverAlt },
    { src: "/register/parcel-care.jpg", alt: dict.auth.photoParcelAlt },
  ];
  return (
    <div className="flex flex-col gap-3">
      <figure className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-muted">
        <Image
          src="/register/courier-night.jpg"
          alt={dict.auth.photoRiderAlt}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 44vw, 100vw"
          fetchPriority="high"
          loading="eager"
        />
        {/* Scrim, so the caption reads over any part of the photo. */}
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-5 pt-12">
          <p className="text-sm font-semibold tracking-wider text-white/80 uppercase">
            {dict.common.tagline}
          </p>
          <p className="mt-1 text-xl font-bold text-white">{dict.auth.showcaseRide}</p>
        </figcaption>
      </figure>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.src}
            className="relative aspect-square overflow-hidden rounded-2xl bg-muted"
          >
            <Image
              src={tile.src}
              alt={tile.alt}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 15vw, 33vw"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 px-1">
        <p className="text-base font-medium">{dict.auth.showcaseHandover}</p>
        <p className="text-base text-muted-foreground">{dict.auth.showcaseCare}</p>
      </div>
    </div>
  );
}

function AuthPageFallback({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background" aria-busy="true">
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
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 py-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
        <div className="mx-auto flex w-full max-w-sm flex-col lg:mx-0">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <div className="mt-8 flex flex-col gap-4">
            <div className="h-12 w-full rounded-xl bg-muted" />
            <div className="h-12 w-full rounded-xl bg-muted" />
            <div className="h-12 w-full rounded-xl bg-muted" />
            <div className="h-12 w-full rounded-xl bg-muted" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="aspect-[16/10] w-full rounded-3xl bg-muted" />
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-square rounded-2xl bg-muted" />
            <div className="aspect-square rounded-2xl bg-muted" />
            <div className="aspect-square rounded-2xl bg-muted" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  const { dict } = useI18n();
  return (
    <Suspense fallback={<AuthPageFallback title={dict.auth.createYourAccount} />}>
      <RegisterForm />
    </Suspense>
  );
}

function roleCopy(role: UserRole, dict: Dictionary) {
  if (role === "business") {
    return { label: dict.auth.roleBusiness, desc: dict.auth.roleBusinessDesc, Icon: Briefcase };
  }
  if (role === "driver") {
    return { label: dict.auth.roleDriver, desc: dict.auth.roleDriverDesc, Icon: Truck };
  }
  return { label: dict.auth.roleClient, desc: dict.auth.roleClientDesc, Icon: Package };
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useStore();
  const { dict } = useI18n();

  // A role in the link (the "Become a driver" buttons) skips straight to the
  // details step, because that question has already been answered.
  const linkedRole: UserRole | null =
    searchParams.get("role") === "driver"
      ? "driver"
      : searchParams.get("role") === "business"
        ? "business"
        : searchParams.get("role") === "client"
          ? "client"
          : null;

  const [role, setRole] = useState<UserRole | null>(linkedRole);
  const [step, setStep] = useState<"role" | "details" | null>(
    linkedRole ? "details" : "role",
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPin, setShopPin] = useState<{ lat: number; lng: number } | null>(null);
  const [driverType, setDriverType] = useState<DriverType>("fast");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    if (password !== confirm) {
      toast.error(dict.auth.passwordsMustMatch);
      return;
    }
    const shared = { full_name: fullName, email, phone, password, role };

    if (role === "business") {
      // With no maps key there is no pin to drop, so fall back to Beirut
      // rather than blocking sign-up entirely.
      const pin = shopPin ?? (!mapsConfigured() ? { lat: 33.8938, lng: 35.5018 } : null);
      if (!pin || shopAddress.trim().length < 3) {
        toast.error(dict.auth.pinRequired);
        return;
      }
      const err = register({
        ...shared,
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
      router.push("/app/client");
      return;
    }

    const err = register(
      role === "driver" ? { ...shared, driver_type: driverType } : shared,
    );
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.auth.accountCreated);
    router.push(role === "driver" ? "/app/driver" : "/app/client");
  }

  const chosen = role ? roleCopy(role, dict) : null;
  const detailsTitle =
    role === "business"
      ? dict.auth.detailsTitleBusiness
      : role === "driver"
        ? dict.auth.detailsTitleDriver
        : dict.auth.detailsTitle;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Everything behind the popups blurs while a step is open — the photos
          included — so the form in front is the only thing in focus. */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-[filter,opacity] duration-200",
          step !== null ? "blur-sm opacity-70" : "",
        )}
      >
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

        {/* The page behind the popups stays usable: dismissing a step never
            strands the visitor, it only parks the flow here. */}
        <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 py-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
          <div className="mx-auto flex w-full max-w-sm flex-col lg:mx-0">
            <h1 className="text-3xl font-extrabold tracking-tight">{dict.auth.createYourAccount}</h1>
            <p className="mt-2 text-base text-muted-foreground">{dict.auth.signUpIntro}</p>
            {chosen ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl border-2 p-4">
                <chosen.Icon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{dict.auth.yourRole}</p>
                  <p className="text-lg font-semibold">{chosen.label}</p>
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              className="touch-target mt-6 h-12 rounded-xl text-base font-semibold"
              onClick={() => setStep(role ? "details" : "role")}
            >
              {role ? dict.auth.resumeSignUp : dict.auth.startSignUp}
            </Button>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {dict.auth.alreadyRegistered}{" "}
              <Link
                href={`/login?role=${role === "driver" ? "driver" : "client"}`}
                className="font-semibold text-foreground underline underline-offset-4"
              >
                {dict.common.logIn}
              </Link>
            </p>
          </div>

          <RegisterShowcase dict={dict} />
        </main>
      </div>

      {/* Step 1 — which role is this person signing up as? */}
      <Dialog open={step === "role"} onOpenChange={(open) => setStep(open ? "role" : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{dict.auth.chooseRoleTitle}</DialogTitle>
            <DialogDescription>{dict.auth.chooseRoleHint}</DialogDescription>
          </DialogHeader>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {fmt(dict.auth.registerStep, { step: 1 })}
          </p>
          <div className="flex flex-col gap-2">
            {(["client", "business", "driver"] as const).map((value) => {
              const copy = roleCopy(value, dict);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRole(value);
                    setStep("details");
                  }}
                  className={cn(
                    "touch-target flex min-h-11 items-start gap-3 rounded-xl border-2 p-4 text-start transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    role === value ? "border-primary bg-muted" : "border-border",
                  )}
                >
                  <copy.Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold">{copy.label}</span>
                    <span className="text-sm text-muted-foreground">{copy.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2 — only what this role actually needs. */}
      <Dialog
        open={step === "details"}
        onOpenChange={(open) => setStep(open ? "details" : null)}
      >
        <DialogContent
          className={cn(
            "max-h-[88vh] overflow-y-auto",
            role === "business" ? "sm:max-w-lg" : "sm:max-w-md",
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{detailsTitle}</DialogTitle>
            <DialogDescription>{dict.auth.registerSub}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {fmt(dict.auth.registerStep, { step: 2 })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-target"
              onClick={() => setStep("role")}
            >
              {dict.auth.changeRole}
            </Button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
                <BusinessShopLocation
                  shopAddress={shopAddress}
                  shopPin={shopPin}
                  onAddressChange={setShopAddress}
                  onPinChange={setShopPin}
                />
              </>
            ) : null}

            {role === "driver" ? (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">{dict.auth.driverType}</Label>
                <div
                  role="radiogroup"
                  aria-label={dict.auth.driverType}
                  className="flex flex-col gap-2"
                >
                  {SIGNUP_DRIVER_TYPES.map((value) => {
                    const selected = driverType === value;
                    const title =
                      value === "fast" ? dict.auth.driverTypeFast : dict.auth.driverTypeLong;
                    const desc =
                      value === "fast"
                        ? dict.auth.driverTypeFastDesc
                        : dict.auth.driverTypeLongDesc;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setDriverType(value)}
                        className={cn(
                          "touch-target flex min-h-11 flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-start transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          selected ? "border-primary bg-muted" : "border-border",
                        )}
                      >
                        <span className="text-base font-semibold">{title}</span>
                        <span className="text-sm text-muted-foreground">{desc}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">{dict.auth.driverTypeHint}</p>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
