import { DataTag, DisplayHeading } from "@desk/ui";

// Shell. The landing page (3 sections) is built in design step 6.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-8 px-6 py-24">
      <DisplayHeading lines={["What would change", "your mind?"]} />
      <p className="max-w-xl text-muted">Prequel stress-tests your trade thesis before you open the position.</p>
      <div className="flex gap-2">
        <DataTag kind="OBSERVED" />
        <DataTag kind="COMPUTED" />
        <DataTag kind="AI ESTIMATE" />
        <DataTag kind="DEMO REPLAY" />
      </div>
    </main>
  );
}
