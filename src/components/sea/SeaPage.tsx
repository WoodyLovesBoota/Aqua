"use client";

import classNames from "classnames/bind";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasSlot, Frame, Loading, TopBar } from "@/components/ui/Frame";
import { Action, Actions, Panel, Readout, Section, Swatches } from "@/components/ui/Panel";
import { type Species, SPECIES_DATA, SPECIES_IDS } from "@/store/species";
import { useSharkStore } from "@/store/sharkStore";
import { dayHour, dayPhase, formatHour } from "./dayCycle";
import { SeaScene } from "./SeaScene";
import { FLAVOURS } from "./waterMaterials";
import styles from "./SeaPage.module.scss";

const cx = classNames.bind(styles);

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

/** 지금 바다에 있는 생물 목록: 이름을 누르면 스튜디오에서 고치고, × 로 바다에서 꺼낸다 */
function Residents({ onEdit }: { onEdit: (species: Species) => void }) {
  const creatures = useSharkStore((s) => s.creatures);
  const released = useSharkStore((s) => s.released);
  const recall = useSharkStore((s) => s.recall);
  if (!released.length) return <p className={cx("empty")}>The lagoon is empty. Add a creature to bring it to life.</p>;
  return (
    <ul className={cx("residents")}>
      {released.map((id) => {
        const c = creatures[id];
        const name = c.name || SPECIES_DATA[id].copy.fallback;
        return (
          <li key={id} className={cx("resident")}>
            <button type="button" className={cx("residentMain")} onClick={() => onEdit(id)} aria-label={`Edit ${name} (${SPECIES_DATA[id].label}) in the studio`}>
              <span className={cx("chip")} style={{ background: c.furColor, boxShadow: `inset 0 -4px 0 ${c.bellyColor}` }} />
              <span className={cx("residentName")}>{name}</span>
              <span className={cx("residentKind")}>{SPECIES_DATA[id].label}</span>
            </button>
            <button type="button" className={cx("remove")} onClick={() => recall(id)} aria-label={`Take ${name} out of the lagoon`} title="Take out">
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const fileStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

// 바다가 메인 화면: 수조가 주인공이고 패널은 시각·주민·물 색·사진·숨기기만 둔다
export default function SeaPage() {
  const router = useRouter();
  const creatures = useSharkStore((s) => s.creatures);
  const released = useSharkStore((s) => s.released);
  const flavour = useSharkStore((s) => s.flavour);
  const setFlavour = useSharkStore((s) => s.setFlavour);
  const setSpecies = useSharkStore((s) => s.setSpecies);
  // 셰이더 워밍업이 끝날 때까지 로딩 문구를 두고, 끝나면 캔버스를 페이드인
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [uiHidden, setUiHidden] = useState(false);
  const [flash, setFlash] = useState(false);
  const snapshot = useRef<(() => Promise<Blob | null>) | null>(null);

  const flavourSwatches = FLAVOURS.map((f) => ({ id: f.id, label: f.label, fur: f.shallow, belly: f.deep }));
  const current = FLAVOURS.find((f) => f.id === flavour) ?? FLAVOURS[0];
  const missing = SPECIES_IDS.filter((id) => !released.includes(id));

  const edit = useCallback(
    (species: Species) => {
      setSpecies(species);
      router.push("/studio");
    },
    [router, setSpecies],
  );
  // 아직 바다에 없는 종부터 스튜디오에 띄운다 (다 있으면 지금 고른 종 그대로)
  const add = () => {
    if (missing.length) setSpecies(missing[0]);
    router.push("/studio");
  };

  const takePhoto = useCallback(async () => {
    const blob = await snapshot.current?.();
    if (!blob) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 260);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqua-lagoon-${fileStamp()}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, []);

  // 단축키: H = 화면 글자 숨기기/보이기, P = 사진, Esc = 다시 보이기 (입력 중이면 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "h") setUiHidden((v) => !v);
      else if (k === "escape") setUiHidden(false);
      else if (k === "p") void takePhoto();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [takePhoto]);

  return (
    <Frame>
      <CanvasSlot ready={ready}>
        <SeaScene creatures={creatures} released={released} flavour={flavour} onReady={onReady} snapshot={snapshot} />
      </CanvasSlot>
      {!ready && <Loading text="Filling the lagoon…" />}
      <div className={cx("flash", { on: flash })} aria-hidden />
      <h1 className="srOnly">Aqua — a plush lagoon</h1>

      {uiHidden ? (
        <button type="button" className={cx("showUi")} onClick={() => setUiHidden(false)}>
          Show panel <kbd>H</kbd>
        </button>
      ) : (
        <>
          <TopBar left="Press the water · grab the sand to wobble" href="/studio" linkLabel="Studio" />
          <Panel title="The lagoon" fig="fig. 01">
            <Section label="Time · 1 hour = 1 day">
              <LagoonClock />
            </Section>
            <Section label={`Residents · ${released.length}/${SPECIES_IDS.length}`}>
              <Residents onEdit={edit} />
              <Actions>
                <Action primary onClick={add}>
                  {missing.length ? `+ Add a creature` : "Customise creatures →"}
                </Action>
              </Actions>
            </Section>
            <Section label="Water">
              <Swatches options={flavourSwatches} value={current.shallow} onChange={(o) => setFlavour(o.id)} />
            </Section>
            <Actions>
              <Action onClick={takePhoto}>Snapshot</Action>
              <Action onClick={() => setUiHidden(true)}>Hide panel</Action>
            </Actions>
          </Panel>
        </>
      )}
    </Frame>
  );
}
