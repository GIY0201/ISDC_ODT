# ADR0064: 전체 카탈로그 장면의 기존 시간원천 연결

상태: 설계 제안. 독립 검토 전이며 구현과 실제 화면 수락은 미완료.

## 문제와 원본 근거

사용자는 전체 위성 표시에서도 위성이 시간에 따라 공전하기를 원한다. 현재 전체 ON은 `workspace_orbit.js`의 `setWorkspaceWallScope()`에서 `catalogScenePanel.requestUtc()`를 읽어 `catalogScene.load(utc)`를 한 번 호출한다. `catalog_scene.js`는 검증된 위치 스냅샷의 소유자이며 재생 시계를 소유하지 않는다. 현재 연속 갱신은 준비된 `catalogTimeline`의 선택 위성과 장면 group이 같고 `followsTimeline()`이 참일 때에만 `observe(t.utc)`로 연결된다. 따라서 선택 위성이 없는 새 전체 장면은 정지된 스냅샷이다.

읽기 전용 선배 기준 저장소의 커밋 `1a1e00297a0301637455b0ef2cf48b2e74576b07`에서 `user_application/web/scripts/orbit/clock.js`의 `OrbitClock`은 처음부터 live/running이고, `tabs/orbit.js`의 `initOrbit()` 및 1초 tick은 선택 위성과 무관하게 `clock.now()`를 `GlobeController.update(date)`에 전달한다. `digital_twin/visualization/globe.js`의 `update()`는 `shouldAnimate=false`를 유지하면서 전체 records의 `positionAt(id,date)`를 계산하여 entity 위치를 갱신한다. 관측소는 전체 위치 갱신의 선행조건이 아니다. 현재 native `communication/http/catalog_geometry.py`의 `CatalogSceneRequest`와 `user_application/catalog_geometry.py`의 `scene()`도 관측소 없이 전체 GP를 Rust로 계산한다. 그러므로 선택 위성의 관측용 601개 샘플만이 전체 재생의 유일한 안전 경로라는 가정은 잘못이다.

## 결정 범위

기존 카탈로그 장면 계산과 기존 시간원천을 조립 지점에서 연결한다. 새 시계, 현재 상태 저장소, 전파식, GP 회전 효과, 타이머 또는 서버 API를 만들지 않는다. 장면은 기존 `configure/load/observe/clear/destroy`와 전체 검증을 유지한다.

시간원천 후보는 기존의 다음 세 경로뿐이다.

1. 실제 GP와 관측 조건을 준비한 `catalog_timeline.js`의 UTC. 기존 같은-group follow 경로를 보존한다.
2. 실제 저장 입력이 선택된 서버 orbit cursor. `orbit_selection.js`가 수락한 state와 `workspace_playback.js`의 기존 callback UTC를 사용한다. callback UTC는 `orbit_playback.js::projectUtc()`가 받은 서버 UTC, 수신 시각, 배속으로 투영한 것이다. 장면 계산에는 저장 위성의 지상국 고도각이나 위치 샘플 버퍼가 필요하지 않다. 원천 오류나 미확인 state에서 UTC를 추정하지 않는다.
3. 실제로 연결된 scenario/SIM follow의 표시 UTC. 기존 `workspace_orbit.js`의 `bindScenarioRuntime()` 및 scenario `displayProjection()`이 검증한 run, sequence, receipt와 UTC만 사용한다. merely `bootstrap`의 runtime 값이나 화면의 SIM 예시 문자열을 재생 권한으로 사용하지 않는다.

새 `scene:` 식별자를 저장 궤도 또는 선택 GP 권한으로 변환하지 않는다. 시간원천의 input/run/revision 및 장면 전체 GP의 group/query/orbit/scene hash는 서로 다른 식별 계약이다. 현재 승인, 임무, 통신/RF 계산의 source identity는 그대로 유지한다. 시간원천 UTC에 위치를 계산했다는 사실은 장면 위성이 그 시간원천 위성과 같다는 뜻이 아니다.

