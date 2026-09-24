import { AppFrame } from "@/components/Shell";
import { ReplayView } from "./ReplayView";

export const metadata = { title: "Replay · Prequel" };

export default function Page() {
  return (
    <AppFrame>
      <ReplayView />
    </AppFrame>
  );
}
