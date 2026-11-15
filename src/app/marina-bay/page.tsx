import type { Metadata } from "next";
import { MarinaClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Singapore",
  description: "A jelly-block diorama of Singapore's Marina Bay — Marina Bay Sands, the Merlion, the Esplanade and the Supertrees, from afternoon to blue hour.",
};

export default function Page() {
  return <MarinaClient />;
}
