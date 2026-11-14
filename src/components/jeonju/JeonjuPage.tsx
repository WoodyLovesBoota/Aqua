"use client";

import { useCallback, useState } from "react";
import { CanvasSlot, Frame, Loading, PosterBackdrop, TopBar } from "@/components/ui/Frame";
import { JeonjuScene } from "./JeonjuScene";

// 전시 04 — 전주 디오라마. 패널 없이 장면만 둔다
export default function JeonjuPage() {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <Frame>
      <PosterBackdrop slug="jeonju" hide={ready} />
      <CanvasSlot ready={ready}>
        <JeonjuScene onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="Lighting the lanterns…" />}
      <h1 className="srOnly">Aqua — Jeonju</h1>
      <TopBar left="Press the stream · grab the block to wobble" />
    </Frame>
  );
}
