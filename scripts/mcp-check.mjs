// Smoke test for the MCP server: node scripts/mcp-check.mjs [base]
const U = (process.argv[2] ?? "http://localhost:3141") + "/api/mcp";
const H = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function call(body, sid) {
  const r = await fetch(U, { method: "POST", headers: { ...H, ...(sid ? { "mcp-session-id": sid } : {}) }, body: JSON.stringify(body) });
  const t = await r.text();
  const data = t.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5))).at(-1) ?? (t.trim().startsWith("{") ? JSON.parse(t) : null);
  return { sid: r.headers.get("mcp-session-id"), data };
}

const init = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } } });
console.log("server:", init.data?.result?.serverInfo?.name);
const sid = init.sid;
await call({ jsonrpc: "2.0", method: "notifications/initialized" }, sid);
const list = await call({ jsonrpc: "2.0", id: 2, method: "tools/list" }, sid);
console.log("tools:", list.data?.result?.tools?.map((t) => t.name).join(", "));
const tool = async (name, args) => (await call({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args } }, sid)).data?.result?.content?.[0]?.text;
console.log("\n" + (await tool("match_wigs", { hair_length: "above chest", hair_type: "1 to 2A", hair_hex: "#342820", head_cm: 55.5, fit: "Women" })));
console.log("\n" + (await tool("show_on_demo_person", { wig: "Asha" })));
console.log("\n" + (await tool("fitting_cost", {})));
