"use client";

import classNames from "classnames/bind";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { Poster } from "@/components/home/Poster";
import { useNight } from "@/components/home/useLagoonTime";
import styles from "./Frame.module.scss";

const cx = classNames.bind(styles);

export function Frame({ children }: { children: ReactNode }) {
  return <div className={cx("frame")}>{children}</div>;
}

/** ready=false 동안 투명 — 셰이더 워밍업이 끝나면 페이드인 */
export function CanvasSlot({ children, ready = true }: { children: ReactNode; ready?: boolean }) {
  return <div className={cx("canvas", { ready })}>{children}</div>;
}

/**
 * 전시 로딩 배경 — 메인에서 커지며 들어온 사진과 같은 자리·같은 크기로 깔려 있다가, 장면이 뜨면(hide) 조금 뒤 치운다.
 * 전시 카메라와 같은 규칙: 넓은 화면은 높이에, 그 밖엔 폭에 맞추고 세로 화면은 조금 더 크게 (Frame.module.scss .backdrop).
 */
export function PosterBackdrop({ slug, hide = false }: { slug: string; hide?: boolean }) {
  const night = useNight();
  const [gone, setGone] = useState(false);
  // 메인으로 돌아가면 이 전시에서 다시 시작한다 (HomePage 의 LAST_PLACE_KEY)
  useEffect(() => sessionStorage.setItem("aqua:place", slug), [slug]);
  useEffect(() => {
    if (!hide) return;
    const id = setTimeout(() => setGone(true), 900); // 캔버스 페이드인(0.45s) 뒤 스르르 사라지고 나서
    return () => clearTimeout(id);
  }, [hide]);
  if (gone) return null;
  return (
    <div className={cx("backdrop", { hide })} aria-hidden>
      <Poster slug={slug} night={night} eager />
    </div>
  );
}

/** 위쪽 안내 줄 — 오른쪽에 링크 배지 (기본: 메인 목록으로) */
export function TopBar({ left, href = "/", linkLabel = "All places" }: { left: string; href?: string; linkLabel?: string }) {
  return (
    <div className={cx("topbar")}>
      <span>{left}</span>
      <Link href={href} className={cx("badge")}>
        <i />
        {linkLabel}
      </Link>
    </div>
  );
}

/** slug 를 주면 전시 사진을 깔고 그 아래에 문구를 둔다 (페이지 청크를 받는 동안) */
export function Loading({ text, slug }: { text: string; slug?: string }) {
  if (!slug) return <div className={cx("loading")}>{text}</div>;
  return (
    <Frame>
      <PosterBackdrop slug={slug} />
      <div className={cx("loading")}>{text}</div>
    </Frame>
  );
}
