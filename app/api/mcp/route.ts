import { CORS, mcpHandler } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A person who opens the endpoint in a browser gets a page that says what it is; MCP clients get the protocol. */
async function get(req: Request) {
  if ((req.headers.get("accept") ?? "").includes("text/html")) {
    const url = `${new URL(req.url).origin}/api/mcp`;
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hairloom MCP server</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:40em;margin:12vh auto;padding:0 20px;color:#f4ede8;background:#24192a}code{background:#3a2b43;padding:2px 6px;border-radius:4px}a{color:#e3c48d}</style>
<h1>Hairloom's MCP server, for wig fitters</h1>
<p>It speaks the Model Context Protocol over Streamable HTTP. Add this address to an assistant that supports remote MCP servers, such as Claude:</p>
<p><code>${url}</code></p>
<p>Tools: <b>match_wigs</b>, <b>shade_for_colour</b>, <b>list_stock</b>, <b>show_on_demo_person</b>, <b>fitting_plan</b>, <b>fitting_cost</b>.</p>
<p>Then ask: "My client is 1 to 2A, above chest, colour #342820, head 55.5 cm. What should I pull?"</p>
<p><a href="/fitter#assistant">Hairloom fitter desk</a></p>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return mcpHandler(req);
}

const preflight = () => new Response(null, { status: 204, headers: CORS });

export { get as GET, mcpHandler as POST, mcpHandler as DELETE, preflight as OPTIONS };
