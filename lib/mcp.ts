import "server-only";
import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { LENGTH_LABEL, WIGS, inr, type Length, type Texture } from "./catalogue";
import { deltaE00, hexToLab, nearestShades } from "./color";
import { measured, renderLab, wigShade } from "./colours";
import { PERSONAS } from "./demo";
import { KINDS } from "./kinds";
import { FITTINGS, unitsOf, usd } from "./pricing";
import { band, capSize, closeness, lengthFromTerm, lengthStep, textureFromType, textureStep } from "./match";

/**
 * Hairloom for a wig fitter's AI assistant: an MCP server (Streamable HTTP at /api/mcp). It answers the
 * questions a fitter asks before a client arrives: what to pull from stock, in which shade, what cap,
 * and when. It never sees client photos; for live try-ons, pair it with YouCam's own hosted MCP servers.
 */

const SITE = process.env.PUBLIC_ORIGIN ?? "https://hairloom-studio.vercel.app";

export const SERVER_INSTRUCTIONS = `Hairloom helps wig fitters prepare for clients facing hair loss (chemotherapy, alopecia, thinning).
A client's hair passport records curl pattern (YouCam hair type, e.g. "1 to 2A"), length (e.g. "above chest"), hair colour (hex, measured from the hair pixels), head size in cm and parting.
Use match_wigs to rank stock against a passport and get a pull list in the client's shade (pass the boutique's own stock, or it uses the Hairloom demo boutique); shade_for_colour to turn a hex into common wig shade codes; list_stock to browse; show_on_demo_person for a free example render; fitting_plan for dates around treatment; fitting_cost for YouCam API cost.
For live try-ons on a client's own photo, use YouCam's hosted MCP servers (https://mcp-api-01.makeupar.com/mcp/fashion and /mcp/beauty) or the Hairloom studio, which stores photos only on the client's device and deletes each YouCam task after its result.
Hairloom is about appearance, not medical care: never diagnose, and point clinical questions to the client's care team. Shade codes vary by brand; always confirm against real swatches.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const hex = z.string().regex(/^#?[0-9a-fA-F]{6}$/).transform((s) => (s.startsWith("#") ? s : `#${s}`));
const TEXTURES = ["straight", "wavy", "curly", "coily"] as const;
const LENGTHS = ["ear", "chin", "shoulder", "chest", "midback"] as const;

function describeWig(id: string) {
  const w = WIGS.find((x) => x.id === id)!;
  const sh = wigShade(w);
  return `${w.name} (${w.fit}): ${w.style}. ${LENGTH_LABEL[w.length]}, ${w.texture}, stock shade ${sh.code} ${sh.name.toLowerCase()}, ${w.cap}, ${w.fibre}, ${inr(w.price)}, care ${w.care.toLowerCase()}.`;
}

