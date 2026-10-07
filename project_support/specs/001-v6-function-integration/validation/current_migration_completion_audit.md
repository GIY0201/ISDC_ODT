# 전체 이식 완료 판정: 2026-10-07 현재 작업 트리

이 문서는 기존 검사 결과를 재사용한 완료 판정이다. 검증을 반복하거나 T075–T083의 미체크를 미구현 함수 수로 해석하지 않는다. 원본 기준은 읽기 전용 선배 저장소 HEAD `1a1e00297a0301637455b0ef2cf48b2e74576b07`이며 현재 개발 트리 HEAD는 `9489d0464b18aef786bbe5bbc9beb27b3029ec4d`이다. 최신 UI 변경은 아직 작업 트리에 있다.

## 원본 기능 연결 대조

| 항목 | 현재 연결 | 완료 판정의 남은 경계 |
|---|---|---|
| T075 궤도, 카탈로그, 모델, 지상국, 태양 | workspace_orbit의 원본 catalogue/time/scene/pass/station/model/solar owner와 Rust 정밀 좌표 계산 | 메인과 상황판 동시 실제 표시, 선택 시간 재생 경로, 일부 모델 가독성과 두 해상도 |
| T076 노드, 편집, 군집, 배포 | workspace_nodes의 원본 editor/library/store/deployment/native renderer | 대표 수동 군집·장비 편집의 현재 UI 흐름 |
| T077 통신망, OISL, 경로, 접촉, DTN, RF | ground_network, native optical/network, fabric, 원본 network_diagram과 RF 11필드 | 현재 station focus/coverage/link toggle/route 조회 흐름 |
| T078 임무와 스케줄 | source_missions, mission_services/execution, 원본 planner 및 ICD03 | pickup 재계획, task/filter/6·12·24시간 정상 UI 흐름 |
| T079 데이터와 서비스 | source_data, 원본 data-management/ICD01와 guarded deployment | 새 service 요청/결과, 대표 진행 표시 |
| T080 보안 관측과 규칙 | source_security, 원본 rule stand-in 및 ICD08 | 최근 배치의 실제 표시 확인; 기존 오류 검사는 재사용 |
| T081 PoC와 실행·비교 | 원본 scenario runner/definitions/KPI 및 공유 SIM과 composer/run/compare | 명시 analysis follow/release 및 scenario route 초안 전달의 UI 확인 |
| T082 공유 맥락과 운용 창 | 검증된 workspace_context, 기존 서버 SIM/저장 궤도 상태와 입력 초안 전달 | 새 상황판 선택/clear, 다른 기기 정지→재생 변경 발견, 카탈로그 시간 소유자 공유 |
| T083 설정과 ICD | 기존 source_settings singleton을 DT integration에 배치; 환경 설정 분리 | 이동한 integration의 실제 정상 흐름 확인 |
| T084 원본 다운로드 | 실제 Chrome JSON/CSV 바이트 대조와 PoC VF03 파일 근거 | 해당 범위 완료, 다른 기능의 완료를 대신하지 않음 |

독립 읽기 전용 소스 감사는 선배 app.js의 9개 주요 console 영역에서 새로 누락된 도메인 API/계산 연결을 발견하지 못했다. 원본 scenario route handoff, paused native SVG/RF, periodic analytical display 연결은 기존 수정으로 해소되어 있다. 전체화면과 전체 UI 테마 저장의 두 원본 편의 기능은 미연결로 발견하여 T195에 추가했다. 원본 자동 probe를 명시 probe로 바꾼 승인된 정책 및 원본 nominal timing 실패를 보존한다.

## 완료를 막는 현재 사실

- T191: 지구 DOM을 상황판으로 이동하여 메인이 사라지던 방식은 사용자의 관제센터 목적에 맞지 않아 별도 표시 자원으로 교체 중이다. 카메라는 화면별, 계산·시간·권한 소유자는 기존 하나다.
- T192: 기존 BroadcastChannel은 같은 출처의 UI 초안 전달이다. 다른 기기 서버 동기화를 입증하지 않는다. 저장 궤도의 기존 5초 상태 조회를 정지한 관측자에게도 적용하는 변경 및 실제 두 클라이언트 근거가 필요하다. 카탈로그의 독립 화면 시간 소유자 공유는 별도로 미완료다.
- T193: 전체 위성 ON은 현재 한 UTC의 계산 결과다. 원본은 관측소·선택 위성 없이 전체 GP를 진행 시각으로 전파했으며 현재 Rust 전체 scene도 관측소를 요구하지 않는다. 기존 시간 소유자의 진행 UTC를 전체 scene.observe에 연결하는 기능 차이가 남아 있다. 임의 시계나 공전 애니메이션으로 이를 숨기지 않는다.
- T194: 상시 예시 경보줄과 긴 왼쪽 설명을 정리하고 우측 상세 정보·확인된 썸네일로 바꾸는 현재 UI 수정은 실제 화면 확인 전이다.
- PR32는 open draft, merged=false이며 최신 UI 변경의 commit/push/review가 남아 있다.
- 실제 1280×720 및 1920×1080 확인은 현재 기록만으로 입증되지 않는다. 브라우저 viewport 요청이 실제 크기를 바꾸지 않았던 기록을 성공으로 바꾸지 않는다.
- 최소 반응속도 SC006은 사용자가 UI 조정과 PR 종료 뒤로 미뤘다. 현재 완료 증거로 포함하지 않는다.

## 재사용할 검증 근거

원본 비교/golden, 최신 전체 Node 1996 PASS 및 Python 967 PASS/1 기존 SKIP, 실제 원본 40노드 PoC와 RF 11필드 계산·복원, data/security/settings 정상 흐름, T084 원본 파일 바이트를 재사용한다. 새 코드와 경계에 대한 관련 회귀시험 및 실제 화면 증거만 추가한다. 실패 행렬 전체를 다시 수행하지 않는다. 한정 소스 감사와 테스트 통과를 전체 운영 인증이나 실측 RF/HIL로 표현하지 않는다.

현재 판정: 주요 원본 도메인 연결은 확보했지만, 전체 이식 완료는 아직 입증되지 않았다. 목표는 유지한다.

### T193 source-audit correction and T196 checkpoint
The original full-catalogue OrbitClock ran live and propagated all records without a station or selected satellite. Current native catalogue scene supports station-free batch propagation, so static full-scene playback is an unresolved time-owner connection. Selected observer/601 samples are not an original prerequisite. A bounded design can reuse accepted existing stored/scenario/catalogue owner UTC with full scene hashes and generation/revision guards; it has not yet been implemented. T196 normal-startup behavior is independently verified (28 tests and actual public-server IAB). These findings do not close the original overall migration goal.

