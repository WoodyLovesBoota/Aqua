"use client";

import classNames from "classnames/bind";
import type { ReactNode } from "react";
import styles from "./Panel.module.scss";

const cx = classNames.bind(styles);

export function Panel({ title, fig, children }: { title: string; fig?: string; children: ReactNode }) {
  return (
    <aside className={cx("panel")} aria-label={title}>
      <div className={cx("header")}>
        <h2 className={cx("kicker")}>{title}</h2>
        {fig && <span className={cx("fig")}>{fig}</span>}
      </div>
      {children}
    </aside>
  );
}

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={cx("section")}>
      <span className={cx("kicker")}>{label}</span>
      {children}
    </div>
  );
}

export function Swatches({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; fur: string; belly: string }[];
  value: string;
  onChange: (o: { id: string; fur: string; belly: string }) => void;
}) {
  return (
    <div className={cx("swatches")}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={cx("swatch", { active: o.fur === value })}
          onClick={() => onChange(o)}
          aria-pressed={o.fur === value}
          aria-label={o.label}
        >
          <span className={cx("swatchColor")}>
            <span style={{ background: o.fur }} />
            <span style={{ background: o.belly, flex: "0 0 4px" }} />
          </span>
          <span className={cx("swatchLabel")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  display,
  low,
  high,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  low: string;
  high: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className={cx("slider")}>
      <span className={cx("sliderHead")}>
        <span>{label}</span>
        <b>{display}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className={cx("sliderFoot")}>
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className={cx("actions")}>{children}</div>;
}

export function Action({
  children,
  primary,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cx("action", { primary })} onClick={onClick}>
      {children}
    </button>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className={cx("input")}
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={16}

      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 두세 개 중 하나를 고르는 분할 버튼 (종 선택 등). 라디오 그룹처럼 화살표 키로도 옮긴다 */
export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.id === value);
    const next = options[(i + dir + options.length) % options.length];
    onChange(next.id);
    (e.currentTarget.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className={cx("segmented")} role="radiogroup" onKeyDown={onKeyDown}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          tabIndex={o.id === value ? 0 : -1}
          className={cx("segment", { active: o.id === value })}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 읽기 전용 값 한 줄 (큰 숫자 + 옆 설명) */
export function Readout({ value, note }: { value: string; note?: string }) {
  return (
    <p className={cx("readout")} aria-live="off">
      <b>{value}</b>
      {note && <span>{note}</span>}
    </p>
  );
}
