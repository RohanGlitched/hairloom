"use client";

import { useState } from "react";
import type { Readings } from "@/lib/demo";
import type { SharePayload } from "@/lib/seal";
import s from "./fitter.module.css";

type Step = { tool: string; why: string; args: Record<string, unknown>; status: "running" | "done" | "error"; text?: string; image?: string };
type Pull = { name: string; shade: string }[];

/** A JSON-RPC call to this site's MCP server, as any MCP client would make it. */
async function rpc(body: unknown, sid: string | null) {
  const r = await fetch("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(sid ? { "mcp-session-id": sid } : {}) },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  const data = t.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5))).at(-1) ?? (t.trim().startsWith("{") ? JSON.parse(t) : null);
  if (!r.ok || !data || data.error) throw new Error(data?.error?.message ?? `The MCP server answered ${r.status}.`);
  return { sid: r.headers.get("mcp-session-id") ?? sid, data };
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso.slice(0, 10)}T00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * "Ask the fitter desk": a rules-based planner, not a language model. It always calls the same MCP tools
 * in the same order with the brief's own values, shows each call and its answer, and ends in a pull list.
 */
export function Desk({ brief, situation, person, fit }: { brief: SharePayload; situation: "chemo" | "alopecia"; person?: string; fit?: "Women" | "Men" }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [pull, setPull] = useState<Pull | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const r = brief.readings as Readings;
  const first = name(brief.name);

  async function run() {
    setBusy(true); setErr(null); setSteps([]); setPull(null);
    const today = new Date().toISOString().slice(0, 10);
    // Chemotherapy: the fitting is about ten days before the first treatment, as the plan advises.
    const start = situation === "alopecia" ? today : addDays(brief.appointment ?? today, 10);
    const grey = brief.colour?.grey != null ? Math.round(brief.colour.grey * 100) : undefined;
    const plan: Omit<Step, "status">[] = [
      { tool: "match_wigs", why: `Rank the shop's stock against ${first}'s passport`, args: { hair_length: r.length?.term, hair_type: r.type?.mapping, hair_hex: brief.colour?.hex, hair_grey_percent: grey, hair_base_hex: grey != null && grey >= 15 ? brief.colour?.base : undefined, head_cm: brief.cap?.cm ?? undefined, fit, top: 3 } },
      { tool: "shade_for_colour", why: "Turn the measured colour into shade codes", args: { hex: brief.colour?.hex, count: 3, grey_percent: grey, base_hex: grey != null && grey >= 15 ? brief.colour?.base : undefined } },
      { tool: "fitting_plan", why: situation === "alopecia" ? "A monthly plan from today" : "Dates around treatment", args: { first_treatment: start, situation, skin_redness: brief.skin?.redness, skin_moisture: brief.skin?.moisture } },
    ];
    let sid: string | null = null;
    try {
      ({ sid } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "hairloom-fitter-desk", version: "1" } } }, null));
      await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, sid).catch(() => undefined);
      let top: string | null = null;
      const all = [...plan];
      for (let i = 0; i < all.length; i++) {
        const st = all[i];
        const args = Object.fromEntries(Object.entries(st.args).filter(([, v]) => v !== undefined && v !== null));
        setSteps((x) => [...x, { ...st, args, status: "running" }]);
        const { data } = await rpc({ jsonrpc: "2.0", id: i + 2, method: "tools/call", params: { name: st.tool, arguments: args } }, sid);
        const res = data.result as { content?: { text?: string }[]; structuredContent?: { pull?: Pull; wigs?: { name: string }[] } };
        const text = res.content?.map((c) => c.text ?? "").join("\n").trim() ?? "";
        let image: string | undefined;
        if (st.tool === "match_wigs") {
          setPull(null);
          top = res.structuredContent?.wigs?.[0]?.name ?? null;
          if (res.structuredContent?.pull) setPull(res.structuredContent.pull);
          // Then show the top wig on a demo person after hair loss: a prepared render, no units.
          if (top && i === 0) all.push({ tool: "show_on_demo_person", why: `Show ${top} on a demo person after hair loss`, args: { wig: top, person } });
        }
        if (st.tool === "show_on_demo_person") image = /https?:\/\/\S+?(\/demo\/\S+\.(?:jpg|png))/.exec(text)?.[1];
        setSteps((x) => x.map((y, j) => (j === i ? { ...y, status: "done", text, image } : y)));
      }
    } catch (e) {
      setErr((e as Error).message || "The desk couldn't reach the MCP server.");
      setSteps((x) => x.map((y) => (y.status === "running" ? { ...y, status: "error" } : y)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.chat} aria-label="Ask the fitter desk">
      <p className={s.chatLabel}>Ask the fitter desk</p>
      <p className={s.me}>{first}&rsquo;s fitting is {brief.appointment ? "coming up" : "soon"}. What should I pull?</p>
      <div className={s.deskBar}>
        <button className="btn btn-ink btn-sm" disabled={busy} onClick={run}>{busy ? "Working through the tools…" : steps.length ? "Run it again" : "Run the desk"}</button>
        <span className={s.deskNote}>Planned by fixed rules, not a language model. Each step is a real call to this site&rsquo;s MCP server: no model calls, no YouCam units.</span>
      </div>
      {steps.map((st, i) => (
        <div key={i} className={s.deskStep}>
          <p className={s.tool}>{i + 1}. {st.tool} · {st.why}{st.status === "running" ? " …" : ""}</p>
          <p className={s.deskArgs}>{JSON.stringify(st.args)}</p>
          {st.text && (
            <div className={s.bot}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {st.image && <img src={st.image} alt={`${st.args.wig} on a demo person after hair loss`} />}
              <p className={s.deskOut}>{st.text.split("\n").filter((l) => !/^Kept photo:/.test(l)).map((l) => l.replace(/:?\s*https?:\/\/\S+/g, "")).slice(0, 14).join("\n")}</p>
            </div>
          )}
        </div>
      ))}
      {pull && !busy && (
        <div className={s.bot}>
          <p><b>Pull list for {first}</b></p>
          <ol>{pull.map((p) => <li key={p.name}>{p.name} in shade {p.shade}</li>)}</ol>
          <p>Plus an adjustable cap{brief.cap?.cm ? ` (${brief.cap.cm} cm head)` : ""}: heads can be up to a size smaller after hair loss.</p>
        </div>
      )}
      {err && <p className={s.err} role="alert">{err}</p>}
    </div>
  );
}

const name = (n: string) => n.replace(/\s*\(demo\)$/, "");
