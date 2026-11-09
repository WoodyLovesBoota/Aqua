"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type CreatureConfig, defaultConfig, isSpecies, type Species, SPECIES_DATA, SPECIES_IDS, type UserFields } from "./species";

export type { CreatureConfig, SharkConfig, Species, UserFields } from "./species";

/** 종마다 설정 하나. 상어 항목은 고정 생김새(눈·입·장식)까지 들어 있어 SharkConfig 로도 쓸 수 있다 */
type Creatures = Record<Species, CreatureConfig>;

const DEFAULTS = Object.fromEntries(SPECIES_IDS.map((id) => [id, defaultConfig(id)])) as Creatures;

interface SharkStore {
  creatures: Creatures;
  /** 스튜디오에서 꾸미는 중인 종 */
  species: Species;
  setCreature: (species: Species, patch: Partial<UserFields>) => void;
  setSpecies: (species: Species) => void;
  reset: () => void;
  /** 바다에 풀어 둔 종 (SPECIES_IDS 순서 유지). 기본은 전부 */
  released: Species[];
  release: (species: Species) => void;
  recall: (species: Species) => void;
  /** 바다 물 색 (waterMaterials.FLAVOURS 의 id) */
  flavour: string;
  setFlavour: (flavour: string) => void;
}

const inOrder = (set: Set<Species>) => SPECIES_IDS.filter((id) => set.has(id));

function pickUser(saved: unknown): Partial<UserFields> {
  const s = (saved ?? {}) as Partial<UserFields>;
  const user: Partial<UserFields> = {};
  if (typeof s.name === "string") user.name = s.name;
  if (typeof s.furColor === "string") user.furColor = s.furColor;
  if (typeof s.bellyColor === "string") user.bellyColor = s.bellyColor;
  return user;
}

export const useSharkStore = create<SharkStore>()(
  persist(
    (set) => ({
      creatures: DEFAULTS,
      species: "hammerhead",
      setCreature: (species, patch) =>
        set((s) => ({ creatures: { ...s.creatures, [species]: { ...s.creatures[species], ...patch, ...SPECIES_DATA[species].fixed } } })),
      setSpecies: (species) => set({ species }),
      reset: () => set((s) => ({ creatures: { ...s.creatures, [s.species]: DEFAULTS[s.species] } })),
      released: [...SPECIES_IDS],
      release: (species) => set((s) => ({ released: inOrder(new Set([...s.released, species])) })),
      recall: (species) => set((s) => ({ released: s.released.filter((id) => id !== species) })),
      flavour: "lagoon",
      setFlavour: (flavour) => set({ flavour }),
    }),
    {
      name: "aqua.shark.v1",
      // 이름·털 색·종만 저장하고, 불러올 때 고정 생김새를 다시 입힌다
      partialize: (s) => ({
        creatures: Object.fromEntries(SPECIES_IDS.map((id) => [id, pickUser(s.creatures[id])])),
        species: s.species,
        released: s.released,
        flavour: s.flavour,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { creatures?: Partial<Record<Species, unknown>>; species?: unknown; released?: unknown; flavour?: unknown } & Record<string, unknown>;
        const creatures = Object.fromEntries(
          SPECIES_IDS.map((id) => {
            // 예전 저장 형식(config / manta / turtle …)도 읽는다
            const legacy = id === "hammerhead" ? saved.config : saved[id];
            return [id, { ...DEFAULTS[id], ...pickUser(saved.creatures?.[id] ?? legacy) }];
          }),
        ) as Creatures;
        // released 가 없던 예전 저장값은 전부 풀어 둔 상태로 본다
        const released = Array.isArray(saved.released) ? inOrder(new Set(saved.released.filter(isSpecies))) : current.released;
        const flavour = typeof saved.flavour === "string" ? saved.flavour : current.flavour;
        return { ...current, creatures, species: isSpecies(saved.species) ? saved.species : "hammerhead", released, flavour };
      },
    },
  ),
);
