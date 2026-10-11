"use client";

import { useCallback, useEffect, useState } from "react";
import { CanvasSlot, Frame, Loading, TopBar } from "@/components/ui/Frame";
import { Panel, Readout, Section, Swatches } from "@/components/ui/Panel";
import { useSharkStore } from "@/store/sharkStore";
import { dayHour, dayPhase, formatHour } from "./dayCycle";
import { SeaScene } from "./SeaScene";
import { FLAVOURS } from "./waterMaterials";

/** 라군 시각 (실제 1시간 = 24시간 → 라군 1분 = 실제 2.5초). 서버 렌더에선 비워 두고 마운트 뒤 채운다 */
function LagoonClock() {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setHour(dayHour());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <Readout value={hour == null ? "--:--" : formatHour(hour)} note={hour == null ? undefined : dayPhase(hour)} />;
}

// 수조가 주인공: 글자는 걷어내고 돌아가기 링크와 물 색 패널만 남긴다 (파도·감쇠·시점은 기본값 고정)
export default function SeaPage() {
  const creatures = useSharkStore((s) => s.creatures);
  const [flavour, setFlavour] = useState(FLAVOURS[0].id);
  // 셰이더 워밍업이 끝날 때까지 로딩 문구를 두고, 끝나면 캔버스를 페이드인
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  const flavourSwatches = FLAVOURS.map((f) => ({ id: f.id, label: f.label, fur: f.shallow, belly: f.deep }));
  const current = FLAVOURS.find((f) => f.id === flavour) ?? FLAVOURS[0];

  return (
    <Frame>
      <CanvasSlot ready={ready}>
        <SeaScene creatures={creatures} flavour={flavour} onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="물을 채우는 중…" />}

      <TopBar left="" href="/" linkLabel="다시 꾸미기" />
      <h1 className="srOnly">The lagoon — 인형 바다 생물들의 라군</h1>

      <Panel title="The lagoon" fig="fig. 02">
        <Section label="라군 시각 (1시간 = 하루)">
          <LagoonClock />
        </Section>
        <Section label="물 (Flavour)">
          <Swatches options={flavourSwatches} value={current.shallow} onChange={(o) => setFlavour(o.id)} />
        </Section>
      </Panel>
    </Frame>
  );
}
