# Frontend Design Prompt: Landed + Prequel

Build the frontend for two independent hackathon products that share one design system. The functional source of truth is `Landed_and_Prequel_Spec.md`. Take inspiration from MotionSites-style cinematic motion, but don't copy any of its layouts, text or assets.

**The one rule:** make it an instrument for thinking, not another AI dashboard. Every screen does one job, has one primary action, and uses the fewest elements that job needs. If something doesn't help the user decide or help a judge understand, remove it.

---

## 1. Design system (`packages/ui`)

**Look:** dark, editorial, calm. Use large type, lots of negative space, and very few cards.

- **Colour.** Background `#050505`, raised surfaces `#0A0A0A` and `#111111`, text `#F2F2F2`, muted text `#8A8A8A`, borders `rgba(255,255,255,0.08)`. Use one warm amber accent, `#E8A34A`, and only as a signal: the key number, the active state, the primary button. No blue or purple gradients, no neon, no glassmorphism.
- **Type.** Geist for text and Geist Mono for numbers, both via `next/font`. Display headings run 56 to 96px, with line-height 0.95 and letter-spacing -0.03em. Body text is 15 to 16px. Keep sentences short.
- **Surfaces.** Separate content with space and thin 1px borders. Only group things in a card when the grouping means something. Keep corner radius at 8px or less.
- **Data labels.** Every number carries exactly one small mono tag: `OBSERVED`, `COMPUTED`, `ESTIMATED`, `BACKTESTED`, `AI ESTIMATE` or `DEMO REPLAY`. This is non-negotiable.
- **Motion** (Framer Motion, GPU-friendly `opacity`/`transform` only):
  - Hero elements enter with a fade, a 12px rise and a staggered delay of 60 to 80ms.
  - Numbers count up, and charts draw on when they scroll into view.
  - Buttons get a subtle magnetic hover and a border glow.
  - The background has one faint radial glow drifting slowly. Nothing louder than that.
  - Respect `prefers-reduced-motion` everywhere.
- **Components** (10 only): `DisplayHeading`, `Button` (primary and ghost), `Metric` (value + label + data tag), `DataTag`, `StatusPill`, `Timeline`, `ChartFrame`, `Sheet` (a bottom sheet on mobile, a side panel on desktop), `ResearchLoader`, `AmbientGlow`.
- **Accessibility.** Every control is reachable by keyboard, has a visible focus ring and an aria-label, and meets AA contrast.
- **No external images or video.** All visuals are SVG, CSS or charts.

**The sibling test:** with all the text removed, you should still be able to tell the two apart. Landed is warm, horizontal and precise, built from time axes, split lines and execution points. Prequel is cool, branching and investigative, built from a central node, two symmetrical columns and an evidence trail. Both use the same amber accent, and Prequel uses it less.

---

## 2. Landed (mobile-first)

**Landing page: 3 sections only.**
1. **Hero.** "Your salary landed. / Don't waste the spread." Below it: "Landed turns a payday allocation into a liquidity-aware execution plan." One CTA: **Build my plan**. The visual is an SVG of one amber line splitting into 4 execution points along a time axis, with faint depth bands behind it and a single pulse travelling along the line.
2. **Product preview.** A real Plan screen rendered with Demo Replay data and tagged as such.
3. **Human control + CTA.** "Nothing executes until you confirm." Then **Build my plan** again.

**App: 3 screens.**
1. **Setup.** One question per step, with a large number and a single Continue button:
   - "How much landed?" (₦ amount)
   - "What stays untouched?" (bills and buffer, prefilled rows)
   - "Where should the rest go?" (basket chips)

   The investable USD amount updates live at the top, tagged `COMPUTED`, and shows the FX rate used.
