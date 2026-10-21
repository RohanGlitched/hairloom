import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname),
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV !== "production") return [{ source: "/:path*", headers: base }];
    // The fitter desk renders decrypted, untrusted content: lock it to same-origin resources only.
    const fitterCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      // Every page refuses framing except the retailer embed.
      { source: "/((?!embed).*)", headers: [...base, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/embed", headers: base },
      { source: "/fitter", headers: [{ key: "Content-Security-Policy", value: fitterCsp }] },
    ];
  },
};

export default config;
