import { DataTag, DisplayHeading } from "@desk/ui";

// Shell. The landing page (3 sections) is built in design step 6.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-4 py-20">
      <DisplayHeading lines={["Your salary landed.", "Don't waste the spread."]} size="title" />
      <p className="text-muted">Landed turns a payday allocation into a liquidity-aware execution plan.</p>
      <div className="flex flex-wrap gap-2">
        <DataTag kind="OBSERVED" />
        <DataTag kind="ESTIMATED" />
        <DataTag kind="BACKTESTED" />
      </div>
    </main>
  );
}
