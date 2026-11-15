"use client";

import { useCallback, useState } from "react";
import { CanvasSlot, Frame, Loading, PosterBackdrop, TopBar } from "@/components/ui/Frame";
import { ParisScene } from "./ParisScene";

// 전시 05 — 파리 디오라마. 패널 없이 장면만 둔다
export default function ParisPage() {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <Frame>
      <PosterBackdrop slug="paris" hide={ready} />
      <CanvasSlot ready={ready}>
        <ParisScene onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="Lighting up the tower…" />}
      <h1 className="srOnly">Aqua — Paris</h1>
      <TopBar left="Press the Seine · grab the block to wobble" />
    </Frame>
  );
}
