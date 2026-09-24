// Research pipeline steps, shared by the server pipeline and the loader UI.
export const STEPS = [
  { id: "prices", label: "Reading price history", call: "Bitget crypto_spot_kline · rToken 1h" },
  { id: "events", label: "Collecting past events for peers", call: "Bitget equity_calendar · price_target · income" },
  { id: "headlines", label: "Writing 5 Red and 5 Green headlines", call: "LLM via Groq · JSON, schema-checked" },
  { id: "analogs", label: "Matching historical analogs", call: "LLM via Groq · returns event ids only" },
  { id: "outcomes", label: "Computing +1d and +5d outcomes", call: "Code · US session closes" },
] as const;

export const REPLAY_START = "2026-08-10";
export const REPLAY_LABEL = "10 Aug 2026";

export const EXAMPLE_THESIS = {
  ticker: "NVDA",
  direction: "long" as const,
  horizonDays: 21,
  sizeUsd: 10000,
  text: "Long NVDA into Q2 FY27 earnings. Hyperscaler capex should drive a data center revenue beat and a guide above consensus.",
};
