"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfilePhoto({
  src,
  name,
  className,
  size = "default",
}: {
  src?: string | null;
  name: string;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size} className={cn("overflow-hidden", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="font-semibold">{initialsFromName(name)}</AvatarFallback>
    </Avatar>
  );
}
