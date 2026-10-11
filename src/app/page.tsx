import type { Metadata } from "next";
import { StudioClient } from "@/components/ui/ClientOnly";

export const metadata: Metadata = {
  title: "Studio",
  description: "인형 바다 생물의 종·이름·털 색을 고르는 스튜디오.",
};

export default function Page() {
  return <StudioClient />;
}