## 초기 ON과 명시 제어

초기 ON은 이미 명시적으로 연결되어 있거나 실제 서버가 수락하여 복원한 기존 원천만 사용한다. 우선순위는 실제 연결된 SIM/scenario follow, 같은-group의 유효한 선택 catalogue follow, 명시 follow가 없을 때 실제 선택된 저장 서버 cursor 순이다. 표시에서 실제 시간원천을 구분한다. 첫 위성, 첫 지상국 또는 임의 runtime을 자동 선택하지 않는다. 이 우선순위는 시간원천 연결에만 적용하며 GP나 runtime의 선택 상태를 변경하지 않는다.

원천이 있으면 최초 요청은 그 원천의 현재 canonical UTC를 사용한다. paused 원천이면 한 번 계산하고 정지 상태를 유지한다. 원천이 없으면 기존 `catalogScenePanel.requestUtc()`의 명시 초안으로 한 번 계산하되 ‘장면 스냅샷 / 진행 시간원천 미준비’를 표시한다. 현재 시각이나 다음 UTC를 따로 생성하지 않는다. 전체 ON/OFF는 server play, seek, SIM start/reset을 호출하지 않는다.

벽면 화면은 합의된 3D/2D와 전체 ON/OFF만 유지한다. 시간원천 준비, 현재시각 이동, 재생, 정지, 배속은 기존 위성 화면의 명시 제어를 사용한다. 장면이 `scene:`로 표시되고 있어도 해당 제어가 실제 연결된 기존 시간원천에만 위임되도록 조립 계약을 검토한다. 원천이 없으면 준비되지 않았다고 안내한다. 임의 위성/관측소를 선정하거나 `running=false`를 합성하여 제어를 통과시키지 않는다.

## 수명과 검증

연결은 전체 표시가 활성화된 동안의 좁은 조립 scope이다. 단일 선택된 원천과 장면 조건을 함께 확인하며 별도의 시간 이력이나 현재 UTC를 소유하지 않는다. 기존 원천 callback에서 얻은 UTC만 기존 `observe()`에 전달한다.

- 원천의 선택/input hash, revision, run, control entry, follow 연결, error/stale/폐기 또는 장면 조건이 바뀌면 이전 연결을 즉시 취소한다. 같은 UTC나 같은 문자열로 돌아와도 이전 연결은 부활하지 않는다.
- 전체 ON이 유지되면 새 실제 owner 응답의 수락/제어 종료 이후 새 scope를 만들 수 있다. pending 동안 이전 권한을 유지하거나 전환 후 늦은 callback을 적용하지 않는다.
- 원천 callback 및 조립의 외부 조회 전후에 실제 owner currentness와 scope를 검사하고 마지막 callback 이후 내부 generation/active/dead guard를 검사한다. 등록된 조회/proof 포트는 관측 계약이며, 알리지 않은 다른 owner 상태를 변경하는 임의 getter까지 증명한다고 주장하지 않는다.
- canonical UTC와 기존 LEAP 계약을 확인한다. 시간원천의 EOP/GP hash를 전체 장면 GP/EOP hash 대신 사용하지 않는다. 장면 요청/응답의 원래 전체 GP/EOP/LEAP/profile 검증이 최종 위치 권한이다.
- 기존 scenario receipt 유효기간과 run/sequence guard를 유지한다. stale 상태에서 마지막 위치를 진행 중이라고 표시하지 않는다.
- OFF/clear/destroy는 연결 해제와 기존 장면의 `clear()`/`destroy()`를 통해 예약 요청과 진행 중 요청의 generation을 무효화한다. 서버 원천은 정지하거나 삭제하지 않는다.
- 기존 `catalog_scene.js`의 1초 최소 시작 간격, 단일 진행 요청, 최신 desired UTC 및 전체 GP hash 충돌 실패를 그대로 사용한다. 프레임마다 새 HTTP를 시작하거나 느린 요청을 매 프레임 취소하지 않는다.
- scene 계산 실패 또는 GP hash409 충돌은 terminal이다. 원천의 다음 tick으로 자동 재시도하지 않으며, 사용자의 기존 전체 조회/ON 재시도와 실제 새 조건 확인 후에만 다시 준비한다.

