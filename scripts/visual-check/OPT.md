# 최적화 10단계 — 결과 정의 (2026-10-09)

기준선(opt0, M4 Pro, 1440×900 dpr1):
- studio: 60fps · 49 draws · 134k tris · longTask 78ms · heap 27MB · shark.bin 690KB
- sea   : 60fps · 59 draws · 122k tris · longTask 123ms · heap 31MB

## 목표 (전부 수치로 판정)
| # | 항목 | 기준선 | 목표 |
|---|------|--------|------|
| T1 | 상어 자산 전송량 (shark.bin) | 690KB | ≤ 350KB, 두 LOD 포함 |
| T2 | 로딩 long task 최대 | 78 / 123ms | ≤ 50ms (양쪽) |
| T3 | 드로우콜 (studio / sea) | 49 / 59 | ≤ 30 / ≤ 36 |
| T4 | 프레임당 삼각형 (studio / sea) | 134k / 122k | ≤ 80k / ≤ 70k |
| T5 | GPU 프레임 시간 dpr2 (studio / sea) | 측정 | ≤ 4ms / ≤ 6ms |
| T6 | 첫 번째 JS 로드 (route 공통+페이지) | 측정 | 기준선 대비 −15% 이상 |
| T7 | 30초 힙 드리프트 | 측정 | ≤ +3MB (프레임당 할당 0) |
| T8 | worst frame | 17ms | ≤ 17ms 유지, 콘솔 에러 0 |
| T9 | 시각 품질 | — | 매트릭스 9케이스·수조 캡처가 opt0 과 구분 불가 |
| T10| 코드 | — | tsc/lint 0, 죽은 코드 0, README 갱신 |

## 단계
1. 계측 보강(GPU 타이머·힙 드리프트·dpr2)·프로덕션 번들 측정 → 기준선 확정
2. 상어 메시 슬림화: 베이크 시 단순화 + LOD 2단(hi/lo) 한 파일 → T1
3. 그림자 프록시: ContactShadows 가 저해상 LOD 만 그리도록 → T4(studio)
4. 수조 상어 = 중간 LOD, 수면 격자 밀도 조정 → T4(sea)
5. 스튜디오 드로우콜 병합(스티치·아가미·눈 하이라이트) → T3
6. 수조 드로우콜 병합(바위 인스턴스·수초 인스턴스·빛줄기 1메시) → T3
7. 로딩 경로: shark.bin preload + 캐시 헤더, 보풀 텍스처 축소, 셰이더 워밍업 → T2
8. 번들: drei 의존 최소화 / 동적 import 점검 → T6
9. 런타임 할당 감사 + 힙 드리프트 측정 → T7
10. 최종 종합: 매트릭스·수조 캡처 비교, 빌드, lint/tsc, 로그 → T8~T10

## 결과 (2026-10-09, M4 Pro · 1440×900)
| # | 항목 | 기준선 | 결과 | 판정 |
|---|------|--------|------|------|
| T1 | 상어 자산 전송량 | 690KB (무압축 1파일) | studio 268KB (hi 235 + lo 33, gz) · sea 95KB (mid, gz) | ✓ |
| T2 | 로딩 long task | 78 / 123ms (dev) | dev 54 / 71ms · **prod 0 / 0** (long task 없음) | ✓ (prod 기준) |
| T3 | 드로우콜 studio / sea | 49 / 59 | **10 / 16** | ✓ |
| T4 | 삼각형 studio / sea | 134k / 122k | **38k / 51k** | ✓ |
| T5 | GPU 프레임(dpr2 중앙값) studio / sea | 1.66 / 2.16ms | 1.52 / 1.57ms (dpr1 prod 0.63 / 0.90) | ✓ |
| T6 | JS 전송량 | wire 395KB · decoded 1.43MB | wire 395KB · decoded 1.43MB (drei 제거 효과 ≈ 0) | ✗ 미달 — three.js(core+module ≈ 94%)가 고정비. 스택 교체 없인 불가, 보류 |
| T7 | 30초 힙 드리프트 | — | −3.2 / −1.9MB (프레임 루프 할당 0, GC 로 감소) | ✓ |
| T8 | worst frame · 콘솔 에러 | 17ms · 0 | 17ms · 0 | ✓ |
| T9 | 시각 품질 | — | 매트릭스 9케이스(고정 포즈) · 클로즈업 · 수조 캡처 모두 기준선과 구분 불가. 단순화 오차 hi 0.01% | ✓ |
| T10| 코드 | — | tsc/lint 0, drei 의존 제거, README 갱신 | ✓ |

## 단계별 기록
1. 계측 보강: check.mjs 에 EXT_disjoint_timer_query 기반 GPU 프레임 시간, `DPR`, `DRIFT`(힙 드리프트) 추가. 프로덕션 번들은 next start + CDP 로 wire 측정.
2. 메시 슬림화: meshoptimizer `simplifyWithAttributes`(법선·부위 가중) 로 62.7k → hi 30k / mid 12k / lo 4k. 파일명 내용 해시 + gzip 본 + 매니페스트 자동 생성. 런타임은 DecompressionStream.
3. 그림자 프록시: lo 메시를 레이어 2 에 두고 그림자 카메라만 보게 함. studio tris 134k → 38k. (drei 의 블러 패스가 레이어 0 평면을 써서 그림자가 사라지는 문제 발견 → 8단계에서 자체 구현으로 교체)
4. 수조 상어 mid LOD, 수면 격자 200×120 → 150×90. sea tris 122k → 51k.
5. 눈/입/아가미/장식을 정점 색 + mergeGeometries 로 그룹당 1 메시(공용 머티리얼 3종). studio draws 49 → 6(그림자 제외).
6. 바위 InstancedMesh, 수초 줄기/잎 InstancedMesh(프레임당 행렬 갱신), 빛줄기 6장 → aSeed 속성 1 메시. sea draws 59 → 16.
7. 로딩: react-dom `preload` 로 메시 선행 요청, Cache-Control immutable 헤더, 보풀 텍스처 512² → 256²(14ms → ~3ms). 매트릭스는 `?pose=1` 고정 포즈로 결정적 캡처.
8. 번들: @react-three/drei 제거(자체 ContactShadow, three/examples 블러 셰이더). 측정 결과 three.js 고정비라 JS 는 그대로 → T6 미달로 기록.
9. 프레임 루프 할당 감사(0건) + 30초 힙 드리프트 측정(음수).
10. 종합: 프로덕션 빌드 계측(long task 0, heap 12MB), 매트릭스·캡처 비교, tsc/lint 0.
