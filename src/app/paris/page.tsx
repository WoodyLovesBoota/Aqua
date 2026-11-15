import type { Metadata } from "next";
import { ParisClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Paris",
  description: "A jelly-block diorama of Paris in spring — the Seine and Notre-Dame, the Eiffel Tower, Sacré-Cœur, the Moulin Rouge, the Louvre pyramid and the Arc de Triomphe, from a clear afternoon to a sparkling night.",
};

export default function Page() {
  return <ParisClient />;
}
