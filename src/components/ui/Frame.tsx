"use client";

import classNames from "classnames/bind";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Frame.module.scss";

const cx = classNames.bind(styles);

export function Frame({ children }: { children: ReactNode }) {
  return <div className={cx("frame")}>{children}</div>;
}

/** ready=false 동안 투명 — 셰이더 워밍업이 끝나면 페이드인 */
export function CanvasSlot({ children, ready = true }: { children: ReactNode; ready?: boolean }) {
  return <div className={cx("canvas", { ready })}>{children}</div>;
}

export function TopBar({ left, href, linkLabel }: { left: string; href: string; linkLabel: string }) {
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

export function Loading({ text }: { text: string }) {
  return <div className={cx("loading")}>{text}</div>;
}
