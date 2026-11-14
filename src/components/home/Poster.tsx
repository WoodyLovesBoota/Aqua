/* eslint-disable @next/next/no-img-element -- 확대 진입 때 원본 해상도가 그대로 필요해 next/image 의 축소본을 쓰지 않는다 */
import classNames from "classnames/bind";
import styles from "./Poster.module.scss";

const cx = classNames.bind(styles);

/** 전시 한 곳의 사진: 낮 위에 밤을 night(0~1)만큼 겹친다. 배경이 투명한 16:10 */
export function Poster({ slug, night, eager = false }: { slug: string; night: number; eager?: boolean }) {
  return (
    <span className={cx("poster")}>
      <img src={`/posters/${slug}-day.webp`} alt="" draggable={false} loading={eager ? "eager" : "lazy"} decoding="async" />
      <img src={`/posters/${slug}-night.webp`} alt="" draggable={false} loading={eager ? "eager" : "lazy"} decoding="async" style={{ opacity: night }} />
    </span>
  );
}
