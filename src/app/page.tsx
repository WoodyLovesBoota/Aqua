import type { Metadata } from "next";
import HomePage from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: { absolute: "Island" },
  description: "Five places rebuilt as jelly-block 3D dioramas — Maldives, Singapore, Sapporo, Jeonju and Paris.",
};

export default function Page() {
  return <HomePage />;
}
