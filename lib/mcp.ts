import "server-only";
import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { LENGTH_LABEL, WIGS, inr, type Length, type Texture } from "./catalogue";
import { deltaE00, greyBlend, hexToLab, nearestShades } from "./color";
import { measured, renderLab, wigShade } from "./colours";
import { PERSONAS } from "./demo";
import { KINDS } from "./kinds";
import { FITTINGS, unitsOf, usd } from "./pricing";
import { band, capSize, closeness, lengthFromTerm, lengthStep, orLonger, textureFromType, textureStep } from "./match";
import { CAPS, demoSku, shadeLab } from "./stock";
import { liningNote } from "./skinNote";

/**
 * Hairloom for a wig fitter's AI assistant: an MCP server (Streamable HTTP at /api/mcp). It answers the
 * questions a fitter asks before a client arrives: what to pull from stock, in which shade, what cap,
 * and when. It never sees client photos; for live try-ons, pair it with YouCam's own hosted MCP servers.
 */

const SITE = process.env.PUBLIC_ORIGIN ?? "https://hairloom-studio.vercel.app";

export const SERVER_INSTRUCTIONS = `Hairloom helps wig fitters prepare for clients facing hair loss (chemotherapy, alopecia, thinning).
A client's kept-hair record holds curl pattern (YouCam hair type, e.g. "1 to 2A"), length (e.g. "above chest"), hair colour (hex, measured from the hair pixels), head size in cm and parting.
Use match_wigs to rank stock against the hair a client kept and get a pull list in the client's shade (pass the boutique's own stock, or it uses the Hairloom demo boutique); shade_for_colour to turn a hex into common wig shade codes; list_stock to browse; show_on_demo_person for a free example render; fitting_plan for dates around treatment; fitting_cost for YouCam API cost.
For live try-ons on a client's own photo, use YouCam's hosted MCP servers (https://mcp-api-01.makeupar.com/mcp/fashion and /mcp/beauty) or the Hairloom studio, which stores photos only on the client's device and deletes each YouCam task after its result.
Hairloom is about appearance, not medical care: never diagnose, and point clinical questions to the client's care team. Shade codes vary by brand; always confirm against real swatches.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
/** Text for the model to read, plus the same answer as structured data for clients that use it. */
const both = <T extends Record<string, unknown>>(t: string, data: T) => ({ content: [{ type: "text" as const, text: t }], structuredContent: data });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => { const d = new Date(s + "T00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, "Not a real date (YYYY-MM-DD)");
const MATCH_OUT = z.object({
  client: z.object({ length: z.string().nullable(), texture: z.string().nullable(), shade: z.string().nullable(), cap: z.string().nullable() }),
  source: z.enum(["demo", "yours"]),
  wigs: z.array(z.object({ name: z.string(), band: z.string(), score: z.number(), length: z.string(), texture: z.string(), cap: z.string(), price_inr: z.number().nullable(), stocked_shade: z.string().nullable(), sku: z.string().optional(), url: z.string().optional() })),
  pull: z.array(z.object({ name: z.string(), shade: z.string(), sku: z.string().optional(), url: z.string().optional(), hold: z.string().optional() })),
});
const COST_OUT = z.object({ units: z.number(), usd_subscription: z.string(), usd_pay_as_you_go: z.string(), scenario: z.string().nullable() });
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
      description: "Lists wigs in the demo boutique (Kesh & Co., fictional), with their listed shade codes. Optional filters.",
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
      title: "Rank stock against the hair a client kept",
      description: "Ranks wigs by how close each is to the hair the client kept (length, texture and measured colour), and returns a pull list in the client's nearest shade code with a cap note. Pass `stock` to rank the boutique's own wigs; without it, ranks the Hairloom demo boutique.",
      inputSchema: z.object({
        hair_length: z.string().max(40).optional().describe('YouCam hair length term, e.g. "above chest", "ear length"'),
        hair_type: z.string().max(20).optional().describe('YouCam hair type mapping, e.g. "1 to 2A", "4A to 4B"'),
        hair_hex: hex.optional().describe("Measured hair colour, e.g. #342820"),
        hair_grey_percent: z.number().min(0).max(100).optional().describe("Share of grey hair pixels, 0-100, from the Hairloom kept-hair record. From 15 up, the pull list names a grey blend."),
        hair_base_hex: hex.optional().describe("Colour of the hair that isn't grey, from the kept-hair record; the base of a grey blend"),
        head_cm: z.number().min(45).max(65).optional(),
        fit: z.enum(["Women", "Men"]).optional(),
        top: z.number().int().min(1).max(10).optional(),
        stock: z.array(z.object({
          name: z.string().min(1).max(60),
          length: z.enum(LENGTHS),
          texture: z.enum(TEXTURES),
          hex: hex.optional().describe("Colour of the wig as stocked, if known"),
          shade_code: z.string().regex(/^[0-9A-Za-z]{1,4}(\/[0-9A-Za-z]{1,4})?$/).optional().describe('The wig shade code as stocked, e.g. "4" or "1B/44"; used for colour when hex is not given'),
          sku: z.string().max(40).optional(),
          caps: z.array(z.enum(CAPS)).max(3).optional().describe("Cap sizes in stock"),
          url: z.string().max(300).regex(/^https:\/\//).optional().describe("Product page"),
          cap: z.string().max(60).optional(),
          price_inr: z.number().nonnegative().optional(),
          fit: z.enum(["Women", "Men"]).optional(),
        })).min(1).max(100).optional().describe("The boutique's own wigs. Omit to use the demo boutique."),
      }),
      outputSchema: MATCH_OUT,
      annotations: { readOnlyHint: true },
    },
    async ({ hair_length, hair_type, hair_hex, hair_grey_percent, hair_base_hex, head_cm, fit, top = 5, stock }) => {
      const len = lengthFromTerm(hair_length) as Length | null;
      const tex = textureFromType(hair_type) as Texture | null;
      const more = orLonger(hair_length);
      const lab = hair_hex ? hexToLab(hair_hex) : null;
      const client = lab ? nearestShades(lab, 1)[0] : null;
      // A blend's base is the hair that isn't grey; without it, the whole hair's colour stands in.
      const blend = hair_grey_percent != null ? greyBlend(hair_grey_percent / 100, hair_base_hex ? hexToLab(hair_base_hex) : lab) : null;
      // One shape for both sources; demo wigs carry the colour measured from their product photo.
      const rows = stock
        ? stock.map((w) => ({ name: w.name, fit: w.fit, length: w.length as Length, texture: w.texture as Texture, lab: w.hex ? hexToLab(w.hex) : w.shade_code ? shadeLab(w.shade_code) : null, cap: w.cap ?? (w.caps?.length ? `caps ${w.caps.join("/")}` : "cap not given"), caps: w.caps, price: w.price_inr, shade: w.shade_code ?? (w.hex ? nearestShades(hexToLab(w.hex), 1)[0].code : null), sku: w.sku, url: w.url }))
        : WIGS.map((w) => ({ name: w.name, fit: w.fit, length: w.length, texture: w.texture, lab: measured(`catalogue/${w.id}`), cap: w.cap, caps: undefined as string[] | undefined, price: w.price as number | undefined, shade: wigShade(w).code as string | null, sku: demoSku(w) as string | undefined, url: `${SITE}/embed?wig=${w.id}` as string | undefined }));
      const ranked = rows.filter((w) => !fit || !w.fit || w.fit === fit)
        .map((w) => {
          const dE = lab && w.lab ? deltaE00(lab, w.lab) : null;
          return { w, score: closeness(w, { length: len, texture: tex, orLonger: more }, dE) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, top);
      const kept = len ? `${hair_length!.trim()} (matched to ${LENGTH_LABEL[len].toLowerCase()}-length wigs)` : "length not given";
      const best = ranked[0]?.score;
      // Pull what is close; a "new look" only when nothing in stock is closer.
      const close = ranked.filter(({ score }) => band(score, best) !== "A new look");
      const want = capSize(head_cm);
      const pull = (close.length ? close : ranked).slice(0, 3).map(({ w }) => {
        const shadeTxt = client ? `${client.code}${blend ? ` or the ${blend.code} grey blend` : ""} and one shade either side${w.shade && w.shade !== client.code ? ` (stocked as ${w.shade})` : ""}` : w.shade ? `${w.shade} (stock shade)` : "as stocked";
        const cap = want && (!w.caps || w.caps.includes(want)) ? want : w.caps?.[0] ?? null;
        const hold = w.sku ? `Hold ${w.sku} (${w.name}) in shade ${client?.code ?? w.shade ?? "as stocked"}${cap ? `, cap ${cap}` : ""}.` : undefined;
        return { name: w.name, shade: shadeTxt, ...(w.sku ? { sku: w.sku } : {}), ...(w.url ? { url: w.url } : {}), ...(hold ? { hold } : {}) };
      });
      const lines = [
        `Client: ${kept}, ${tex ?? "texture not given"}${client ? `, nearest shade ${client.code} (${client.name.toLowerCase()})` : ""}${hair_grey_percent != null && hair_grey_percent >= 5 ? `, about ${Math.round(hair_grey_percent)}% grey${blend ? ` (try a ${blend.code} blend, by eye)` : ""}` : ""}${head_cm ? `, ${capSize(head_cm)} cap (${head_cm} cm)` : ""}.`,
        `Ranking ${stock ? `your ${stock.length} wigs` : "the Hairloom demo boutique (pass `stock` for your own)"}${lab ? ", colour compared with each wig's stocked colour" : ""}:`,
        ...ranked.map(({ w, score }, i) => `${i + 1}. ${w.name} — ${band(score, best)}. ${lengthStep(len, w.length, more)?.word ?? LENGTH_LABEL[w.length]}; ${textureStep(tex, w.texture)?.word ?? w.texture}; ${w.cap}${w.price != null ? `; ${inr(w.price)}` : ""}.`),
        "",
        "Pull list:",
        ...pull.map((x) => `- ${x.name} in shade ${x.shade}.${x.hold ? ` ${x.hold}` : ""}${x.url ? ` ${x.url}` : ""}`),
        `- An adjustable cap${head_cm ? ` around ${capSize(head_cm)!.toLowerCase()}` : ""}: heads can be up to a size smaller after hair loss (American Cancer Society). Re-measure at the fitting.`,
        ...(close.length ? [] : ["Nothing in stock is close to the hair the client kept; these are the nearest."]),
      ];
      return both(lines.join("\n"), {
        client: { length: len, texture: tex, shade: client?.code ?? null, cap: head_cm ? capSize(head_cm) : null },
        source: stock ? "yours" : "demo",
        wigs: ranked.map(({ w, score }) => ({ name: w.name, band: band(score, best), score, length: w.length, texture: w.texture, cap: w.cap, price_inr: w.price ?? null, stocked_shade: w.shade ?? null, ...(w.sku ? { sku: w.sku } : {}), ...(w.url ? { url: w.url } : {}) })),
        pull,
      });
    },
  );

  server.registerTool(
    "shade_for_colour",
    {
      title: "Wig shade codes for a hair colour",
      description: "Returns the nearest common wig shade codes for a hex colour, by CIEDE2000. Codes vary by brand; confirm with swatches.",
      inputSchema: z.object({ hex, count: z.number().int().min(1).max(6).optional(), grey_percent: z.number().min(0).max(100).optional().describe("Share of grey hair, 0-100; from 15 up a grey blend is suggested"), base_hex: hex.optional().describe("Colour of the hair that isn't grey, the base of a blend") }),
      annotations: { readOnlyHint: true },
    },
    async ({ hex: h, count = 3, grey_percent, base_hex }) => {
      const near = nearestShades(hexToLab(h), count);
      const blend = grey_percent != null ? greyBlend(grey_percent / 100, hexToLab(base_hex ?? h)) : null;
      return text([
        ...near.map((n) => `${n.code} — ${n.name} (ΔE00 ${n.dE.toFixed(1)}${n.dE < 3 ? ", hard to tell apart" : ""})`),
        ...(blend ? [`About ${Math.round(grey_percent!)}% grey: try a ${blend.code} blend (${blend.name.toLowerCase()}), judged by eye against swatches.`] : []),
      ].join("\n"));
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
      description: "General timings from cancer charities (ACS, CRUK, Macmillan) for when to keep a record of the hair, choose a wig, re-measure and expect regrowth; or, for alopecia, a monthly photo plan from a start date. Not medical advice.",
      inputSchema: z.object({
        first_treatment: isoDate.describe("Chemotherapy: the first treatment. Alopecia: the day to start."), last_treatment: isoDate.optional(), situation: z.enum(["chemo", "alopecia"]).optional(),
        skin_redness: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).optional().describe("First and latest YouCam redness score from the client's skin check-ins (higher is better)"),
        skin_moisture: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).optional().describe("First and latest YouCam moisture score (higher is better)"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ first_treatment, last_treatment, situation = "chemo", skin_redness, skin_moisture }) => {
      const lining = liningNote({ redness: skin_redness, moisture: skin_moisture });
      const s = new Date(first_treatment + "T09:00Z");
      const d = (base: Date, n: number) => new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10);
      if (situation === "alopecia") {
        return text([
          `${d(s, 0)}: keep a record of the hair now, while the hair still covers the patches.`,
          `${d(s, 7)}: if the patches are small, show volume and clip-in previews or a topper before a full wig.`,
          ...[30, 60, 90].map((n) => `${d(s, n)}: a monthly photo in the same light, so the client and their dermatologist can see whether patches spread, settle or regrow.`),
          "Alopecia areata is unpredictable; a fitter can plan for both a topper and a full wig. General guidance only.",
        ].join("\n"));
      }
      const lines = [
        `${d(s, -14)}: keep a record of the hair (three photos, head size, parting).`,
        `${d(s, -10)}: choose and fit a wig while colour and style can still be matched.`,
        `${d(s, 14)}: hair usually starts to fall out about 2–3 weeks after the first cycle.`,
        `${d(s, 21)}: re-measure the head and adjust the cap.`,
        `${d(s, 42)}: brows and lashes may thin; offer brow help.`,
      ];
      if (lining) lines.push(`For the cap: ${lining}`);
      if (last_treatment) lines.push(`${d(new Date(last_treatment + "T09:00Z"), 90)}: regrowth usually starts within about 3–6 months of finishing, sometimes curlier or a different colour.`);
      lines.push("General guidance only; the client's care team knows their regimen.");
      return text(lines.join("\n"));
    },
  );

  server.registerTool(
    "fitting_cost",
    {
      title: "YouCam API cost of a client fitting",
      description: "Units and dollars for a Hairloom fitting at YouCam's published prices ($0.048 a unit on subscription, $0.055 pay as you go). Give a scenario (chemo, thinning, sponsored) or itemise the steps, not both.",
      inputSchema: z.object({
        scenario: z.enum(["chemo", "thinning", "sponsored"]).optional().describe("chemo: a full wig fitting (also alopecia); thinning: volume and clip-in previews; sponsored: what a hospital or wig bank pays per patient"),
        passport: z.enum(["full", "lite", "none"]).optional(),
        wig_tryons: z.number().int().min(0).max(50).optional(),
        recolours: z.number().int().min(0).max(50).optional(),
        headwear: z.number().int().min(0).max(20).optional(),
        brows: z.number().int().min(0).max(5).optional(),
        own_hair: z.number().int().min(0).max(5).optional(),
        skin_checkins: z.number().int().min(0).max(20).optional(),
        volume_previews: z.number().int().min(0).max(20).optional(),
        clip_in_previews: z.number().int().min(0).max(20).optional(),
      }),
      outputSchema: COST_OUT,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const { scenario, passport = "full", wig_tryons = 8, recolours = 3, headwear = 3, brows = 1, own_hair = 1, skin_checkins = 0, volume_previews = 0, clip_in_previews = 0 } = args;
      const price = (units: number) => `${units} units: $${usd(units, "sub")} on a subscription, $${usd(units, "payg")} pay as you go.`;
      const out = (units: number) => ({ units, usd_subscription: usd(units, "sub"), usd_pay_as_you_go: usd(units, "payg"), scenario: scenario ?? null });
      const f = FITTINGS.find((x) => x.id === scenario);
      if (f) {
        const ignored = Object.keys(args).filter((k) => k !== "scenario");
        return both(`${f.title}. ${price(unitsOf(f))} ${f.who}\n${f.steps.map(([k, n, label]) => `- ${label}: ${n} × ${KINDS[k].api}, ${n * KINDS[k].units} units`).join("\n")}${ignored.length ? `\n(Ignored ${ignored.join(", ")}: a scenario sets every step. Leave out the scenario to itemise.)` : ""}`, out(unitsOf(f)));
      }
      const lite = KINDS.hairType.units + KINDS.hairFrizz.units + KINDS.hairLength.units;
      const pass = passport === "full" ? lite + KINDS.face.units : passport === "lite" ? lite : 0;
      const units = pass + wig_tryons * KINDS.wig.units + recolours * KINDS.hairColor.units + headwear * KINDS.headwear.units + brows * KINDS.brows.units + own_hair * KINDS.ownHair.units + skin_checkins * KINDS.skin.units + volume_previews * KINDS.hairVol.units + clip_in_previews * KINDS.hairExt.units;
      return both(`${price(units)} (Record ${pass}, try-ons ${wig_tryons * KINDS.wig.units}, recolours ${recolours}, headwear ${headwear}, brows ${brows}, own hair ${own_hair * KINDS.ownHair.units}, skin ${skin_checkins * KINDS.skin.units}, volume ${volume_previews * KINDS.hairVol.units}, clip-ins ${clip_in_previews * KINDS.hairExt.units}.)`, out(units));
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
