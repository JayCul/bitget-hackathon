import { AppFrame } from "@/components/Shell";
import { ThesesView } from "./ThesesView";

export const metadata = { title: "Theses · Prequel" };

export default function Page() {
  return (
    <AppFrame>
      <ThesesView />
    </AppFrame>
  );
}
