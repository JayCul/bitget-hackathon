import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// One .env.local at the repo root serves both apps in local dev. Vercel injects env directly.
loadEnvConfig(path.join(process.cwd(), "../.."));

const config: NextConfig = {
  transpilePackages: ["@desk/ui", "@desk/bitget", "@desk/llm", "@desk/market-data"],
};

export default config;
