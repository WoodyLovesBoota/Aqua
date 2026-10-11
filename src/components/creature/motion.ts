/** 생물의 헤엄 상태 — AI 가 프레임마다 갱신하고 PlushCreature 가 셰이더 유니폼으로 넘긴다 */
export interface CreatureMotion {
  /** 박자 배수 (꼬리·날개·노) */
  beat: number;
  /** 헤엄 진폭 0..1 */
  amp: number;
  /** 몸 휘어짐 -1..1 (회전 중) */
  turn: number;
}
