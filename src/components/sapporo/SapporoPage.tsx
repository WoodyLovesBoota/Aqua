"use client";

import { useCallback, useState } from "react";
import { CanvasSlot, Frame, Loading, PosterBackdrop, TopBar } from "@/components/ui/Frame";
import { SapporoScene } from "./SapporoScene";

// 전시 03 — 삿포로 디오라마. 패널 없이 장면만 둔다
export default function SapporoPage() {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <Frame>
      <PosterBackdrop slug="sapporo" hide={ready} />
      <CanvasSlot ready={ready}>
        <SapporoScene onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="Letting the snow settle…" />}
      <h1 className="srOnly">Island — Sapporo</h1>
      <TopBar />
    </Frame>
  );
}
