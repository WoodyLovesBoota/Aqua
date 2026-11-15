import type { Metadata } from "next";
import { SeaClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Maldives",
  description: "A jelly-block resort lagoon where plush sea creatures swim. Press the water and wobble the block.",
};

export default function Page() {
  return <SeaClient />;
}
