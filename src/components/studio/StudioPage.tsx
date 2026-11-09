"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { captureParam } from "@/components/creature/debugProbe";
import { CanvasSlot, Frame, Loading, TopBar } from "@/components/ui/Frame";
import { Action, Actions, Panel, Section, Segmented, Swatches, TextInput } from "@/components/ui/Panel";
import { isSpecies, type Species, SPECIES_DATA, SPECIES_IDS } from "@/store/species";
import { useSharkStore } from "@/store/sharkStore";
import { StudioScene } from "./StudioScene";

const SPECIES_OPTIONS = SPECIES_IDS.map((id) => ({ id, label: SPECIES_DATA[id].label }));

export default function StudioPage() {
  const creatures = useSharkStore((s) => s.creatures);
  const storedSpecies = useSharkStore((s) => s.species);
  const setCreature = useSharkStore((s) => s.setCreature);
  const setSpecies = useSharkStore((s) => s.setSpecies);
  const reset = useSharkStore((s) => s.reset);
  const released = useSharkStore((s) => s.released);
  const release = useSharkStore((s) => s.release);
  const recall = useSharkStore((s) => s.recall);
  const router = useRouter();
  // 셰이더 워밍업이 끝날 때까지 로딩 문구를 두고, 끝나면 캔버스를 페이드인
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // ?species=manta 로 캡처 시 종을 강제할 수 있다
  const forced = captureParam("species");
  const species: Species = isSpecies(forced) ? forced : storedSpecies;

  const { copy, palette } = SPECIES_DATA[species];
  const current = creatures[species];
  const patch = (p: Parameters<typeof setCreature>[1]) => setCreature(species, p);
  const name = current.name || copy.fallback;
  const inLagoon = released.includes(species);
  // 바다가 메인(/) — 풀어 주고 돌아간다 (이미 바다에 있으면 고친 모습 그대로 돌아갈 뿐)
  const releaseAndGo = () => {
    release(species);
    router.push("/");
  };

  return (
    <Frame>
      <CanvasSlot ready={ready}>
        <StudioScene species={species} config={current} onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="Stuffing the plush…" />}

      <TopBar left="Drag to lead it around" href="/" linkLabel="Back to the lagoon" />
      <h1 className="srOnly">Studio — {SPECIES_DATA[species].label}</h1>

      <Panel title="The specimen" fig={`fig. ${copy.no}`}>
        <Section label={`Specimen · ${inLagoon ? "swimming" : "new"}`}>
          <Segmented options={SPECIES_OPTIONS} value={species} onChange={setSpecies} />
        </Section>

        <Section label="Name">
          <TextInput value={current.name} onChange={(name) => patch({ name })} placeholder={copy.placeholder} />
        </Section>

        <Section label="Fur">
          <Swatches options={palette} value={current.furColor} onChange={(o) => patch({ furColor: o.fur, bellyColor: o.belly })} />
        </Section>

        <Actions>
          <Action onClick={reset}>Reset</Action>
          {inLagoon ? <Action onClick={() => recall(species)}>Take out</Action> : <Action onClick={() => router.push("/")}>View lagoon</Action>}
          <Action primary onClick={releaseAndGo}>
            {inLagoon ? `Back to ${name} in the lagoon →` : `Release ${name} into the lagoon →`}
          </Action>
        </Actions>
      </Panel>
    </Frame>
  );
}
