"use client";

import { Component, type ReactNode } from "react";
import { Loading } from "./Frame";

interface State {
  failed: boolean;
}

/**
 * WebGL 을 못 만들거나(미지원 브라우저·GPU 차단) 렌더러가 던진 에러를 받아 빈 화면 대신 안내 문구를 보여준다.
 * R3F Canvas 는 내부 에러를 부모 경계로 다시 던진다.
 */
export class GlBoundary extends Component<{ children: ReactNode; onFail?: () => void }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[aqua] 3D 렌더러를 만들 수 없습니다", error);
    // 페이지의 로딩 오버레이를 걷어 안내 문구가 보이게 한다
    this.props.onFail?.();
  }

  render() {
    if (this.state.failed) return <Loading text="이 브라우저에서는 3D 장면을 그릴 수 없어요. WebGL 을 켜거나 다른 브라우저로 열어주세요." />;
    return this.props.children;
  }
}
