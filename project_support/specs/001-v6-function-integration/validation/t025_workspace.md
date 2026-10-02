# T025 작업창 경계 및 종료 수정

2026-10-03. T024 실패 5개를 제품 수정 후 같은 assertion으로 재검증했다.

## 구현

workspace.js의 fitWindow가 현재 화면의 레일/헤더/푸터 경계 안으로 크기를 먼저 줄이고 위치를 제한한다. 일반 resize, 최소화 복원, 확장 복원, 작업창 열기 및 크기 조절에서 재사용한다. 렌더나 입력 노드를 다시 만들지 않는다. 진행 중 gesture 종료 함수를 문서 수명에 연결하고 최종 pagehide에서 capture/listener와 BroadcastChannel을 멱등 정리한다. persisted pagehide는 bfcache 복귀를 위해 기존 자원을 유지한다. resize 때도 진행 중 gesture를 종료한다.

기존 state.js와 legacy 콘솔, CSS는 수정할 필요가 없어 보존했다. API/wire/runtime/계산 의미 변경 없음. index의 entry script 버전은 t025-r1로 갱신했다.

## 자동 시험

- 작업창 10/10 PASS; T024의 geometry 3개와 channel/gesture 종료 2개 실패 해소.
- 전체 Node 50 PASS, 216.32ms, exit 0, skip/xfail 없음.
- 전체 Python 202 PASS, 기존 Starlette 경고 1, 101.17초.
- git diff --check PASS. 요구 체크리스트 8/8; extension hooks 없음.

DOM/Cesium/HTTP/시간 adapter를 사용하는 Node 시험과 실제 브라우저 확인은 별개다. pagehide 자원 해제와 bfcache 보존은 Node assertion 증거이며 실제 브라우저 메모리 계측 결과가 아니다.

## 실제 IAB

8877의 t025 entry로 저장 TLE/가상 제주 높이321m/최소각10도/400초 범위를 계산했다. revision9, 구간1개, 최대각16.3345도. draft 수정은 기존 결과를 의도대로 무효화하므로 재계산 후 결과를 보존 기준으로 사용했다.

- 1920×1080 → 최소화 → 1280×720 → 복원: left632/top131/right1272/bottom691. 입력과 계산 결과 동일.
- 1920×1080 → 확장 → 1280×720 → 복원: 동일 경계 안의 rect, 계산 결과 동일.
- 1920×1080에서 높이 키보드 확대 → 1280×720 일반 축소: left80/top116/right720/bottom691. 입력321m와 계산 결과 유지, canvas1개.
- 브라우저 error 로그 없음. 임시 viewport 해제. screenshot: data/workspace/validation/workspace/t025_restored.png.

두 규정 해상도에서 확인했으며 더 작은 화면의 전체 사용성 보장은 아니다. 게임 성능, 다중창 동기화, 역순 응답·과부하 전체 검증은 T028/T031/T026~T027에 남는다. F001 실제 통신 조건 확인·적용과 F002 전체 선배 기능 연결도 유지한다.

T001~T025 완료(시험 준비 task 포함), 첫 묶음 남은6개 T026~T030/T031. 전체 제품 완료율이 아니며 PR 리뷰와 병합은 별도다.
