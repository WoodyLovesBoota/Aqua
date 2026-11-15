"use client";

import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { creatureMeshUrl } from "@/components/creature/creatureMesh";
import { CREATURE_FILES } from "@/components/creature/files";
import { Loading } from "./Frame";

/**
 * 3D 캔버스는 브라우저에서만 의미가 있으므로
 * 페이지 전체를 클라이언트 전용으로 로드한다 (SSR/하이드레이션 불일치 방지).
 */
const SeaInner = dynamic(() => import("@/components/sea/SeaPage"), {
  ssr: false,
  loading: () => <Loading text="Filling the lagoon…" slug="lagoon" />,
});

export function SeaClient() {
  // 페이지 청크를 받는 동안 생물 메시도 같이 받기 시작한다
  for (const files of Object.values(CREATURE_FILES)) preload(creatureMeshUrl(files, "mid"), { as: "fetch", crossOrigin: "anonymous" });
  return <SeaInner />;
}

const MarinaInner = dynamic(() => import("@/components/marina/MarinaPage"), {
  ssr: false,
  loading: () => <Loading text="Lighting up the bay…" slug="marina-bay" />,
});

export function MarinaClient() {
  return <MarinaInner />;
}

const SapporoInner = dynamic(() => import("@/components/sapporo/SapporoPage"), {
  ssr: false,
  loading: () => <Loading text="Letting the snow settle…" slug="sapporo" />,
});

export function SapporoClient() {
  return <SapporoInner />;
}

const JeonjuInner = dynamic(() => import("@/components/jeonju/JeonjuPage"), {
  ssr: false,
  loading: () => <Loading text="Lighting the lanterns…" slug="jeonju" />,
});

export function JeonjuClient() {
  return <JeonjuInner />;
}

const ParisInner = dynamic(() => import("@/components/paris/ParisPage"), {
  ssr: false,
  loading: () => <Loading text="Lighting up the tower…" slug="paris" />,
});

export function ParisClient() {
  return <ParisInner />;
}
