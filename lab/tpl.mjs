import fs from "node:fs";
const KEY = /YOUCAM_API_KEY=(\S+)/.exec(fs.readFileSync(new URL("../keys/youcam.env", import.meta.url), "utf8"))[1];
for (const f of ["hair-vol", "hair-ext"]) {
  const r = await fetch(`https://yce-api-01.makeupar.com/s2s/v2.0/task/template/${f}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const j = await r.json();
  console.log(f, r.status, JSON.stringify(j).slice(0, 1500));
}
