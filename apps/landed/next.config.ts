import path from "node:path";
import type { NextConfig } from "next";

// One .env.local at the repo root serves both apps in local dev. Vercel injects env directly,
// so a missing file is fine. (@next/env's loader caches its first call, so it can't be used here.)
try {
  process.loadEnvFile(path.join(process.cwd(), "../../.env.local"));
} catch {
  // no root env file
}

const config: NextConfig = {
  transpilePackages: ["@desk/ui", "@desk/bitget", "@desk/llm", "@desk/market-data"],
};

export default config;
