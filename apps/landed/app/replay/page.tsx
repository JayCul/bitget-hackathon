import { AppNav } from "@/components/nav";
import { ReplayView } from "./ReplayView";

export const metadata = { title: "History · Landed" };

export default function Page() {
  return (
    <>
      <AppNav right={{ href: "/plan", label: "Build a plan" }} />
      <main className="mx-auto w-full max-w-[1180px] px-5 pt-14 pb-32 md:px-10 md:pt-20">
        <ReplayView />
      </main>
    </>
  );
}
