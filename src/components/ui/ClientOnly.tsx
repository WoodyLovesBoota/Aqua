"use client";

import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { creatureMeshUrl, type CreatureLod } from "@/components/creature/creatureMesh";
import { CREATURE_FILES } from "@/components/creature/files";
import { useSharkStore } from "@/store/sharkStore";
import { Loading } from "./Frame";

/** 페이지 청크를 받는 동안 생물 메시도 같이 받기 시작한다 */
function preloadMesh(files: (typeof CREATURE_FILES)[keyof typeof CREATURE_FILES], ...lods: CreatureLod[]) {
  for (const lod of lods) preload(creatureMeshUrl(files, lod), { as: "fetch", crossOrigin: "anonymous" });
}

/**
 * 3D 캔버스 + localStorage 상태는 브라우저에서만 의미가 있으므로
 * 페이지 전체를 클라이언트 전용으로 로드한다 (SSR/하이드레이션 불일치 방지).
 */
const StudioInner = dynamic(() => import("@/components/studio/StudioPage"), {
  ssr: false,
  loading: () => <Loading text="Stuffing the plush…" />,
});

const SeaInner = dynamic(() => import("@/components/sea/SeaPage"), {
  ssr: false,
  loading: () => <Loading text="Filling the lagoon…" />,
});

export function StudioClient() {
  // 스튜디오는 저장된 종 하나만 보여주므로 그 메시만 미리 받는다
  preloadMesh(CREATURE_FILES[useSharkStore.getState().species], "hi", "lo");
  return <StudioInner />;
}

export function SeaClient() {
  for (const files of Object.values(CREATURE_FILES)) preloadMesh(files, "mid");
  return <SeaInner />;
}
