import { AppFrame } from "@/components/Shell";
import { PlanFlow } from "./PlanFlow";

export const metadata = { title: "Plan · Landed" };

export default function Page() {
  return (
    <AppFrame>
      <PlanFlow />
    </AppFrame>
  );
}
