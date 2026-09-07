"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Paperclip, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

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
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="flex max-h-[96vh] w-[min(100%-1rem,96vw)] max-w-none flex-col gap-3 overflow-hidden sm:max-w-none">
        <DialogHeader className="pr-10">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>
        {fileData ? (
          <ImageLightbox
            src={fileData}
            alt={label}
            zoomInLabel={dict.admin.zoomIn}
            zoomOutLabel={dict.admin.zoomOut}
            resetZoomLabel={dict.admin.resetZoom}
            zoomHint={dict.admin.zoomHint}
            active={open}
          />
        ) : (
          <p className="text-base text-muted-foreground">{noPreview}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImageLightbox({
  src,
  alt,
  zoomInLabel,
  zoomOutLabel,
  resetZoomLabel,
  zoomHint,
  active,
}: {
  src: string;
  alt: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  resetZoomLabel: string;
  zoomHint: string;
  active: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null,
  );
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [active]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !active) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      setScale((current) => clamp(current * factor, MIN_SCALE, MAX_SCALE));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [active]);

  useEffect(() => {
    if (scale <= MIN_SCALE) setOffset({ x: 0, y: 0 });
  }, [scale]);

  function zoomBy(factor: number) {
    setScale((current) => clamp(current * factor, MIN_SCALE, MAX_SCALE));
  }

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: dist(a, b), scale };
      drag.current = null;
      return;
    }
    if (scale > MIN_SCALE) {
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const next = pinchStart.current.scale * (dist(a, b) / pinchStart.current.distance);
      setScale(clamp(next, MIN_SCALE, MAX_SCALE));
      return;
    }

    if (drag.current && scale > MIN_SCALE) {
      setOffset({
        x: drag.current.originX + (event.clientX - drag.current.x),
        y: drag.current.originY + (event.clientY - drag.current.y),
      });
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinchStart.current = null;
    drag.current = null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="touch-target"
          aria-label={zoomOutLabel}
          onClick={() => zoomBy(0.8)}
          disabled={scale <= MIN_SCALE}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="touch-target"
          aria-label={zoomInLabel}
          onClick={() => zoomBy(1.25)}
          disabled={scale >= MAX_SCALE}
        >
          <Plus />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-target h-11 gap-2 rounded-full px-4"
          aria-label={resetZoomLabel}
          onClick={reset}
          disabled={scale <= MIN_SCALE}
        >
          <RotateCcw data-icon="inline-start" />
          {resetZoomLabel}
        </Button>
        <p className="text-sm text-muted-foreground">{zoomHint}</p>
      </div>
      <div
        ref={stageRef}
        className="relative flex min-h-[60vh] flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          if (scale > MIN_SCALE) reset();
          else setScale(2.5);
        }}
      >
        {/* Native img so CSS zoom/pan is not constrained by next/image sizing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full w-auto max-w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
