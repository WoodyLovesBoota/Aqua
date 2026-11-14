import type { Metadata } from "next";
import { SapporoClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Sapporo",
  description: "A jelly-block diorama of snowy Sapporo — a steaming onsen, Mt. Moiwa, the Odori snow festival, the TV Tower and the Clock Tower, from a snowy afternoon to illuminated night.",
};

export default function Page() {
  return <SapporoClient />;
}
