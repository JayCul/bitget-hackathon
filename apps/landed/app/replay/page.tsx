import { AppFrame } from "@/components/Shell";
import { ReplayView } from "./ReplayView";

export const metadata = { title: "Replay · Landed" };

export default function Page() {
  return (
    <AppFrame>
      <ReplayView />
    </AppFrame>
  );
}
