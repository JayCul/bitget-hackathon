"use client";
import { Button, ChartFrame, DataTag, DisplayHeading, ResearchLoader, Sheet, StatusPill, pct, type ResearchStep, type TimelineItem, Timeline } from "@desk/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalogPanel } from "@/components/AnalogPanel";
import { BoardMetrics } from "@/components/BoardMetrics";
import { ReplayChart } from "@/components/ReplayChart";
import { SectionLabel } from "@/components/Shell";
import { DEMO_BOARD, mentions } from "@/lib/demo";
import { COMMITMENT_LABEL, type Board, type Headline } from "@/lib/prequel/types";
import { expiryMs, startMs, stateAt } from "@/lib/replay/engine";
import type { Fire, NewsMatch, Recording } from "@/lib/replay/types";
import { actions, useActiveBoard, useStore, type Decision } from "@/lib/store";

type Prepared = {
  recording: Recording;
  shipped: boolean;
  matches: NewsMatch[];
  fires: Fire[];
  newsModel: string;
  newsError: string | null;
};

const DAY = 86_400_000;
const TICK_MS = 50;
const MS_PER_DAY_1X = 1400; // one replay day per 1.4s at 1x

const et = (t: number, withTime = true) =>
  new Date(t).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });

/** Calendar-day label. Replay windows are defined in UTC dates, so format those in UTC. */
const day = (t: number) => new Date(t).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

const label = (id: string) => `${id.startsWith("R") ? "Red" : "Green"} #${id.slice(1).padStart(2, "0")}`;

export function ReplayView() {
  const board = useActiveBoard();
  const { decisions } = useStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return null;
  if (!board || board.thesis.mode !== "replay") return <NoReplay board={board} />;
  return <Player key={board.id} board={board} decisions={decisions[board.id] ?? []} />;
}

function NoReplay({ board }: { board: Board | null }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-8">
      <SectionLabel>Replay</SectionLabel>
      <DisplayHeading lines={["Watch the thesis", "meet the tape."]} size="title" />
      <p className="max-w-xl text-muted">
        {board
          ? "The active thesis was created in live mode, so there is no recorded future to play yet. Create one in Demo replay mode, or load the recorded demo."
          : "Replay plays a recorded Bitget sequence of prices, earnings, analyst notes and news through a thesis's tripwires."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => actions.addBoard({ ...DEMO_BOARD, headlines: DEMO_BOARD.headlines.map((h) => ({ ...h })) })}>
          Load the NVDA demo thesis
        </Button>
        <Link href="/theses" className="inline-flex h-11 items-center rounded-md border border-line-strong px-5 text-[15px] hover:border-accent/60">
          Create a thesis
        </Link>
      </div>
    </div>
  );
}

