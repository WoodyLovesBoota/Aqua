import type { Metadata } from "next";
import HomePage from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: { absolute: "Aqua — Places set in jelly" },
  description: "A shelf of jelly-block dioramas — a Maldives lagoon, Marina Bay, snowy Sapporo and autumn Jeonju. Flick through, then step in and wobble the block.",
};

export default function Page() {
  return <HomePage />;
}
