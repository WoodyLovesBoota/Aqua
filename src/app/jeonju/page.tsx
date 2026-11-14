import type { Metadata } from "next";
import { JeonjuClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Jeonju",
  description: "A jelly-block diorama of Jeonju in autumn — Gyeonggijeon, Pungnammun, Jeondong Cathedral, the Jaman mural village and the Nambu night market, from a golden afternoon to a full-moon night.",
};

export default function Page() {
  return <JeonjuClient />;
}
