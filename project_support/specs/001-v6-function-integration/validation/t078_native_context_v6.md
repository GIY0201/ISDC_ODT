# T078 native 입력 승인과 V6 화면 검증


## 2026-10-07 T078 native 입력 승인과 V6 군집 서비스 화면

기존 RuntimeState가 수락 배치 명부와 현재 장애를 대조한 뒤 전체 위성 정의, 활성 지상국, 공통 UTC, 선택한 외부 GP/EOP/윤초, 실제 군집 모듈 instance/sequence를 확인한다. 설치된 native point receipt를 검증하고 불변 분석 입력 사본을 수락한다. 새 /api/nodes/mission-context와 선택적인 X-ISDC-Mission-Context 헤더는 계산 전후 입력 변경을 거부한다. 기존 API 형태는 유지하며 원래 orchestration 라우터를 실제 factory에 조립했다. 승인 해시는 입력 범위 확인이며 물리적 통신 성공이나 caller가 보낸 전체 window/mesh의 독립 검증 증거는 아니다.

V6의 기존 SIM 임무 화면을 보존하면서 다섯 군집 서비스 요청, source 저장소, original scheduler ICD-03 클라이언트, native request builder와 execution controller를 연결했다. 선배의 UTC timeline 파일은 고정 commit 원본과 byte-identical로 복사했고 원래 처리량/전송률/계획 창/장애·busy 투영을 재사용한다. 위성·지상국 목록 선택, 관측 지점 preset, 카탈로그 외부 위성 선택을 사용한다. 원본 node/optical/common-clock/ground/SIM owner가 현재 입력을 제공한다. 계획·확정·취소는 명시 버튼이며 확정 작업 전체와 최초 분석 UTC를 보낸다. 서버가 보유한 다른 창의 예약도 busy 입력에 반영한다. 편집값·잘못된 입력·저장 오류를 보존하며 외부 storage 변경 후 재조회 전 명령을 막는다. 대기 취소와 동일 요청 재시도/서버 증거 조회를 제공한다.

현재 source module/transport/timeline missing RED 후 구현. 입력 승인 일부 provisional class는 factory integration RED 전에 작성한 상태였으며 전체 과정을 test-first라고 주장하지 않는다. 초기 fullNode832PASS1FAIL은 기존 orbit select 격리 fixture에 신규 import 대체가 없었던 오류이며 기존 assertions를 유지하고 fixture만 수정했다. 설치된 native + actual ASGI factory의 실제 data deployment acceptance, 2h window, source compute3-task feasible plan→exact commit→abort를 검증했다. 수정된 작업409, 빈 approval header409, 잘못된 bands422, late 배치/모듈/장애 결과 거부를 확인했다. 실행 포트/브라우저 전체 동작 증거는 별도로 기록한다.

Chrome의 실제8891에서 군집 서비스 화면은 표시됐다. 실행 중인 이전 server factory에는 신규 module route가 없으므로 조회 오류가 표시됨을 확인했다. 현재 SIM/run/elapsed/events/missions/devices와 GP 선택을 먼저 캡처했다. unconfigured SIM, active fault 없음, 빈 deployment만 복원 가능한 개발 전환 method/factory를 추가하고 atomic rejection/복사/설정·이벤트 보존을 검증했다. 정상 factory의 자동 복원이나 새 공개 명령 API는 만들지 않았다. accepted deployment/hardware/module work 복원으로 확대하지 않는다.

T078/N010/N011과 전체 T075–T084는 미완료 유지. 실제8891 새 factory 적용과 live lifecycle, 모든5종 native feasibility/failure, 재시작 후 계획 adoption/reconciliation, multiwindow/성능/원격 module/통신 window·mesh 독립 증거, 나머지 영역·Terra/모든GPU/T032/N001/N008/N009/T137인증/실장비RF-HIL/다운로드 bytes/리뷰가 남았다. 같은 codex/satellite-node-integration 브랜치를 유지하고 remote push/merge/신규 branch는 수행하지 않았다. 사용자 시한은 한국시간10월7일01:00이다.