// One prepare request per board version, shared across re-mounts (StrictMode, revisits).
const prepared = new Map<string, Promise<{ ok: boolean; body: unknown }>>();
function prepare(board: Board) {
  const key = `${board.id}:${board.generatedAt}`;
  let p = prepared.get(key);
  if (!p) {
    p = fetch("/api/replay/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(board) })
      .then(async (res) => ({ ok: res.ok, body: await res.json() }))
      .then((r) => {
        if (!r.ok) prepared.delete(key);
        return r;
      });
    prepared.set(key, p);
  }
  return p;
}

function Player({ board, decisions }: { board: Board; decisions: Decision[] }) {
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ResearchStep[]>([
    { id: "rec", label: "Loading the recorded sequence", call: "Bitget prices · earnings · analyst notes · news", state: "running" },
    { id: "news", label: "Matching news to news tripwires", call: "LLM · headline id + confidence only", state: "pending" },
    { id: "eval", label: "Checking price, earnings and analyst tripwires", call: "Code", state: "pending" },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSteps((s) => s.map((x) => (x.id === "news" ? { ...x, state: "running" } : x)));
      const { ok, body: raw } = await prepare(board);
      const body = raw as Prepared & { error?: string };
      if (cancelled) return;
      if (!ok) {
        setPrepError(body.error ?? "Replay could not be prepared.");
        setSteps((s) => s.map((x) => (x.state === "running" ? { ...x, state: "failed" } : x)));
        return;
      }
      const p = body as Prepared;
      setSteps([
        { id: "rec", label: "Loading the recorded sequence", call: p.recording.sources[0] ?? "Bitget", state: "done", note: p.shipped ? "recorded file" : "recorded now" },
        { id: "news", label: "Matching news to news tripwires", call: p.newsModel, state: p.newsError ? "failed" : "done", note: p.newsError ? "unavailable" : `${p.matches.length} matches` },
        { id: "eval", label: "Checking price, earnings and analyst tripwires", call: "Code", state: "done", note: `${p.fires.length} fired` },
      ]);
      setPrep(p);
    })().catch((e) => !cancelled && setPrepError(String(e)));
    return () => {
      cancelled = true;
    };
    // Commitments change the board object but not what the replay needs, so key on version only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, board.generatedAt]);

  if (!prep) {
    return (
      <div className="flex min-h-[60vh] flex-col items-start justify-center gap-10">
        <DisplayHeading lines={["Preparing", "the replay."]} size="title" />
        <ResearchLoader steps={steps} title="Replay" />
        {prepError ? (
          <p role="alert" className="max-w-xl text-sm text-red">
            {prepError}
          </p>
        ) : null}
      </div>
    );
  }
  return <Playback board={board} prep={prep} decisions={decisions} />;
}

function Playback({ board, prep, decisions }: { board: Board; prep: Prepared; decisions: Decision[] }) {
  const rec = prep.recording;
  const t0 = startMs(rec);
  const tEnd = Date.parse(`${rec.end}T23:59:00Z`);
  const [now, setNow] = useState(t0 - 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [openFire, setOpenFire] = useState<Fire | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const seen = useRef(new Set<string>());
  const fires = prep.fires;
  const byId = useMemo(() => Object.fromEntries(board.headlines.map((h) => [h.id, h])), [board]);

  const nowRef = useRef(now);

  // Playback clock on setInterval, so it keeps time even where animation frames are throttled.
  // Clock logic lives outside state updaters so it runs exactly once per tick.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      // Advance by real elapsed time, so throttled timers slow nothing down.
      const t = performance.now();
      const elapsed = Math.min(t - last, 1000);
      last = t;
      const n = nowRef.current;
      const next = Math.max(n, t0) + (DAY * elapsed * speed) / MS_PER_DAY_1X;
      const hit = fires.find((f) => f.at > n && f.at <= next && !seen.current.has(f.headlineId));
      let target = next;
      if (hit) {
        seen.current.add(hit.headlineId);
        target = hit.at;
        setPlaying(false);
        setShowEvidence(false);
        setOpenFire(hit);
      } else if (next >= tEnd) {
        target = tEnd;
        setPlaying(false);
      }
      nowRef.current = target;
      setNow(target);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, fires, t0, tEnd]);

  const restart = useCallback(() => {
    seen.current.clear();
    actions.clearDecisions(board.id);
    setOpenFire(null);
    nowRef.current = t0 - 1;
    setNow(t0 - 1);
    setPlaying(true);
  }, [board.id, t0]);

  const firedNow = fires.filter((f) => f.at <= now).map((f) => f.headlineId);
  const finished = now >= tEnd;
  const lastClose = [...rec.events].reverse().find((e) => e.kind === "session_close" && e.at <= now);

  // Event log: thesis start, sessions with big moves, earnings, analyst days, company news, fires.
  const log: TimelineItem[] = useMemo(() => {
    const items: (TimelineItem & { at: number })[] = [
      {
        id: "start",
        at: t0,
        time: day(t0),
        title: "Thesis created",
        detail: `${board.thesis.ticker} ${board.thesis.direction}, reference $${board.context.refPrice.toFixed(2)}. ${board.headlines.filter((h) => h.commitment).length}/10 commitments locked.`,
      },
    ];
    for (const e of rec.events) {
      if (e.at > now) continue;
      if (e.kind === "earnings") {
        items.push({
          id: `earn-${e.at}`,
          at: e.at,
          time: et(e.at),
          title: `${rec.ticker} earnings`,
          detail:
            e.surprise !== null && e.revenue !== null && e.consensus !== null
              ? `Revenue $${(e.revenue / 1e9).toFixed(2)}B vs $${(e.consensus / 1e9).toFixed(2)}B consensus (${pct(e.surprise)}). Calendar said ${e.calendarDate ?? "n/a"}; volume places it here.`
              : e.summary,
        });
      } else if (e.kind === "analyst") {
        const raises = e.notes.filter((n) => n.target !== null && n.previousTarget && n.target > n.previousTarget).length;
        const cuts = e.notes.filter((n) => n.target !== null && n.previousTarget && n.target < n.previousTarget).length;
        items.push({ id: `an-${e.at}`, at: e.at, time: et(e.at), title: `${e.notes.length} analyst note${e.notes.length > 1 ? "s" : ""}`, detail: `${raises} target raise${raises === 1 ? "" : "s"}, ${cuts} cut${cuts === 1 ? "" : "s"}` });
      } else if (e.kind === "news") {
        const matched = prep.matches.some((m) => m.newsId === e.id);
        if (matched || mentions(rec.ticker, e.title)) items.push({ id: e.id, at: e.at, time: et(e.at), title: e.title, detail: matched ? "Matched to a news tripwire" : "Recorded news" });
      }
    }
    for (const f of fires) {
      if (f.at > now) continue;
      const h = byId[f.headlineId];
      const c = h?.commitment;
      items.push({
        id: `fire-${f.headlineId}`,
        at: f.at + 1,
        time: et(f.at),
        highlight: true,
        title: `Tripwire matched: ${label(f.headlineId)} fired`,
        detail: c ? `You said you'd ${COMMITMENT_LABEL[c.action].toLowerCase()}.` : "No commitment was locked for this one.",
      });
    }
    return items.sort((a, b) => b.at - a.at).slice(0, 14);
  }, [rec, now, fires, byId, board, prep.matches, t0]);

  const strip: TimelineItem[] = board.headlines.map((h) => {
    const s = stateAt(h, rec, fires, now);
    const f = fires.find((x) => x.headlineId === h.id);
    return {
      id: h.id,
      time: s === "FIRED" && f ? et(f.at) : `until ${day(expiryMs(rec, h))}`,
      title: (
        <span className="flex items-center gap-2">
          <span aria-hidden className={`h-3 w-[2px] ${h.side === "RED" ? "bg-red" : "bg-green"}`} />
          <span className="font-mono text-xs">{h.id}</span>
        </span>
      ),
      detail: <span className="line-clamp-2">{h.headline}</span>,
      aside: <StatusPill status={s} />,
      highlight: s === "FIRED",
    };
  });

  const fireHeadline = openFire ? byId[openFire.headlineId] : null;
  const decided = openFire ? decisions.find((d) => d.headlineId === openFire.headlineId) : undefined;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SectionLabel>Replay</SectionLabel>
            <DataTag kind="DEMO REPLAY" />
          </div>
          <h1 className="text-title font-medium">
            <span className="font-mono">{rec.ticker}</span> <span className="text-muted">{day(t0)} to {day(Date.parse(`${rec.end}T12:00:00Z`))}</span>
          </h1>
          <p className="max-w-2xl text-[13px] text-muted">{board.thesis.text}</p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div aria-live="off" className="font-mono text-2xl tabular-nums">
            {now < t0 ? "Ready" : `${et(Math.min(now, tEnd))} ET`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {finished ? (
              <Button onClick={restart}>Replay again</Button>
            ) : (
              <Button onClick={() => (now < t0 ? restart() : setPlaying((p) => !p))} aria-label={playing ? "Pause" : "Play"}>
                {playing ? "Pause" : now < t0 ? "Play replay" : "Resume"}
              </Button>
            )}
            <div role="radiogroup" aria-label="Speed" className="inline-flex rounded-md border border-line bg-raised p-1">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={speed === s}
                  onClick={() => setSpeed(s)}
                  className={`h-9 rounded-[5px] px-3 font-mono text-xs ${speed === s ? "bg-raised-2 text-fg" : "text-muted hover:text-fg"}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ChartFrame
        title={`r${rec.ticker} hourly, with price tripwire levels`}
        kind="DEMO REPLAY"
        source="Bitget"
        height={300}
        caption={lastClose && lastClose.kind === "session_close" ? `Last session close ${lastClose.date}: $${lastClose.close.toFixed(2)}. Price tripwires check session closes.` : "Price tripwires check US session closes."}
      >
        <ReplayChart rec={rec} now={now} headlines={board.headlines} fires={fires} />
      </ChartFrame>

      <section aria-label="Tripwires" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Tripwires</h2>
          <span className="font-mono text-xs text-muted">
            {firedNow.length} fired · {board.headlines.filter((h) => stateAt(h, rec, fires, now) === "ARMED").length} armed
          </span>
        </div>
        <Timeline items={strip} orientation="horizontal" label="Tripwire states" />
      </section>

      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section aria-label="Event log" className="flex flex-col gap-5">
          <h2 className="text-sm font-medium">Event log</h2>
          <Timeline items={log} label="Replay events, newest first" />
        </section>
        <section className="flex flex-col gap-8">
          <h2 className="text-sm font-medium">Conviction as events land</h2>
          <BoardMetrics board={board} firedIds={firedNow} />
        </section>
      </div>

      {finished ? <PostMortem board={board} rec={rec} fires={fires} decisions={decisions} /> : null}

      <p className="font-mono text-[11px] leading-5 text-muted">
        Sources: {rec.sources.join(" · ")}. Recorded {new Date(rec.recordedAt).toLocaleString("en-GB")}. News matching: {prep.newsModel} (id + confidence, fires at 0.7+). Nothing is executed.
      </p>

      <Sheet
        open={Boolean(openFire)}
        onClose={() => {
          setOpenFire(null);
          if (!finished) setPlaying(true);
        }}
        width={600}
        title={openFire ? <span className="text-accent">Tripwire fired. {label(openFire.headlineId)}.</span> : null}
      >
        {openFire && fireHeadline ? (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-xs text-muted">{et(openFire.at)} ET</span>
              <p className="text-xl leading-snug font-medium tracking-tight">{fireHeadline.headline}</p>
              <div className="flex items-start justify-between gap-3 rounded-md border border-line bg-bg p-4">
                <p className="font-mono text-[13px]">{openFire.detail}</p>
                <DataTag kind={openFire.eventKind === "news" ? "AI ESTIMATE" : "DEMO REPLAY"} />
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-6">
              <span className="text-xs text-muted">Your commitment</span>
              {fireHeadline.commitment ? (
                <>
                  <span className="text-3xl font-medium tracking-tight text-accent">{COMMITMENT_LABEL[fireHeadline.commitment.action]}</span>
                  <span className="text-sm text-muted">
                    You said you&apos;d {COMMITMENT_LABEL[fireHeadline.commitment.action].toLowerCase()}. Locked {new Date(fireHeadline.commitment.lockedAt).toLocaleString("en-GB")}.
                    {fireHeadline.commitment.note ? ` "${fireHeadline.commitment.note}"` : ""}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted">No commitment was locked for this scenario.</span>
              )}
              <p className="mt-2 text-[13px] text-muted">Nothing is executed. Prequel only reminds; you decide.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => actions.recordDecision(board.id, { headlineId: openFire.headlineId, choice: "followed", at: new Date().toISOString() })}
                disabled={!fireHeadline.commitment}
              >
                {decided?.choice === "followed" ? "Following my plan ✓" : "Follow my commitment"}
              </Button>
              <Button variant="ghost" onClick={() => actions.recordDecision(board.id, { headlineId: openFire.headlineId, choice: "changed", at: new Date().toISOString() })}>
                {decided?.choice === "changed" ? "Changed my mind ✓" : "I'm changing my mind"}
              </Button>
              <Button variant="ghost" onClick={() => setShowEvidence((v) => !v)}>
                {showEvidence ? "Hide evidence" : "View evidence"}
              </Button>
            </div>
            {showEvidence ? <AnalogPanel h={fireHeadline} barsSource={board.universe.barsSource} /> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function PostMortem({ board, rec, fires, decisions }: { board: Board; rec: Recording; fires: Fire[]; decisions: Decision[] }) {
  const fired = board.headlines.filter((h) => fires.some((f) => f.headlineId === h.id));
  const quiet = board.headlines.filter((h) => !fires.some((f) => f.headlineId === h.id));
  const closes = rec.events.filter((e) => e.kind === "session_close");
  const first = closes[0];
  const last = closes.at(-1);
  const move = first && last && first.kind === "session_close" && last.kind === "session_close" ? last.close / board.context.refPrice - 1 : null;
  const followed = decisions.filter((d) => d.choice === "followed").length;
  const changed = decisions.filter((d) => d.choice === "changed").length;

  const List = ({ items, empty }: { items: Headline[]; empty: string }) =>
    items.length ? (
      <ul className="flex flex-col">
        {items.map((h) => (
          <li key={h.id} className="grid grid-cols-[2px_auto_1fr] items-start gap-3 border-t border-line py-3 text-[13px] first:border-t-0">
            <span aria-hidden className={`h-full w-[2px] ${h.side === "RED" ? "bg-red" : "bg-green"}`} />
            <span className="font-mono text-muted">{h.id}</span>
            <span>{h.headline}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-[13px] text-muted">{empty}</p>
    );

  return (
    <section aria-label="Post-mortem" className="flex flex-col gap-8 border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>Post-mortem</SectionLabel>
          <h2 className="mt-3 text-2xl font-medium tracking-tight">What happened, against what you said.</h2>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="text-xs text-muted">{rec.ticker} over the window</div>
            <div className="font-mono text-2xl tabular-nums">{move !== null ? pct(move) : "n/a"}</div>
            <DataTag kind="COMPUTED" />
          </div>
          <div>
            <div className="text-xs text-muted">Commitments</div>
            <div className="font-mono text-2xl tabular-nums">
              {followed} kept · {changed} changed
            </div>
            <DataTag kind="COMPUTED" />
          </div>
        </div>
      </div>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Fired ({fired.length})</h3>
          <List items={fired} empty="No scenario fired inside its window." />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Never triggered ({quiet.length})</h3>
          <List items={quiet} empty="Every scenario fired." />
        </div>
      </div>
    </section>
  );
}
