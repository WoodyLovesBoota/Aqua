"use client";

import classNames from "classnames/bind";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type MouseEvent, type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./HomePage.module.scss";
import { PLACES, PORTRAIT_ZOOM, POSTER_ASPECT } from "./places";
import { Poster } from "./Poster";
import { useLagoonClock, useNight } from "./useLagoonTime";

const cx = classNames.bind(styles);

/** 마지막으로 본 전시 — 전시에서 "All places" 로 돌아오면 그 자리에서 다시 시작한다 (전시 쪽 PosterBackdrop 도 같은 키에 쓴다) */
export const LAST_PLACE_KEY = "aqua:place";
const N = PLACES.length;
const clampIndex = (i: number) => Math.min(N - 1, Math.max(0, i));
const pad = (n: number) => String(n).padStart(2, "0");
const ENTER_MS = 560;

/**
 * 메인 — 전시를 한 곳씩 넘겨 보는 목록. 장면을 실시간으로 그리지 않고 미리 찍은 사진(낮·밤)만 쓴다.
 * 가운데 블록: 올리면 떠오르며 출렁이고 반대 시간대를 엿본다 · 누르면 화면 가득 커지며 전시로 들어간다
 * (전시 로딩 배경이 같은 자리·같은 크기의 사진이라 그대로 실제 장면으로 이어진다).
 * 넘기기: 끌기·스와이프 · 좌우 화살표 키 · 휠 · 옆 블록/아래 이름 누르기.
 */
