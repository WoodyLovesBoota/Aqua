import type { Metadata } from "next";
import { StudioClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Studio",
  description: "Pick a plush sea creature, name it and choose its fur colour before releasing it into the lagoon.",
};

export default function Page() {
  return <StudioClient />;
}
