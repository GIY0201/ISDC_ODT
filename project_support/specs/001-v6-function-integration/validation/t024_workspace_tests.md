# T024 작업창 회귀시험 준비

2026-10-03. 제품 구현은 T023까지이며 이번 변경은 시험과 기록만 추가한다.

## 시험 경계

`project_support/tests/browser/workspace.test.mjs`는 실제 workspace.js, workspace_orbit.js와 ground panel/playback/globe 조립 코드를 실행한다. DOM/Cesium/HTTP/시간은 시험 adapter다. DOM geometry adapter는 현재 CSS 최소·최대 크기를 모델링하지만 실제 렌더링 엔진은 아니다. 별도 창 동기화(T031), 동시성(T026/T027), 게임 성능(T028)은 이 시험의 완료 범위가 아니다.

## 결과

- 새 시험 10개: 5 PASS / 5 FAIL. skip/xfail 없음.
- 전체 Node 50개: 45 PASS / 5 FAIL, exit 1. 기존 40개는 PASS.
- 전체 Python: 202 PASS / 기존 Starlette 경고 1, 100.57초.
- 일반 이동·크기 변경, 1280×720 및 1920×1080 최소화/복원·확장 시 지점 draft와 실제 구간 결과 보존, 단일 Viewer 유지, pointercancel 구독 해제는 PASS.
- 실패: 일반 해상도 축소 후 하단 경계 이탈, 최소화 중 해상도 축소 후 복원 시 오른쪽 경계 이탈, 확장 중 해상도 축소 후 원래 크기 복원 시 경계 이탈, 최종 pagehide에서 BroadcastChannel 미해제, 진행 중 드래그의 최종 pagehide에서 포인터 구독 미해제.

마지막 두 실패는 각각 channel/pointer assertion이다. Renderer·timer의 기존 종료 검증은 통과했으며, 첫 실패 이후 실행되지 않은 assertion까지 성공으로 해석하지 않는다.

## 실제 브라우저 확인

기존 8877 IAB 화면에서 1920×1080으로 설정하고 키보드로 창을 이동했다. 이동 후 rect는 left 1058.5 / top 446 / right 1818.5 / bottom 1006이었다. 최소화 → 1280×720 변경 → 복원 후 동일 rect가 남아 오른쪽과 하단이 화면 밖으로 나갔다. 입력과 기존 1개 구간 결과는 유지됐다. 키보드로 창을 다시 화면 안으로 이동하고 임시 viewport 설정을 해제했다.

실제 브라우저 확인은 최소화/복원 실패 한 경로다. 나머지 네 실패는 adapter 시험 증거이며 실제 브라우저 전 경로 확인으로 주장하지 않는다. screenshot: `data/workspace/validation/workspace/t024_restore_offscreen.png`; Node receipt: `t024_full_node.tap`. 실행 증거는 ignore된 workspace에 둔다.

## 다음 단계

T024 시험 준비 완료. T025에서 크기와 위치를 함께 제한하고 복원 시 현재 viewport에 다시 맞추며, 문서 종료 시 채널·진행 중 gesture를 정리한 뒤 모든 assertion을 재검증한다. 실패 시험만 독립적으로 정상 병합하지 않고 T025 구현과 함께 리뷰한다. F001 실제 통신 조건 조사·적용과 F002 전체 선배 기능 연결은 열린 상태다.
