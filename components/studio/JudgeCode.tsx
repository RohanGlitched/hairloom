"use client";

import { useEffect, useState } from "react";
import { judgeCode, setJudgeCode } from "@/lib/client";

/** Judges enter the code from the Devpost testing notes; live runs then draw on their own daily allowance. */
export function JudgeCode({ onChange }: { onChange: () => void }) {
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { const c = judgeCode(); setCode(c); setSaved(!!c); }, []);
  return (
    <details className="small" style={{ marginTop: 20 }}>
      <summary style={{ cursor: "pointer" }}>{saved ? "Judge code in use" : "Judging this entry? Enter your judge code"}</summary>
      <form
        style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 10 }}
        onSubmit={(e) => { e.preventDefault(); setJudgeCode(code); setSaved(!!code.trim()); onChange(); }}
      >
        <input
          aria-label="Judge code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={64}
          style={{ font: "inherit", padding: "8px 12px", minHeight: 38, borderRadius: 8, border: "1px solid currentColor", background: "transparent", color: "inherit", minWidth: 0, flex: "0 1 220px" }}
        />
        <button className="btn btn-ghost btn-sm">{code.trim() || !saved ? "Use code" : "Clear code"}</button>
        <span>Kept for this tab only. It gives live runs a separate allowance for judging.</span>
      </form>
    </details>
  );
}
