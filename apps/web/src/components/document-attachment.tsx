"use client";

import Image from "next/image";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DocumentAttachmentProps = {
  label: string;
  fileName: string;
  fileData?: string;
  openLabel: string;
  noPreview: string;
};

export function DocumentAttachment({
  label,
  fileName,
  fileData,
  openLabel,
  noPreview,
}: DocumentAttachmentProps) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11 max-w-full gap-2 rounded-full px-3"
            aria-label={`${openLabel}: ${label}`}
          />
        }
      >
        <Paperclip data-icon="inline-start" />
        <span className="max-w-48 truncate">{fileName || label}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>
        {fileData ? (
          <Image
            src={fileData}
            alt={label}
            width={900}
            height={900}
            className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
            unoptimized
          />
        ) : (
          <p className="text-base text-muted-foreground">{noPreview}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
