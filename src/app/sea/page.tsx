import type { Metadata } from "next";
import { SeaClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Lagoon",
  description: "꾸민 인형 바다 생물들이 헤엄치는 몰디브 리조트 라군 디오라마.",
};

export default function Page() {
  return <SeaClient />;
}
