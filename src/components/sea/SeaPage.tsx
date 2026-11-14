"use client";

import { useCallback, useState } from "react";
import { CanvasSlot, Frame, Loading, PosterBackdrop, TopBar } from "@/components/ui/Frame";
import { SeaScene } from "./SeaScene";

// 전시 01 — 라군 디오라마. 패널 없이 장면만 둔다 (생물·물 색·시점 모두 기본값 고정)
export default function SeaPage() {
  // 셰이더 워밍업이 끝날 때까지 로딩 문구를 두고, 끝나면 캔버스를 페이드인
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <Frame>
      <PosterBackdrop slug="lagoon" hide={ready} />
      <CanvasSlot ready={ready}>
        <SeaScene onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="Filling the lagoon…" />}
      <h1 className="srOnly">Aqua — a plush lagoon</h1>
      <TopBar left="Press the water · grab the sand to wobble" />
    </Frame>
  );
}
