"use client";

// Build check: which way each demo side photo faces, as the studio's photo ordering sees it.
import { useEffect, useState } from "react";
import { PERSONAS } from "@/lib/demo";

export default function Facing() {
  const [out, setOut] = useState("");
  useEffect(() => {
    (async () => {
      const { facing } = await import("@/lib/faceCrop");
      const rows: string[] = [];
      for (const p of PERSONAS) rows.push(`${p.id}: kept=${await facing(p.kept)} turn_a=${await facing(p.turns[0]!)} turn_b=${await facing(p.turns[1]!)}`);
      setOut(rows.join("\n"));
    })();
  }, []);
  return <pre id="out" data-done={out ? "1" : "0"} style={{ padding: 40 }}>{out || "checking…"}</pre>;
}