2. **Plan (the signature screen).**
   - Header: investable amount, number of tranches, and the execution window.
   - A vertical timeline of tranches, each showing time (WAT), asset, amount, and expected cost (bps), tagged `ESTIMATED`.
   - The best windows get the amber dot. The rest stay muted. Don't use green or red.
   - A faint spread or depth band sits behind the timeline, or a labelled proxy if the spread data isn't verified.
   - Below the timeline is a 2-line **Why this plan?** from the LLM, and a ghost button, **What if I buy now?**, that opens a Sheet comparing Buy now with the Landed plan in bps.
   - The primary button, **Confirm plan**, opens a Sheet that says "Ready to execute? 4 orders, $824, simulated execution." Confirming plays one restrained check animation, then the fills appear.
3. **Replay.** "Did the plan actually help?" shows 3 metrics (Buy at payday, Landed, Difference) and one bar chart per historical period. The caption must read: "Backtested historical replay. Not live savings."

Navigation is just Plan / Replay.

---

## 3. Prequel (desktop-first, works on mobile)

**Landing page: 3 sections only.**
1. **Hero.** "What would change your mind?" Below it: "Prequel stress-tests your trade thesis before you open the position." CTAs: **Stress-test a thesis** (primary) and **Watch a replay** (ghost). The visual is an SVG thesis node branching into two symmetrical paths of 5 event markers each, with slow signal pulses and a faint timeline underneath.
2. **Product preview.** A real Red/Green board rendered with Demo Replay data.
3. **Human control + CTA.** "Prequel observes and reminds. You decide." Then **Stress-test a thesis**.

**App: 3 screens.**
1. **Thesis.** One calm form: ticker, direction (Long/Short toggle), horizon, position, and thesis text. Primary button: **Stress-test my thesis**. It leads to the `ResearchLoader`, which shows 5 real pipeline steps ticking off, each tied to an actual call. It should take 6 seconds at most and never pretend to be working.
2. **Board (the signature screen).**
   - Two equal columns, **What breaks it?** and **What confirms it?**, with 5 rows each.
   - Both sides get identical weight. Red and Green appear only as a 2px marker and never flood the background.
   - Above the columns are two small metrics: Evidence Balance and Model Conviction, each tagged.
   - Clicking a row opens a Sheet containing:
     - **Historical analogs:** an animated price path for each analog, the +1d and +5d returns, and the `OBSERVED`/`COMPUTED` tags, kept visibly separate from the AI's reasoning.
     - **If this happens:** a segmented control (Trim 50% / Exit / Hold / Add). Saving it shows "Commitment locked. Saved before the event."
   - On mobile, the two columns become a Red/Green toggle.
3. **Replay.**
   - A horizontal tripwire timeline with a state on each item: `WAITING`, `ARMED`, `FIRED` or `EXPIRED`.
   - When a tripwire fires, a prominent Sheet says "Tripwire fired. Red #03." It shows the event, "Your commitment: Trim 50%", and one button, **View evidence**. Nothing is executed automatically.
   - At the end, a compact post-mortem shows the scenarios fired vs never triggered, and the commitments followed vs changed.

Navigation is just Theses / Replay.

---

## 4. Build rules and order

- **Real data only.** Every component is typed against the data structures in the spec. When a source is missing, show an explicit unavailable state. Demo Replay is allowed but always labelled. Never invent market data or fake an API response.
- **Stack:** Next.js App Router, TypeScript strict, Tailwind, Framer Motion, Recharts, and the existing `packages/ui` and server architecture. Don't add any other libraries.
- **Optimise for a 60 to 90 second recording.** A judge should follow each flow with no narration:
  - Landed: amount, then plan, then why, then confirm, then replay.
  - Prequel: thesis, then research, then board, then analog, then commitment, then tripwire fires.
- **The app matters more than the landing page.** Cap each landing page at 3 sections, and put the time into the app screens.
- **Build order:**
  1. Design system
  2. Prequel thesis and board
  3. Prequel analog Sheet and replay
  4. Landed setup and plan
  5. Landed replay
  6. Both landing pages
  7. Responsive and reduced-motion pass

  Commit and deploy after each step.
