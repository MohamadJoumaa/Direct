"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
} & VariantProps<typeof buttonVariants>;

/** Base UI button rendered as Next.js Link */
export function LinkButton({
  href,
  children,
  className,
  variant = "default",
  size = "default",
}: Props) {
  return (
    <Button
      nativeButton={false}
      render={<Link href={href} />}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {children}
    </Button>
  );
}