저장 cursor의 기존 5초 state 관측은 로컬 playing일 때만 조회한다. 다른 기기의 paused→play를 발견하는 T192 결함은 아래 구현 필수 보강의 회귀와 기존 조회 수정 범위에 포함한다. BroadcastChannel 초안은 서버 권한이 아니며 다른 기기의 동기화 근거도 아니다.

## 독립 검토에 따른 구현 필수 보강

현재 `workspace_globe.js::paint()`의 scenario 분기는 `setCatalogScene(null)`을 무조건 호출하고, `renderSnapshot()`도 scenarioContext가 있으면 scene을 null로 반환한다. UTC callback만 연결하면 SIM 원천의 native 전체 장면이 여전히 보이지 않는다. 기존 검증을 우회하지 않으면서 다음 좁은 표시 포트를 함께 설계·구현해야 한다.

`catalog_scene.js`가 이미 수락한 full scene과 요청 당시 실제 시간원천 scope를 묶는 등록된 읽기 전용 표시 증거를 조립한다. 새로운 현재 상태나 시간 이력은 만들지 않고 기존 scene snapshot과 취소 epoch의 표시 권한만 관리한다. native 응답 UTC는 실제 원천에서 캡처한 요청 analysis UTC와 같아야 하며 모든 fullhash/source 검증을 유지한다. 원천이 자연 진행하는 동안 1초 조회의 마지막 수락 snapshot을 표시할 수 있으나 snapshot analysis UTC와 현재 display UTC를 따로 명시한다. 이전 위치를 현재 UTC로 재태깅하거나 좌표를 합성하지 않는다. paused/exact 원천에는 기존 exact UTC 일치를 요구한다. 입력/run/revision/control/source/stale 변경은 즉시 표시 증거를 폐기한다.

globe scenario 분기는 이 등록된 증거를 검증한 전체 scene만 허용하고 일반 또는 외국 scene은 계속 숨긴다. replica의 `renderSnapshot/verifyRenderSnapshot`에도 동일한 좁은 증거와 마지막 owner 검증을 연결한다. SIM의 display identity, GMST/engineering quality와 실제 run/sequence는 유지하며 scene의 native ITRF/EOP/hash는 별도 분석 자료로 표시한다. 이를 통해 SIM을 제외하는 우회 없이 원본 전체 움직임을 연결한다.

또한 `nodes/clock_controls.js::owner()`는 현재 `scene:`를 거부한다. 기존 위성 시간 제어가 whole-only 화면에서도 실제 연결 원천을 대상으로 동작하려면 optional 실제 source resolver가 필요하다. resolver는 등록된 현재 binding의 원천 증거를 반환하며 control entry 전후와 settlement까지 실제 owner currentness를 확인한다. 기존 stored/catalog/scenario control 함수에만 위임하고 scene identity를 원천 identity로 바꾸지 않는다. resolver가 없는 기존 호출자는 기존 동작을 보존한다. 이 포트는 wall에 새 시간 폼을 추가하지 않는다.

정지한 다른 기기가 원격 재생을 발견하지 못하는 기존 5초 GET의 paused-skip은 단순 설명으로 남길 수 없다. T192/T193 조립 회귀에서 반드시 재현하고 기존 조회 생명주기 내의 bounded server-state 관측으로 해소해야 한다. 새 시간 owner나 서버 명령을 만들지 않으며 hidden/destroy cleanup, busy/queued/revision 검증과 초안 보존을 유지한다. 이 prerequisite가 해결되지 않은 상태에서는 다중 기기 재생 동기화를 수락하지 않는다.

## 미해결 원본 동등성

