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

  return (
    <Frame>
      <CanvasSlot ready={ready}>
        <StudioScene species={species} config={current} onReady={onReady} />
      </CanvasSlot>
      {!ready && <Loading text="솜을 채우는 중…" />}

      <TopBar left="" href="/sea" linkLabel="바다로 가기" />

      <Panel title="The specimen" fig={`fig. ${copy.no}`}>
        <Section label="종 (Specimen)">
          <Segmented options={SPECIES_OPTIONS} value={species} onChange={setSpecies} />
        </Section>

        <Section label="이름">
          <TextInput value={current.name} onChange={(name) => patch({ name })} placeholder={copy.placeholder} />
        </Section>

        <Section label="털 (Fur)">
          <Swatches options={palette} value={current.furColor} onChange={(o) => patch({ furColor: o.fur, bellyColor: o.belly })} />
        </Section>

        <Actions>
          <Action onClick={reset}>초기화</Action>
          <Action onClick={() => router.push("/sea")}>바다 보기</Action>
          <Action primary onClick={() => router.push("/sea")}>
            {current.name || copy.fallback} 바다에 풀어주기 →
          </Action>
        </Actions>
      </Panel>
    </Frame>
  );
}
