"use client";

import { useEffect, useRef } from "react";

/** The retailer widget as a shop would embed it, resized from the height the widget posts. */
export function EmbedFrame({ wig, className }: { wig: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.hairloom !== "height" || e.data.wig !== wig || !ref.current) return;
      ref.current.style.height = `${e.data.h}px`;
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [wig]);
  return <iframe ref={ref} src={`/embed?wig=${wig}`} title={`Hairloom widget for the ${wig} wig`} className={className} loading="lazy" />;
}
