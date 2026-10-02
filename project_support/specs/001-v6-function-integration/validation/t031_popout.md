# T031 별도 창 동기화 검증

2026-10-03. 범위는 V6 별도 창 보존과 서버 선택 동기화다. 전체 제품 완료가 아니다.

## 변경 및 실패 재현
- 현재 업무와 미적용 높이/UTC 편집값을 부모에서 실제로 연 자식에게만 전달한다. 자식은 opener 메시지만 받는다.
- 화면 재구성 후 편집값을 복구하고 같은 값을 복구할 때 가시성 결과를 취소하지 않는다. 활성 편집값과 외부 수정이 충돌하면 현재 값을 보존하고 안내한다.
- 저장 입력/재생속도 선택은 draft 채널에서 제외한다. revision 채널은 힌트만 전달하고 각 창이 서버 snapshot을 조회한다. 409는 snapshot을 다시 읽으며 명령을 자동 재시도하지 않는다. 바쁜 요청 뒤 힌트 처리, focus 재조회, 최종 pagehide 채널/Viewer 정리를 포함한다.
- 첫 popout 시험 8개 중 5개 실패(입력 복구/송신자 검증/편집 안내 등), revision 모듈 부재 2개와 충돌 snapshot 읽기 1개 실패를 확인한 뒤 구현했다. 추가 회귀 2개가 selector 위조와 불필요한 편집 표시로 실패했고 보완 후 통과했다.

## 자동 검증
- `node --test project_support/tests/browser/*.test.mjs`: 74 PASS, 실패/skip 0. 실제 workspace/orbit/ground/globe 조립, DOM/Cesium/시간/HTTP adapter를 사용한다. 실제 두 OS 창이나 GPU 성능을 입증하는 시험은 아니다.
- `project_support/.venv/Scripts/python -m pytest -q --tb=short -o cache_dir=data/workspace/validation/workspace/pytest_cache`: 207 PASS (102.02초), 기존 Starlette deprecation warning 1개.
- 실제 client 두 개의 동일 revision 선택 중 409에 snapshot 재조회/재시도 없음 검증. 실제 ASGI 동시성 회귀는 T026/T027 시험을 재실행했다.
- `git diff --check`: PASS.

## 실제 Chrome 검증
- 독립 preview 8877, agent가 연 부모/자식 창에서 현재 ground 업무, 높이444m와 400초 UTC 범위를 전달하고 유지했다.
- 자식555m → 부모555m, 부모 편집을 blur한 뒤 자식777m → 부모777m 확인. 자식555m 활성 편집 중 부모666m 메시지는 자식555m를 보존하며 충돌 안내를 표시했다.
- 자식 저장 입력 TLE→OMM→TLE 선택이 부모 select에도 반영됐다. 마지막 TLE 복원. 미적용 높이는 서버에 적용하지 않았다.
- 자식 close Enter 이후 탭 목록에서 자식이 사라지고 부모 canvas1/ground 업무가 유지됐다. 종료 과정 도구는 이미 닫힌 탭 오류를 반환했으므로 별도로 실제 탭 목록/부모 DOM으로 완료를 확인했다.
- 부모 error 로그0. parent screenshot: `data/workspace/validation/workspace/t031_parent.png` (Git 제외). 자식 screenshot와 title click은 CDP timeout으로 캡처/클릭 증거에서 제외했다. 입력/선택/충돌 DOM 관찰은 성공했다.
- IAB에서는 popup을 제어 가능한 탭 목록으로 확인할 수 없어 Chrome 실제 popup으로 검증했다. 팝업 차단과 멱등 채널/Viewer 해제는 adapter 회귀 증거다. 모든 브라우저/장시간 누수 검증 완료를 주장하지 않는다.

## 남은 범위
첫 묶음28/31, 남은 T028 성능, T029 격리 설치, T030 검증 정리. 60fps/입력50ms/하루계산1초 목표는 아직 PASS가 아니다. F001 실제 통신 조건 조사·적용과 F002 전체 선배 기능 연결은 필수 미완료다. PR 리뷰/병합은 별도이며 자동 병합하지 않는다.
