"use client";

import { Phone } from "lucide-react";
import { ProfilePhoto } from "@/components/profile-photo";
import { Button } from "@/components/ui/button";
import type { PublicContact } from "@/lib/demo-store";

export function LinkedContactCard({
  roleLabel,
  phoneLabel,
  contact,
  photoSrc,
  callLabel,
}: {
  roleLabel: string;
  phoneLabel: string;
  contact: PublicContact;
  photoSrc?: string | null;
  callLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 bg-muted/40 p-3">
      <ProfilePhoto src={photoSrc} name={contact.full_name} className="size-12" />
      <div className="min-w-0 flex-1">
        <p>
          <strong>{roleLabel}:</strong> {contact.full_name}
        </p>
        <p>
          <strong>{phoneLabel}:</strong> {contact.phone}
        </p>
      </div>
      <Button
        nativeButton={false}
        render={<a href={`tel:${contact.phone}`} />}
        size="lg"
        className="touch-target h-12 rounded-full px-6 text-base font-semibold"
        aria-label={`${callLabel} ${contact.phone}`}
      >
        <Phone data-icon="inline-start" />
        {callLabel}
      </Button>
    </div>
  );
}