최종 코드 검증: fullPython821PASS, 기존 ERFA warning8개,207.20s(session69135 exit0). fullNode838PASS,4895.2763ms이며 이후 복제·초안삭제 버튼 추가는 source panel4PASS로 확인했다. 전체 시험에서 제외한 항목은 없다. 실제 factory 설치 native/수락 deployment/3task lifecycle를 포함한 focused10PASS도 확인했다. 현재 live8891 backend 적용은 다음 단계다.


## 2026-10-07 실제 Chrome 연결 보완

8891을 새 factory로 전환하고 같은 SIM run, 증가하는 elapsed, missions/devices/events와 GP 입력/UTC를 캡처·대조했다. 새 모듈 instance의 상태 조회와 다섯 서비스 폼은 실제 Chrome에서 확인했다. 이전 테스트 Fabric 상태는 별도 캡처하며 새 instance의 승인으로 가져오지 않았다.

실화면에서 드러난 연결 결함을 수정했다. 첫째, public status의 millisecond 반올림을 내부 data delivery 시각으로 사용하면서 배치 시작이 미래로 판정됐다. 기존 RuntimeState 내부 context는 소유자의 원래 precision을 유지하고 public display는 그대로 둔다. 반올림 양쪽 경계 RED 후 배치/후속 delivery48PASS, fullPython823PASS8existingERFAwarnings207.31s를 확인했다. 둘째, V6 node owner에 missionInputs/기존 optical update·verification port가 빠져 있었다. 실제 owner와 수락 배치/초안 변경/paused UTC/복사/종료 및 실제 optical proof를 대조하는 RED 후 연결했고 fullNode840PASS4618.513ms를 확인했다. 이전 검증 문서의 node port 연결 설명은 이 실제 수정으로 충족됐으며, 대체 port를 쓴 단위 시험만으로 전체 구성 검증을 완료했다고 보지 않는다.

실제 Chrome의 1-node/10MB/0.1 output compute 요청은 installed native approval+windows+original scheduler로 feasible3-task 계획과 UTC timeline을 표시했고 abort도 서버에서 수락됐다. commit은 Python float(4.0)와 JS JSON number(4)의 문자열 차이로409였음을 기록한다. 실제 factory/native lifecycle 시험에 browser numeric representation을 추가해 RED를 재현하고, exact numeric value를 비교하되 bool/type/key/order/값 차이를 구분하는 구조 비교로 수정했다. 관련22PASS를 확인했고 최종 fullPython 및 live commit 확인은 별도 추가 기록한다.

확정 계획·실제 통신·5종 전체 lifecycle 및 모든 T075–T084의 완료를 주장하지 않는다. 같은 브랜치,8891/0.0.0.0,기존 native0.3.0과 사용자 원본을 유지한다. 검증용 Chrome 작업만 생성했으며 원래 IAB 저장소를 수정하지 않았다.


최종 실화면 확인: 새8891 factory의 원본 계획 v2가 feasible3-task로 계산됐고 Chrome에서 commit 수락, 서버 held tasks3개를 확인했다. 이어 abort 수락/서버 committed 빈 명부, 검증용 배치 회수 revision4/빈 노드를 확인했다. 캡처 t078_final_live_committed.json / t078_final_live_cleanup.json / t078_source_mission_chrome.jpg. 사용자 원래 SIM missions/devices/events/run과 GP UTC는 서버 전환 캡처로 보존 대조했다. 검증용 Chrome 초안과 aborted 요청은 검증용 이름으로 남겼다.

최종 fullPython824PASS8existingERFAwarnings210.27s(exit0), fullNode840PASS4873.2648ms(exit0). 실제 compute lifecycle만 이 증거로 수락하며 나머지4종 전체 live lifecycle, 전체 T075–T084/N010/N011/T078, 다중 창/성능/모듈 복원 및 실제 통신 장비 검증은 미완료다. 고정8891 서버는 계속 실행한다. 같은 브랜치의 로컬 커밋으로 남기며 remote push/merge는 수행하지 않는다.
