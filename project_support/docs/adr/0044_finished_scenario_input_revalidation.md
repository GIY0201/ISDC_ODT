# 완료된 시나리오 입력의 명시적 재검증

2026-10-07. T078/T081의 새로고침 후 현재 입력 검증 경로를 보완한다.

완료된 시나리오를 새로고침하면 브라우저 배치와 native 계산의 수락 증명이
무효화된다. 기존 재개 검증은 ready/paused만 허용하므로, 완료 결과를 보존한
채 현재 입력을 다시 확인할 수 없었다.

같은 resumePreflight 경로에서 finished를 허용한다. 저장된 source commit,
실행, 배치, 노드, 지상국, 임무, 장애, 모듈, native 정의 hash를 모두 비교하고,
실제 SIM UTC의 전체 native 계산과 입력 수락 응답을 다시 검증한다. 모든
비동기 작업 후 실행 ID, 경과 시간, 배속, 장애와 전체 runner 기록이 그대로인지
검사한다. 이 경로는 서버 실행 명령을 발행하지 않는다.

finished 결과는 validation_kind=finished_workspace_inputs,
playback_authorized=false를 반환하고 prepared=false를 유지한다. 화면 버튼은
‘완료된 실행 입력 재검증’이며 완료 안내에 조회 UTC와 재생 권한 부재를 표시한다.
완료 화면과 안내 dock의 재생, 전진, 배속 조작은 비활성화한다. 기존 ready/paused
재개 계약과 onResume 주입 연결은 유지한다.

관련 52개 시험과 전체 브라우저 코드 시험 1,106개가 통과했다. 실제 고정 8891
화면에서 동일 완료 실행과 후속 임무 도구를 검증하는 작업은 진행 중이다.
시험 통과를 전체 화면 수용 검증이나 물리 통신의 성공으로 해석하지 않는다.

## 자동 완료 checkpoint와 현재 입력의 별도 새 검토

실제 완료 실행 RUN-904CE008D00B의 엄격 재검증은 faults, missions,
module.committed, module.accepted_plans의 불일치를 표시했다. 원본 자동 tick은
최종 장애 해제·재계획·판정을 수행하고 결과를 저장하지만, adapter의 checkpoint는
수동 setup/pause/advance/다음 단계 wrapper에만 있었다. 실제 저장 proof의 원시
내용은 브라우저 기록 다운로드에 포함되지 않아 과거 특정 저장 시각을 단정하지
않는다. 자동 verdict tick을 그대로 호출한 회귀시험으로 최종 owner와 이전
checkpoint의 차이를 재현했다.

이후 자동 완료에는 기존 awaited endTick 경계에서 현재 owner를 checkpoint한다.
실제 SIM이 같은 실행에서 정지했는지, 비동기 모듈 조회 중 실행과 phase가
변하지 않았는지 검사한다. 성공·실패 모두 prepared=false가 되어 완료 실행의
전진 권한을 회복하지 않는다. 과거 완료 checkpoint를 소급해서 수정하지 않는다.

‘완료 실행의 현재 입력 새 검토’는 엄격한 과거 입력 재검증과 별도 작업이다.
기존 source commit·정의·실행·시작·전체 노드·배치·지상국·native hash와 임무
정의를 보존하고 같은 모듈 인스턴스만 허용한다. 현재 임무의 guarded 수락
receipt, 로컬 버전·전체 수락 필드, 모듈 확정 요약과 guarded 결정 receipt를 모두
확인한다. 확정 status는 원본의 {version, tasks: 개수} 요약이다. 전체 작업·계획 UTC는
guarded commit이 수락 전에 원본 accepted plan과 정확히 비교한다. 새 검토는
accepted_decisions의 같은 instance/mission/context/version/plan_sequence와 commit
수락, held_tasks 개수, 유효한 wallstamp, 범위 내 sequence를 함께 확인한다.
마지막 await 후에도 accepted_decisions 전체가 바뀌지 않았는지 검사한다.
다른 실행의 확정 임무나 오래된 로컬 계획은 거절하며 최신 버전 새
계획 또는 기존 명시적 취소를 검토하도록 안내한다.

그 뒤 실제 정지 SIM UTC에서 전체 native 계산과 기존 입력 수락 API를 사용하고,
최종 조회에서 현재 full evidence·모듈 sequence·입력 설정·runtime·runner record
불변성을 확인한다. 새 owner·endpoint·clock을 만들지 않는다. 반환값은
validation_kind=finished_current_inputs_review, playback_authorized=false이며
달라진 계약 필드 이름만 표시 복사본으로 반환한다. 과거 workspaceEvidence,
VF-03 결과, verdict를 쓰지 않는다. 현재 분석 proof는 기존 임무 도구의 새
native 요청 경로에 사용될 수 있지만, 과거 계획의 commit/재사용이나 시나리오
재실행 권한을 부여하지 않는다. 실제 장비 통신은 여전히 unknown이다.

회귀시험은 자동 원본 verdict tick, 과거 proof/결과 JSON byte 보존, 새 검토 성공,
stale 로컬 수락·확정 작업·버전·외부 임무·source 정의·roster·모듈 인스턴스,
마지막 await의 UTC/sequence/record/disposal 변경 거절을 포함한다. 실제 고정
8891 화면에서 새 작업의 수용 증거는 별도 검증한다.

### 실제 HTTP 확정 계약에 대한 보정

원본 stand_in.status().committed에는 내부 held task 배열·sequence·UTC가 없다.
초기 새 검토의 내부 held 형태 가정은 실제 HTTP 요약 계약과 달라 유효한
MSN-0004를 거절했다. backend/wire 변경 없이 실제 status 요약과 exchange의
accepted_decisions 수락 연쇄로 보정했다. commit receipt.time은 계획 UTC가
아닌 모듈의 wallstamp이며, 둘의 일치를 요구하지 않는다. 과거 checkpoint
계약에는 필드를 추가하거나 과거 증명을 수정하지 않는다.

mission_execution_http.json의 실제 router status/commit 캡처를 그대로 사용한
RED가 기존 ‘확정 작업 증명’ 오류를 재현했다. GREEN은 서로 다른 plan UTC와
commit wallstamp를 가진 실제 수락을 허용하고 요약/결정 작업 개수·context·버전·
plan_sequence·인스턴스·mission·결정·sequence·시간 형식·누락을 거절한다.
sequence를 바꾸지 않는 마지막 await의 결정-only 변경도 거절한다. 이는
현재 live 실행의 새로운 브라우저 수용 증거와 별도로 기록하는 회귀 증거다.
