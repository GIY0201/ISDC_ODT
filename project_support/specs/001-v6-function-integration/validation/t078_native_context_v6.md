# T078 native 입력 승인과 V6 화면 검증


## 2026-10-07 T078 native 입력 승인과 V6 군집 서비스 화면

기존 RuntimeState가 수락 배치 명부와 현재 장애를 대조한 뒤 전체 위성 정의, 활성 지상국, 공통 UTC, 선택한 외부 GP/EOP/윤초, 실제 군집 모듈 instance/sequence를 확인한다. 설치된 native point receipt를 검증하고 불변 분석 입력 사본을 수락한다. 새 /api/nodes/mission-context와 선택적인 X-ISDC-Mission-Context 헤더는 계산 전후 입력 변경을 거부한다. 기존 API 형태는 유지하며 원래 orchestration 라우터를 실제 factory에 조립했다. 승인 해시는 입력 범위 확인이며 물리적 통신 성공이나 caller가 보낸 전체 window/mesh의 독립 검증 증거는 아니다.

V6의 기존 SIM 임무 화면을 보존하면서 다섯 군집 서비스 요청, source 저장소, original scheduler ICD-03 클라이언트, native request builder와 execution controller를 연결했다. 선배의 UTC timeline 파일은 고정 commit 원본과 byte-identical로 복사했고 원래 처리량/전송률/계획 창/장애·busy 투영을 재사용한다. 위성·지상국 목록 선택, 관측 지점 preset, 카탈로그 외부 위성 선택을 사용한다. 원본 node/optical/common-clock/ground/SIM owner가 현재 입력을 제공한다. 계획·확정·취소는 명시 버튼이며 확정 작업 전체와 최초 분석 UTC를 보낸다. 서버가 보유한 다른 창의 예약도 busy 입력에 반영한다. 편집값·잘못된 입력·저장 오류를 보존하며 외부 storage 변경 후 재조회 전 명령을 막는다. 대기 취소와 동일 요청 재시도/서버 증거 조회를 제공한다.

현재 source module/transport/timeline missing RED 후 구현. 입력 승인 일부 provisional class는 factory integration RED 전에 작성한 상태였으며 전체 과정을 test-first라고 주장하지 않는다. 초기 fullNode832PASS1FAIL은 기존 orbit select 격리 fixture에 신규 import 대체가 없었던 오류이며 기존 assertions를 유지하고 fixture만 수정했다. 설치된 native + actual ASGI factory의 실제 data deployment acceptance, 2h window, source compute3-task feasible plan→exact commit→abort를 검증했다. 수정된 작업409, 빈 approval header409, 잘못된 bands422, late 배치/모듈/장애 결과 거부를 확인했다. 실행 포트/브라우저 전체 동작 증거는 별도로 기록한다.

Chrome의 실제8891에서 군집 서비스 화면은 표시됐다. 실행 중인 이전 server factory에는 신규 module route가 없으므로 조회 오류가 표시됨을 확인했다. 현재 SIM/run/elapsed/events/missions/devices와 GP 선택을 먼저 캡처했다. unconfigured SIM, active fault 없음, 빈 deployment만 복원 가능한 개발 전환 method/factory를 추가하고 atomic rejection/복사/설정·이벤트 보존을 검증했다. 정상 factory의 자동 복원이나 새 공개 명령 API는 만들지 않았다. accepted deployment/hardware/module work 복원으로 확대하지 않는다.

T078/N010/N011과 전체 T075–T084는 미완료 유지. 실제8891 새 factory 적용과 live lifecycle, 모든5종 native feasibility/failure, 재시작 후 계획 adoption/reconciliation, multiwindow/성능/원격 module/통신 window·mesh 독립 증거, 나머지 영역·Terra/모든GPU/T032/N001/N008/N009/T137인증/실장비RF-HIL/다운로드 bytes/리뷰가 남았다. 같은 codex/satellite-node-integration 브랜치를 유지하고 remote push/merge/신규 branch는 수행하지 않았다. 사용자 시한은 한국시간10월7일01:00이다.

최종 코드 검증: fullPython821PASS, 기존 ERFA warning8개,207.20s(session69135 exit0). fullNode838PASS,4895.2763ms이며 이후 복제·초안삭제 버튼 추가는 source panel4PASS로 확인했다. 전체 시험에서 제외한 항목은 없다. 실제 factory 설치 native/수락 deployment/3task lifecycle를 포함한 focused10PASS도 확인했다. 현재 live8891 backend 적용은 다음 단계다.
