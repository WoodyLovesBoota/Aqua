"use client";

import { useCallback, useState } from "react";
import { CanvasSlot, Frame, Loading, PosterBackdrop, TopBar } from "@/components/ui/Frame";
import { MarinaScene } from "./MarinaScene";

// 전시 02 — 싱가포르 마리나베이 디오라마. 패널 없이 장면만 둔다
export default function MarinaPage() {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <Frame>
      <PosterBackdrop slug="marina-bay" hide={ready} />
      <CanvasSlot ready={ready}>
        <MarinaScene onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="Lighting up the bay…" />}
      <h1 className="srOnly">Aqua — Marina Bay</h1>
      <TopBar left="Press the bay · grab the block to wobble" />
    </Frame>
  );
}