export default function HomePage() {
  const router = useRouter();
  const night = useNight();
  const clock = useLagoonClock();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<number | null>(null); // 끄는 중이면 칸 단위 오프셋
  const [peek, setPeek] = useState(false);
  const [entering, setEntering] = useState<{ i: number; transform: string } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);
  const gesture = useRef({ id: -1, x0: 0, step: 1, moved: false });
  const wheel = useRef({ acc: 0, until: 0 });

  useLayoutEffect(() => {
    const i = PLACES.findIndex((p) => p.slug === sessionStorage.getItem(LAST_PLACE_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 렌더와 맞추려고 0 으로 시작한 뒤, 그리기 전에 마지막으로 본 전시로 옮긴다
    if (i > 0) setIndex(i);
    // 전시에서 돌아왔을 때(이 화면은 숨겨진 채 상태가 남아 있다): 커져 있던 블록이 제자리로 줄어들며 돌아온다
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setEntering(null));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const go = useCallback((i: number) => {
    setPeek(false);
    setIndex(clampIndex(i));
  }, []);

  const enter = useCallback(
    (i: number) => {
      const el = items.current[i];
      if (!el || entering) return;
      // 전시 로딩 배경(PosterBackdrop)과 같은 자리·크기로: 넓은 화면은 높이에, 그 밖엔 폭에 맞추고 세로 화면은 조금 더 크게
      const vw = window.innerWidth, vh = window.innerHeight, aspect = vw / vh;
      const target = aspect >= POSTER_ASPECT ? vh * POSTER_ASPECT : vw * (aspect < 1 ? PORTRAIT_ZOOM : 1);
      const w = el.offsetWidth, r = el.getBoundingClientRect();
      const dx = vw / 2 - (r.left + r.width / 2), dy = vh / 2 - (r.top + r.height / 2);
      setEntering({ i, transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${target / w})` });
      sessionStorage.setItem(LAST_PLACE_KEY, PLACES[i].slug);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => router.push(`/${PLACES[i].slug}`), reduce ? 0 : ENTER_MS);
    },
    [entering, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") setIndex((i) => clampIndex(i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => clampIndex(i - 1));
      else return;
      setPeek(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 휠·트랙패드: 한 번 밀면 한 칸 (관성으로 여러 칸 넘어가지 않게 잠깐 쉰다)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const w = wheel.current, now = performance.now();
      if (now < w.until) return;
      w.acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(w.acc) < 50) return;
      const dir = Math.sign(w.acc);
      w.acc = 0;
      w.until = now + 520;
      setPeek(false);
      setIndex((i) => clampIndex(i + dir));
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (entering || (e.pointerType === "mouse" && e.button !== 0)) return;
    // 한 칸 = 이웃 블록 중심 사이 거리 (CSS 가 정한 값을 그대로 잰다)
    const centre = (el: HTMLElement | null) => {
      const r = el?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : 0;
    };
    const step = N > 1 ? Math.abs(centre(items.current[1]) - centre(items.current[0])) : 0;
    gesture.current = { id: e.pointerId, x0: e.clientX, step: Math.max(80, step), moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    if (!g.moved) {
      if (Math.abs(dx) < 8) return;
      g.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPeek(false);
    }
    let d = dx / g.step;
    // 양 끝에서는 고무줄처럼 뻑뻑하게
    const over = index - d < 0 ? index - d : index - d > N - 1 ? index - d - (N - 1) : 0;
    d += over * 0.7;
    setDrag(d);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.id !== e.pointerId) return;
    g.id = -1;
    if (!g.moved) return;
    const dx = e.clientX - g.x0;
    const by = Math.abs(dx) > 48 ? -Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / g.step)) : 0;
    setDrag(null);
    setIndex((i) => clampIndex(i + by));
  };

  const onItemClick = (e: MouseEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // 새 탭으로 열기는 그대로
    e.preventDefault();
    if (gesture.current.moved) return; // 끌다 놓은 것
    if (i === index) enter(i);
    else go(i);
  };

  const place = PLACES[index];
  return (
    <main className={cx("home", { entering, dragging: drag != null })}>
      <h1 className="srOnly">Aqua — places set in jelly</h1>
      <div className={cx("topbar")}>
        <span>Aqua · Jelly dioramas</span>
        <span className={cx("meta")}>
          {pad(N)} places{clock && ` · lagoon time ${clock}`}
        </span>
      </div>

      <div ref={stage} className={cx("stage")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {PLACES.map((p, i) => {
          const d = i - index + (drag ?? 0);
          const a = Math.abs(d), near = Math.min(a, 1), current = i === index;
          const going = entering?.i === i;
          const style = {
            "--d": d,
            "--s": 1 - near * 0.42,
            opacity: entering && !going ? 0 : a <= 1 ? 1 - a * 0.56 : Math.max(0, 0.44 - (a - 1) * 0.44),
            filter: `saturate(${1 - near * 0.35})`,
            zIndex: going ? 20 : 10 - Math.round(a),
            ...(going && { transform: entering.transform }),
          } as CSSProperties;
          return (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              ref={(el) => {
                items.current[i] = el;
              }}
              className={cx("item", { current, going })}
              style={style}
              aria-label={current ? `Step into ${p.name}` : `Show ${p.name}`}
              aria-current={current || undefined}
              draggable={false}
              onClick={(e) => onItemClick(e, i)}
              onPointerEnter={(e) => current && e.pointerType === "mouse" && setPeek(true)}
              onPointerLeave={() => setPeek(false)}
            >
              <span className={cx("lift")}>
                <span className={cx("jelly")}>
                  {/* 가운데 블록에 올리면 반대 시간대를 엿본다 */}
                  <Poster slug={p.slug} night={current && peek && !entering ? (night < 0.5 ? 1 : 0) : night} eager={i <= 1} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <button type="button" className={cx("arrow", "prev")} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous place">
        ←
      </button>
      <button type="button" className={cx("arrow", "next")} onClick={() => go(index + 1)} disabled={index === N - 1} aria-label="Next place">
        →
      </button>

      <div className={cx("caption")} aria-live="polite">
        <div className={cx("count")}>
          {pad(index + 1)} / {pad(N)}
        </div>
        {/* key 로 바뀔 때마다 다시 떠오른다 */}
        <h2 key={place.slug} className={cx("name")}>
          {place.name}
        </h2>
        <div key={`${place.slug}-b`} className={cx("blurb")}>
          {place.blurb}
        </div>
      </div>

      <nav className={cx("index")} aria-label="Places">
        {PLACES.map((p, i) => (
          <button key={p.slug} type="button" className={cx({ on: i === index })} onClick={() => go(i)} aria-current={i === index || undefined}>
            {p.name}
          </button>
        ))}
      </nav>
    </main>
  );
}
