import { AppNav } from "@/components/nav";
import { PlanFlow } from "./PlanFlow";

export const metadata = { title: "Plan · Landed" };

export default function Page() {
  return (
    <>
      <AppNav right={{ href: "/replay", label: "History" }} />
      <main className="mx-auto w-full max-w-[1180px] px-5 pt-14 pb-32 md:px-10 md:pt-20">
        <PlanFlow />
      </main>
    </>
  );
}
