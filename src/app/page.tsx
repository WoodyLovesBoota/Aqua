import type { Metadata } from "next";
import { SeaClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: { absolute: "Aqua — Plush Lagoon" },
  description: "A jelly-block resort lagoon where plush sea creatures swim. Press the water, wobble the block, and add your own creatures.",
};

export default function Page() {
  return <SeaClient />;
}