이 결정은 기존 authoritative 시간원천을 재사용하는 station-free 전체 장면 연결이다. 원본의 선택 독립적인 wall-current live 시계를 완전히 복원하는 결정은 아니다. 기존 저장 cursor가 과거 UTC에서 진행할 수 있으므로 1× 진행을 ‘현재 실측’ 또는 실제 현재 UTC로 표현하면 안 된다. 원천이 전혀 없는 fresh startup의 독립 live 정책과 기존 서버 cursor를 현재 UTC로 맞추는 명시 제어 정책은 독립 검토에서 확정해야 한다. 이 부분을 숨긴 새 시계나 자동 서버 명령으로 채우지 않는다.

## 회귀 및 수락

구현 전에 실제 기존 stored/scenario/catalog owner를 사용한 회귀시험으로 연결 누락을 재현한다. 관측소·선택 catalogue 위성이 없어도 valid stored cursor의 UTC가 전체 native scene 요청에 전달되는지, 정지/재생과 원천 변경·실패·늦은 응답이 정확히 처리되는지 확인한다. 원천 없는 fresh ON의 한 번 스냅샷, OFF 뒤 요청 취소, 전체 행/hash409 실패, 기존 catalogue 같은-group 및 601 관측 경로, no server command를 확인한다. 단위/조립 시험은 실제 모션이나 GPU 수락이 아니며 두 화면에서 위치 변화와 표시 UTC/출처를 별도로 검증한다. 전체 이식과 미해결 live 정책은 열린 상태다.

## 2026-10-07 원본 선택 독립 live 정책 확정 (위 미해결 정책 대체)

사용자 전체 이식 목표에 따라 fresh 전체 카탈로그 ON은 pinned 원본 `orbit/clock.js`의 `OrbitClock`을 바이트 그대로 재사용한 단 하나의 workspace catalogue owner를 사용한다. renderer마다 시계를 만들지 않는다. 원본 클래스 외부의 조립 epoch와 lifecycle만 추가한다. 이 분석 cursor는 서버 runtime이나 현재 궤도 상태가 아니며, 실제 현재 UTC에 대한 native GP 계산 요청의 시간 출처다. 위치 UTC는 원래 응답 analysis UTC 그대로 유지한다.

원천 우선순위는 명시 SIM/scenario follow, 명시 same-group catalogue follow, 사용자가 실제 저장 입력 명령을 선택한 경우의 stored cursor, 그 밖의 `catalogue_live`다. 서버 저장 상태를 GET으로 복원한 사실만으로 fresh live를 과거 paused cursor로 바꾸지 않는다. 외국 그룹/실패한 명시 follow는 live로 우회하지 않고 failclosed한다. `catalogue_live` context는 `catalogue_live:<owner-generation>` key, 기존 LEAP canonical UTC, null EOP sourcehash를 가진다. native 장면은 독립 IERS-A/EOP hash와 전체 GP hash를 검증한다.

whole ON 동안에만 기존 `catalog_scene`의 단일 scheduling timer가 optional `readUtc` callback을 통해 기존 owner cursor를 읽는다. 선택과 관측소가 없어도 1초 최소 시작 간격/단일 HTTP/최신 desired UTC를 유지한다. OFF/leave/destroy/error는 timer와 native pending 권한을 취소하며 자동 서버 명령, renderer timer 또는 두 번째 query lane을 추가하지 않는다. pause/play/speed/step/live는 같은 original cursor에만 위임하고 command entry에서 표시 lease를 취소한 뒤 새 native 응답으로만 재등록한다. old lease는 복원하지 않는다.

기존 저장 계산 IERS-B와 catalogue IERS-A는 별개다. 현재 catalogue snapshot의 예측 범위는 별도로 검증하며 범위 밖에는 native 실패/terminal 정책을 유지한다. EOP clamping, 가짜 날짜, GP epoch 치환, EOP 파일 자동갱신은 금지한다. 원본 live 수용에는 관측소/선택 없이 두 display의 실제 UTC와 위치가 진행하고 pause/resume/OFF가 일치하는 브라우저 증거가 필요하다.
