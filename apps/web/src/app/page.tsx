"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CarFront,
  CircleDot,
  Clock,
  MapPin,
  Package,
  ShieldCheck,
  Square,
  Timer,
} from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { LinkButton } from "@/components/link-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function HomePage() {
  const router = useRouter();
  const { user, effectiveRole } = useAuth();
  const { dict } = useI18n();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  const dash =
    effectiveRole === "admin"
      ? "/app/admin"
      : effectiveRole === "driver"
        ? "/app/driver"
        : user
          ? "/app/client"
          : null;
  const sendHref = user ? "/app/client/new" : "/register";

  function goSend() {
    if (!user) {
      router.push("/register");
      return;
    }
    const params = new URLSearchParams();
    if (pickup.trim()) params.set("pickup", pickup.trim());
    if (dropoff.trim()) params.set("dropoff", dropoff.trim());
    const qs = params.toString();
    router.push(qs ? `/app/client/new?${qs}` : "/app/client/new");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-icon.png"
              alt="Direct logo"
              width={45}
              height={35}
              className="h-9 w-auto"
              priority
              unoptimized
            />
            <span className="text-xl font-extrabold tracking-tight">Direct</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="#send"
              className="touch-target inline-flex items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {dict.nav.send}
            </a>
            <a
              href="#about"
              className="touch-target inline-flex items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {dict.nav.about}
            </a>
            <a
              href="#track"
              className="touch-target inline-flex items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {dict.nav.track}
            </a>
            <a
              href="#drive"
              className="touch-target inline-flex items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {dict.nav.drive}
            </a>
          </nav>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <ThemeToggle />
            {dash ? (
              <LinkButton href={dash} className="touch-target h-11 rounded-full px-5 font-semibold">
                {dict.common.openApp}
              </LinkButton>
            ) : (
              <>
                <LinkButton
                  href="/login"
                  variant="ghost"
                  className="touch-target hidden h-11 rounded-full px-5 font-semibold sm:inline-flex"
                >
                  {dict.common.logIn}
                </LinkButton>
                <LinkButton
                  href="/register"
                  className="touch-target h-11 rounded-full px-5 font-semibold"
                >
                  {dict.common.signUp}
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="send" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-8">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {dict.home.heroTitle1}
              <br />
              {dict.home.heroTitle2}
            </h1>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <CircleDot className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-foreground" />
                <Input
                  aria-label={dict.home.pickupPlaceholder}
                  placeholder={dict.home.pickupPlaceholder}
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="h-14 rounded-xl border-transparent bg-muted ps-11 text-base font-medium shadow-none placeholder:text-muted-foreground focus-visible:border-foreground"
                />
              </div>
              <div className="relative">
                <Square className="absolute start-4 top-1/2 size-4 -translate-y-1/2 fill-current text-foreground" />
                <Input
                  aria-label={dict.home.dropoffPlaceholder}
                  placeholder={dict.home.dropoffPlaceholder}
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  className="h-14 rounded-xl border-transparent bg-muted ps-11 text-base font-medium shadow-none placeholder:text-muted-foreground focus-visible:border-foreground"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <Button
                  onClick={goSend}
                  className="touch-target h-12 rounded-full px-7 text-base font-semibold"
                >
                  {dict.home.seePrices}
                </Button>
                {!user ? (
                  <Link
                    href="/login"
                    className="touch-target inline-flex items-center text-base font-medium underline underline-offset-4 hover:text-muted-foreground"
                  >
                    {dict.home.recentDeliveries}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-muted p-8 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {dict.home.howTitle}
            </p>
            <ol className="mt-6 flex flex-col">
              {[
                { icon: Package, text: dict.home.how1 },
                { icon: CarFront, text: dict.home.how2 },
                { icon: MapPin, text: dict.home.how3 },
                { icon: ShieldCheck, text: dict.home.how4 },
              ].map((step, i, arr) => (
                <li key={step.text} className="relative flex gap-4 pb-8 last:pb-0">
                  {i < arr.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute start-[23px] top-12 h-[calc(100%-3rem)] w-px bg-border"
                    />
                  ) : null}
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                    <step.icon className="size-5" />
                  </span>
                  <p className="flex min-h-12 items-center text-base font-medium">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="flex flex-col gap-5">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.home.aboutTitle}
          </h2>
          <span aria-hidden className="block h-1 w-16 rounded-full bg-gold" />
          <p className="max-w-xl text-lg text-muted-foreground">{dict.home.aboutBody}</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Timer, title: dict.home.fast, body: dict.home.fastBody },
              { icon: ShieldCheck, title: dict.home.safe, body: dict.home.safeBody },
              { icon: Clock, title: dict.home.reliable, body: dict.home.reliableBody },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl bg-muted p-5">
                <b.icon className="size-6" />
                <p className="mt-3 text-base font-semibold">{b.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Suggestions */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <h2 className="text-2xl font-bold tracking-tight">{dict.home.suggestions}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Package,
              title: dict.home.sendPackage,
              text: dict.home.sendPackageBody,
              href: sendHref,
            },
            {
              icon: MapPin,
              title: dict.home.trackDelivery,
              text: dict.home.trackDeliveryBody,
              href: user ? "/app/client/history" : "/login",
            },
            {
              icon: CarFront,
              title: dict.home.becomeDriver,
              text: dict.home.becomeDriverBody,
              href: "/register",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-center justify-between gap-3 rounded-2xl bg-muted p-5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div>
                <p className="text-base font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                <span className="mt-4 inline-flex size-9 items-center justify-center rounded-full bg-background shadow-sm transition-transform group-hover:translate-x-0.5 rtl:rotate-180">
                  <ArrowRight className="size-4" />
                </span>
              </div>
              <item.icon className="size-12 shrink-0 text-foreground/80" strokeWidth={1.5} />
            </Link>
          ))}
        </div>
      </section>

      {/* Track section */}
      <section id="track" className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="relative overflow-hidden rounded-3xl bg-muted p-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-2xl bg-background p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Package className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">#1042</p>
                      <p className="text-xs text-muted-foreground">Hamra → Achrafieh</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    {dict.home.onTheWay}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-background p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Clock className="size-5" />
                    </span>
                    <p className="text-sm font-semibold">{dict.home.arrivingIn}</p>
                  </div>
                  <span className="flex size-2.5 rounded-full bg-brand" aria-hidden />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-background p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <ShieldCheck className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{dict.home.bothConfirm}</p>
                      <p className="text-xs text-muted-foreground">{dict.home.bothConfirmBody}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 flex flex-col gap-5 lg:order-2">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {dict.home.trackTitle}
            </h2>
            <p className="max-w-md text-lg text-muted-foreground">{dict.home.trackBody}</p>
            <div>
              <LinkButton
                href={user ? "/app/client/history" : "/login"}
                variant="secondary"
                className="touch-target h-12 rounded-full px-7 text-base font-semibold"
              >
                {dict.home.trackCta}
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Drive section */}
      <section id="drive" className="border-y bg-[#0a0a0a] text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {dict.home.driveTitle1}
              <br />
              {dict.home.driveTitle2}
            </h2>
            <p className="max-w-md text-lg text-white/70">{dict.home.driveBody}</p>
            <div className="flex flex-wrap gap-3">
              <LinkButton
                href="/register"
                className="touch-target h-12 rounded-full bg-white px-7 text-base font-semibold text-black hover:bg-white/90"
              >
                {dict.home.signUpToDrive}
              </LinkButton>
              <LinkButton
                href="/login"
                variant="ghost"
                className="touch-target h-12 rounded-full px-7 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
              >
                {dict.home.alreadyDriver}
              </LinkButton>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <Image
              src="/logo-lockup.png"
              alt="Direct — Fast. Safe. Reliable."
              width={560}
              height={445}
              className="logo-glow h-auto w-full max-w-sm"
              unoptimized
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Image src="/logo-icon.png" alt="" width={36} height={28} className="h-7 w-auto" unoptimized />
                <span className="text-lg font-extrabold tracking-tight">Direct</span>
              </div>
              <p className="text-sm text-gold/90">{dict.common.tagline}</p>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-white/50">
                {dict.home.footerCompany}
              </p>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-white/80">
                <li>
                  <a href="#about" className="hover:text-white">
                    {dict.home.footerAbout}
                  </a>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white">
                    {dict.home.footerCareers}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-white/50">
                {dict.home.footerProducts}
              </p>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-white/80">
                <li>
                  <Link href={sendHref} className="hover:text-white">
                    {dict.home.footerSend}
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white">
                    {dict.home.footerDrive}
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white">
                    {dict.home.footerBusiness}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-white/50">
                {dict.home.footerSupport}
              </p>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-white/80">
                <li>
                  <Link href="/login" className="hover:text-white">
                    {dict.home.footerHelp}
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white">
                    {dict.home.footerContact}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/50">
            <p>
              © {new Date().getFullYear()} {dict.home.copyright}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