function register(server: McpServer) {
  server.registerTool(
    "list_stock",
    {
      title: "List the boutique's wigs",
      description: "Lists wigs in the demo boutique (Kesh & Co., fictional), with shade codes measured from each product photo. Optional filters.",
      inputSchema: z.object({
        fit: z.enum(["Women", "Men"]).optional(),
        length: z.enum(LENGTHS).optional(),
        texture: z.enum(TEXTURES).optional(),
        max_price_inr: z.number().int().positive().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ fit, length, texture, max_price_inr }) => {
      const rows = WIGS.filter((w) => (!fit || w.fit === fit) && (!length || w.length === length) && (!texture || w.texture === texture) && (!max_price_inr || w.price <= max_price_inr));
      if (!rows.length) return text("No wigs match those filters.");
      return text([`${rows.length} wigs:`, ...rows.map((w) => `- ${describeWig(w.id)} Photo: ${SITE}/catalogue/${w.id}.jpg`)].join("\n"));
    },
  );

  server.registerTool(
    "match_wigs",
    {
      title: "Rank stock against a client's hair passport",
      description: "Ranks wigs by how close each is to the hair the client kept (length, texture and measured colour), and returns a pull list in the client's nearest shade code with a cap note. Pass `stock` to rank the boutique's own wigs; without it, ranks the Hairloom demo boutique.",
      inputSchema: z.object({
        hair_length: z.string().max(40).optional().describe('YouCam hair length term, e.g. "above chest", "ear length"'),
        hair_type: z.string().max(20).optional().describe('YouCam hair type mapping, e.g. "1 to 2A", "4A to 4B"'),
        hair_hex: hex.optional().describe("Measured hair colour, e.g. #342820"),
        head_cm: z.number().min(45).max(65).optional(),
        fit: z.enum(["Women", "Men"]).optional(),
        top: z.number().int().min(1).max(10).optional(),
        stock: z.array(z.object({
          name: z.string().min(1).max(60),
          length: z.enum(LENGTHS),
          texture: z.enum(TEXTURES),
          hex: hex.optional().describe("Colour of the wig as stocked, if known"),
          cap: z.string().max(60).optional(),
          price_inr: z.number().nonnegative().optional(),
          fit: z.enum(["Women", "Men"]).optional(),
        })).min(1).max(100).optional().describe("The boutique's own wigs. Omit to use the demo boutique."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ hair_length, hair_type, hair_hex, head_cm, fit, top = 5, stock }) => {
      const len = lengthFromTerm(hair_length) as Length | null;
      const tex = textureFromType(hair_type) as Texture | null;
      const lab = hair_hex ? hexToLab(hair_hex) : null;
      const client = lab ? nearestShades(lab, 1)[0] : null;
      // One shape for both sources; demo wigs carry the colour measured from their product photo.
      const rows = stock
        ? stock.map((w) => ({ name: w.name, fit: w.fit, length: w.length as Length, texture: w.texture as Texture, lab: w.hex ? hexToLab(w.hex) : null, cap: w.cap ?? "cap not given", price: w.price_inr, shade: w.hex ? nearestShades(hexToLab(w.hex), 1)[0].code : null }))
        : WIGS.map((w) => ({ name: w.name, fit: w.fit, length: w.length, texture: w.texture, lab: measured(`catalogue/${w.id}`), cap: w.cap, price: w.price as number | undefined, shade: wigShade(w).code as string | null }));
      const ranked = rows.filter((w) => !fit || !w.fit || w.fit === fit)
        .map((w) => {
          const dE = lab && w.lab ? deltaE00(lab, w.lab) : null;
          return { w, score: closeness(w, { length: len, texture: tex }, dE) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, top);
      const kept = len ? `${hair_length!.trim()} (matched to ${LENGTH_LABEL[len].toLowerCase()}-length wigs)` : "length not given";
      const lines = [
        `Client: ${kept}, ${tex ?? "texture not given"}${client ? `, nearest shade ${client.code} (${client.name.toLowerCase()})` : ""}${head_cm ? `, ${capSize(head_cm)} cap (${head_cm} cm)` : ""}.`,
        `Ranking ${stock ? `your ${stock.length} wigs` : "the Hairloom demo boutique (pass `stock` for your own)"}${lab ? ", colour compared with each wig's stocked colour" : ""}:`,
        ...ranked.map(({ w, score }, i) => `${i + 1}. ${w.name} — ${band(score)}. ${lengthStep(len, w.length)?.word ?? LENGTH_LABEL[w.length]}; ${textureStep(tex, w.texture)?.word ?? w.texture}; ${w.cap}${w.price != null ? `; ${inr(w.price)}` : ""}.`),
        "",
        "Pull list:",
        ...ranked.slice(0, 3).map(({ w }) => `- ${w.name} in shade ${client?.code ?? w.shade ?? "as stocked"}${client ? " and one shade either side" : w.shade ? " (stock shade)" : ""}.`),
        `- An adjustable cap${head_cm ? ` around ${capSize(head_cm)!.toLowerCase()}` : ""}: heads can be up to a size smaller after hair loss (American Cancer Society). Re-measure at the fitting.`,
      ];
      return text(lines.join("\n"));
    },
  );

  server.registerTool(
    "shade_for_colour",
    {
      title: "Wig shade codes for a hair colour",
      description: "Returns the nearest common wig shade codes for a hex colour, by CIEDE2000. Codes vary by brand; confirm with swatches.",
      inputSchema: z.object({ hex, count: z.number().int().min(1).max(6).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ hex: h, count = 3 }) => {
      const near = nearestShades(hexToLab(h), count);
      return text(near.map((n) => `${n.code} — ${n.name} (ΔE00 ${n.dE.toFixed(1)}${n.dE < 3 ? ", hard to tell apart" : ""})`).join("\n"));
    },
  );

  server.registerTool(
    "show_on_demo_person",
    {
      title: "A wig on a demo person after hair loss",
      description: "Returns a precomputed YouCam hairstyle try-on of a stock wig on one of Hairloom's demo people (generated, not real customers). Free; no photo needed.",
      inputSchema: z.object({ wig: z.string().max(20), person: z.enum(["anjali", "nia", "margaret", "ravi"]).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ wig, person }) => {
      const w = WIGS.find((x) => x.id === wig.toLowerCase() || x.name.toLowerCase() === wig.toLowerCase());
      if (!w) return text(`No wig called "${wig}". Try list_stock.`);
      const p = PERSONAS.find((x) => x.id === person) ?? PERSONAS.find((x) => x.fit === w.fit) ?? PERSONAS[0];
      const src = p.wigs[w.id];
      if (!src) return text(`${w.name} hasn't been rendered on ${p.name}.`);
      const dE = (() => { const a = measured(`${p.id}/kept`), b = renderLab(p.id, `wig:${w.id}`); return a && b ? deltaE00(a, b) : null; })();
      return text(`${w.name} on ${p.name} (${p.later.toLowerCase()}, demo person generated with YouCam): ${SITE}${src}\nKept photo: ${SITE}${p.kept}\n${dE != null ? `Colour difference from the hair ${p.name} kept: ΔE00 ${dE.toFixed(1)}.` : ""}`);
    },
  );

  server.registerTool(
    "fitting_plan",
    {
      title: "Dates to plan around treatment",
      description: "General timings from cancer charities (ACS, CRUK, Macmillan) for when to keep a passport, choose a wig, re-measure and expect regrowth. Not medical advice.",
      inputSchema: z.object({ first_treatment: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), last_treatment: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ first_treatment, last_treatment }) => {
      const s = new Date(first_treatment + "T09:00Z");
      const d = (base: Date, n: number) => new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10);
      const lines = [
        `${d(s, -14)}: keep the hair passport (three photos, head size, parting).`,
        `${d(s, -10)}: choose and fit a wig while colour and style can still be matched.`,
        `${d(s, 14)}: hair usually starts to fall out about 2–3 weeks after the first cycle.`,
        `${d(s, 21)}: re-measure the head and adjust the cap.`,
        `${d(s, 42)}: brows and lashes may thin; offer brow help.`,
      ];
      if (last_treatment) lines.push(`${d(new Date(last_treatment + "T09:00Z"), 90)}: regrowth usually starts within about 3–6 months of finishing, sometimes curlier or a different colour.`);
      lines.push("General guidance only; the client's care team knows their regimen.");
      return text(lines.join("\n"));
    },
  );

  server.registerTool(
    "fitting_cost",
    {
      title: "YouCam API cost of a client fitting",
      description: "Units and dollars for a Hairloom fitting at YouCam's published prices ($0.048 a unit on subscription, $0.055 pay as you go). Give a scenario (chemo, thinning, sponsored) or itemise the steps.",
      inputSchema: z.object({
        scenario: z.enum(["chemo", "thinning", "sponsored"]).optional().describe("chemo: a full wig fitting (also alopecia); thinning: toppers and volume; sponsored: what a hospital or wig bank pays per patient"),
        passport: z.enum(["full", "lite", "none"]).optional(),
        wig_tryons: z.number().int().min(0).max(50).optional(),
        recolours: z.number().int().min(0).max(50).optional(),
        headwear: z.number().int().min(0).max(20).optional(),
        brows: z.number().int().min(0).max(5).optional(),
        own_hair: z.number().int().min(0).max(5).optional(),
        skin_checkins: z.number().int().min(0).max(20).optional(),
        volume_previews: z.number().int().min(0).max(20).optional(),
        topper_previews: z.number().int().min(0).max(20).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ scenario, passport = "full", wig_tryons = 8, recolours = 3, headwear = 3, brows = 1, own_hair = 1, skin_checkins = 0, volume_previews = 0, topper_previews = 0 }) => {
      const price = (units: number) => `${units} units: $${usd(units, "sub")} on a subscription, $${usd(units, "payg")} pay as you go.`;
      const f = FITTINGS.find((x) => x.id === scenario);
      if (f) return text(`${f.title}. ${price(unitsOf(f))} ${f.who}\n${f.steps.map(([k, n, label]) => `- ${label}: ${n} × ${KINDS[k].api}, ${n * KINDS[k].units} units`).join("\n")}`);
      const lite = KINDS.hairType.units + KINDS.hairFrizz.units + KINDS.hairLength.units;
      const pass = passport === "full" ? lite + KINDS.face.units : passport === "lite" ? lite : 0;
      const units = pass + wig_tryons * KINDS.wig.units + recolours * KINDS.hairColor.units + headwear * KINDS.headwear.units + brows * KINDS.brows.units + own_hair * KINDS.ownHair.units + skin_checkins * KINDS.skin.units + volume_previews * KINDS.hairVol.units + topper_previews * KINDS.hairExt.units;
      return text(`${price(units)} (Passport ${pass}, try-ons ${wig_tryons * KINDS.wig.units}, recolours ${recolours}, headwear ${headwear}, brows ${brows}, own hair ${own_hair * KINDS.ownHair.units}, skin ${skin_checkins * KINDS.skin.units}, volume ${volume_previews * KINDS.hairVol.units}, toppers ${topper_previews * KINDS.hairExt.units}.)`);
    },
  );
}

export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

const inner = createMcpHandler(register, { serverInfo: { name: "Hairloom", version: "1.0.0" }, instructions: SERVER_INSTRUCTIONS });

export async function mcpHandler(req: Request): Promise<Response> {
  const res = await inner(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
