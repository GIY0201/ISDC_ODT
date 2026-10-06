# 240개 노드의 현재 화면 성능 검증

2026-10-07. T076의 다중 노드 표시 검증이며 T032의 단일 위성·지상국
프로토콜을 대체하지 않는다. 결과는 아직 성능 목표 미달이다.

## 실제 구성과 보존 범위

기존 실행은 RUN-904CE008D00B, 배치 revision6, 40개 노드, 정지 T884.681이다.
별도 localhost:8891 검증 origin에서 원래 초안이 없는 것을 확인하고 실제 편대
UI로 192개와 48개를 추가했다. 공유 정의 표시의 초안은 고유 ID240개이고 수락
배치는0개다. 이 검증은 서버 배치·실행·저장 GP를 변경하지 않는다.

1280×720, DPR1, Chrome154, RTX5070/D3D11, 단일 Cesium canvas이다.
native Kepler+J2 계산 완료 후 모델, 궤적, OISL 표시를 모두 유지했다.
현재 renderer의 GLB 제한은64이며 240개 GLB 표시로 주장하지 않는다.
동일 TERRA epoch 2026-10-06T07:11:41.280576000Z, 동일 NODE-0193 선택과
공용 뷰 정렬 후 실제 카메라 drag6회를 각 측정에서 수행했다.
다른 기존 브라우저 화면과 Aside 검증은 활성 상태였으며 유휴 PC 측정은 아니다.

## 첫 비교 결과

| 범위 | 수정 전 | static native 경로 적용 후 |
|---|---:|---:|
| 완료된 trial 길이 | 30.113883s | 30.077254s |
| 실제 renderer presentation 간격 수 |429|568|
| presentation p95 |109.556ms|91.178ms|
| presentation p99 |128.396ms|108.565ms|
| presentation 최대 |418.354ms|180.475ms|
| foreground RAF p95 |109.6ms|91.1ms|
| 목표16.7ms |미달|미달|

Chrome ReturnAsStream을 EOF까지 읽고 닫았다. 두 tracingComplete 이벤트의
dataLossOccurred=false이며 동일 trial renderer PID40204를 확인했다.
전체 JSON 길이는 각각239677193/111484008 bytes다. 기존
orbit_trace_measurement.mjs의 동일 renderer와 완료 mark 사이의
AnimationFrame::Presentation 간격 계산법으로 분석했다. 물리 모니터 scanout을
증명하지 않는다.

두 원본 stream과 화면 recorder는 현재 CUA 검증 세션 메모리에 보존되어 있고
아직 독립 파일로 내보내지 않았다. 이 문서는 도구 출력의 수치 기록이며 원본
파일 재분석 가능한 최종 성능 증명은 아니다. 각 조건1회만 측정했으므로 조건별
3회, 1920×1080, 연속 foreground 증명과 독립 원본 파일 수집이 남는다.
입력 feedback 집계에는 trial 이전 편대 생성이 섞여 있어 trial 전용 p95로
사용하지 않는다. UTC100개/24시간 질의20개 성능도 이 결과로 닫지 않는다.

## 구현 변경

기존 NodeScene은 검증된121개 좌표가 바뀌지 않아도 nonconstant
CallbackProperty를 사용했다. Cesium1.143의 PolylineGeometryUpdater는 이런
positions를 매 프레임 복사한다. 동일 native revision의 경로는 staticpositions로
전달하고 검증된 revision 교체 또는 실패 시에만 좌표를 갱신했다. 좌표 수,
오류 시 비표시, 모델 제한, 선택과 표시 설정은 그대로다. 관련49개 시험과 전체
브라우저1111개 시험이 통과했으며 실제 측정은 위처럼 개선됐지만 여전히 미달이다.

근거: [Cesium 공식 PolylineGeometryUpdater](https://raw.githubusercontent.com/CesiumGS/cesium/1.143/packages/engine/Source/DataSources/PolylineGeometryUpdater.js).
이 변경이 전체 병목의 유일한 원인이라는 주장은 하지 않는다. 남은 per-frame
native pose·모델·링크 갱신 비용과 실제 추적 결과를 계속 조사한다.

## 05:58 추가 프레임 비용 점검

단일 프레임 내 좌표 캐시 적중 시 중복 외부 context 조회를 제거하고,
syncFrame에서 OISL endpoint를 두 번 배치하던 것을 한 번으로 줄였다.
프레임 간 캐시는 도입하지 않았다. callback 전후와 최종 경계의 기존
UTC/정의/morph/Viewer 검증은 유지한다. 관련51개 회귀시험이 통과했다.

별도 localhost:8891의 기존240개 초안을 다시 열어 같은 표시 UTC
2026-10-06T07:11:41.280576000Z와 NODE-0193을 사용했다. 카탈로그 재조회로
TERRA GP epoch가 14:00:37.897344000Z로 갱신됐으며 대전 관측 조건을
명시적으로 적용했다. 따라서 이전 조건과 완전히 동일한 비교는 아니다.
초안240/수락0, 공유 서버 원본 배치6/40,1280×720/DPR1/one canvas는 유지했다.

첫30초 RAF 구간은677개,p95 72.9ms,p99 91.4ms,max838.8ms였다.
초기 계산 지연이 포함될 수 있다. 두 번째 구간은 recorder의 누적1353개에서
첫677개를 제외한676개이며,p95 72.4ms,p99 91.3ms,max565.7ms다.
두 번째 시작223414.5ms/끝253431.8ms,숨김 표본0이나 CPU Profiler가
함께 실행돼 독립 최종 성능 수락 증거로 사용할 수 없다.

Profiler24.385052초/14700표본에서는 node_timeline.valid와
NodeScene.geometryAt의 반복 검증 비용이 크게 관측됐다.
다음 변경은 원본 native buffer가 이미 불변으로 준비한 row의 검증을
소유자 경계 안에서 재사용하는 좁은 최적화로 검토한다. mutable 입력과
보간 row, 새 buffer/generation/실패/폐기 경계는 계속 검증해야 한다.
두 recorder 원문과 profile은 CUA 메모리에만 보존돼 독립 파일 증거가
아직 없다.16.7ms 목표와 전체 T076/T032 수락은 계속 미완료다.

## 불변 native 표본 검증 메모 후 측정

깊이 고정된 prepared buffer 표본은 최초 전체 검증 결과를 같은 buffer의
WeakMap 안에서만 재사용한다. 사본 반환과 mutable/보간 row의 전체 검증,
교체/retry/폐기 경계는 유지한다. 관련80개 회귀시험을 통과했다.
같은240초안/표시UTC/대전/1280×720에서 새로 reload한 recorder의
30.0229초 구간(시작89871.5ms,끝119894.4ms)은691개 RAF 표본,
p95 72.9ms,p99 90.9ms,max145.5ms였다. CPU Profiler는 실행하지 않았고
숨김 표본은0이다. p95 추가 개선은 관측되지 않았으며 여전히 목표 미달이다.
전체 feedback/eventTiming 집계에는 시각 적용/준비 동작이 포함돼 입력
최종 성능으로 사용하지 않는다. 원문은 CUA 메모리에 보존하고 있다.

## 2026-10-07 06:24 registered readonly projection live diagnostic

Same localhost240draft origin,1280x720/DPR1/NVIDIA5070,models/path/OISL enabled and existing64-model profile,0accepted validation nodes. Reload retained240definitions and same selected GPU240-B-A1; independent catalogTERRA and UTC2026-10-06T07:11:41.280576000Z/DAEJEON reapplied withoutSIMcommands. Current reload cataloglist GPepoch07:11 differs from preceding refreshed14:00, so do not claim identical GPinput comparison.

First30.0083s foreground RAF trial1504samples p9536.4/p9954.8/max127.6ms,hidden0. Second30.003s1634samples p9519.4/p9919.6/max19.8ms includesCPUprofiling; aggregate3138p9519.4 is cumulative, not independenttrialresult. Both miss16.7ms and neither proves sustainedGPU presentation. Rawrecorder/CPUprofile remainsCUApersistentmemoryonly; no standalone rawfile acceptance. Firsttrial has pausedview and sparsezoomoutsideitsmeasurement, so sustainedinteractioncriterion remainsopen.

31.75298s CPU18724samples: idle6933; frameCurrent1414+388; CesiumOet1104; geometryAt829+203; structuredClone626+335+190; displayGeometryAt260; CesiumwriteUpdate243; GC214. No capturedconsoleerrors. Independent catalogPlay then advancedUTC but subsequentmeasure-start andtwoPauseattempts failedCDP responsiveness. Same temporarytab reloaded successfully after retries, preserving240localdrafts. Originalserver40/SIMrun untouched. Continuousadvancing performance FAILED/unmeasured; readonlypacket miss still fullgeometryFor clones/freezes, targetedrepair authorized. Fullgoal remainsactive.

### Advancing sampler and cheap transition follow-up

FullNode1161PASS6414.7817ms; backend fullPython965PASS1PillowSKIP223.97s. Pure owner-native display sampling removes repeated full-definition copies, preserves generic sampler parity under independent112focusedreview. Cheap authoritative globe transition query removes cloned UI-state reads withoutchangingframefences. Validation-only explicit rawJSONdownload has6focusedPASS, including retainedoutliers/incompletetrials and delayedURLrelease. No live downloadedrawartifact yet.

Same240freshreload/UTCrestore/calculate passed. Firstfill temporarilyduplicatedUTC; DOMinspection correctedexplicitform, nohiddenstatechange. IndependentcatalogPlay again advanced thenmeasurestarttimedout. CPU17.668868s nowdominantmany constellation.get drafts line184 (separate stacks128/127/118/117/100/99/94/etc), serveCommunication node_timeline391=93,program571,GC148. RoottwoPauseattemptstimedout; sametabreloadrecovered. This remainsFAILED/unmeasuredcontinuousperformance and indicates repeated wholecohort drafts copying in communication update, to inspect next. No serverrestart/runtimecommand/newbranch/checkboxclosure.

## First standalone recorder artifact

Explicit visible rawdownload created C:/Users/gwakinyong/Downloads/isdc_browser_measurements.json,51295bytes, SHA25696b0090924e5a420245c35ac7aad391273c57876e75d4d33936e22656750c707. IAB waitForEvent download timedout despite successful filesystemsave; readonlyfilesysteminspection confirmed payload instead ofretryingdownload. Copied originalbytes to data/workspace/validation/t076_240_paused_raw_0636.json. Independentfileparse matches live1513foregroundRAF p9536.3/p9954.8/max128ms,hidden0,1280x720/DPR1/NVIDIA5070,30.0173s firstpausedtrial. This covers rawrecorderretention, notGPU presentation/sustainedinteraction orfullthree-trial/two-resolution acceptance. Original16.7targetfails.

## 2026-10-07 06:50 advancing failure and data input race checkpoint

Latest actual240 advancing trial30.3008s102foregroundRAF p95401.7/p99474.1/max695ms FAILS original16.7target. Zoom inspection, twoPauseattempts and rawdownload failed before click; originalraw remainsCUAmemoryonly. Same temporarytab reload recovered; no server/runtime/SIMcommand. Fresh21.28122sCPU locates communicationStateFor→geometryFor/serveCommunication plus repeated satellite_nodes.context/wholecohortcopies from BOTH globe display andcatalognotification. Diagnosticprofile stopped/disabled; not acceptance evidence. Targetedownerbatch and duplicate refresh investigation continue without loweringcriteria.

## Combined exact communication batch and catalog notification live trial

After fullNode1187PASS, the same240-local-draft origin was reloaded. TERRA25994 currentGPepoch14:00:37.897344, explicitdisplayUTC07:11:41.280576, DAEJEON, selectedNODE0193 and existingmodel64 profile retained. BeforePlay selectednode showed allfour OISLterminals tracking at the exact native UTC; thus accepted histories existed and repeatedinitialpriming is not established as this trial's cause. No SIM/runtime command.

Recorder started128992.1ms; Play129633.7ms; completion159246.5ms.30.2544s129foregroundRAF p95309.3ms,p99347.2ms,max601.7ms. Native preparation complete before measurement. No fullsuite/CPUProfiler during trial. Requestedzoomclick failed beforedispatch. Raw remainsCUApersistentmemory only. This fails16.7ms and input-responsiveness acceptance; comparing previous401.7ms to309.3ms is diagnostic only, not fullmatched three-trial/two-resolution/GPU acceptance. FreshposttrialCPU investigation started separately. Fullrequirements remainopen.

### Advancing raw-file retention and stop recovery

Two mouse Pause attempts timedout on Input.dispatchMouseEvent and readonlyinspection confirmed stillplaying. Samebutton keyboardEnter successfullypaused; noreload/server/runtimeaction. KeyboardEnter on explicit rawdownload saved51318bytes at Downloads/isdc_browser_measurements (1).json, independentlyparsed same129RAF/p95309.3ms and copiedunchanged into data/workspace/validation/t076_240_advancing_raw_0655.json. SHA256b91b7e4938c05abf16df0210175523d0ee90cbf1a097570fbe17f90090b15133. This supersedes memory-only retention for the combined advancing trial, but doesnotclose failed frame/input orGPUcriteria. CPUdiagnostic aftertrial49.451558s stopped/disabled; hottestcohortcopy paths through satellite_nodes.canFocus invoked bysolar scenecontrols andopticalcontext. Optional trustedstore-cohort token and geometry-only focus query are underRED/fix; no unstatedsuccess.

## 2026-10-07 trusted-scope/focus actual advancing trial (raw label0702)

Latest committed7c585f3 JS/fullNode1193PASS atsame240localdraft/0accepted/1280x720/NVIDIA5070/models64/path/OISL origin; nofulltests/profiler during trial. CurrentTERRA14:00GP, explicitdisplay07:11:41.280576/DAEJEON retained. NativepreparationreadybeforePlay. Recorder49404.5→79406.3ms30.0018s;Play49640.9ms; actualzoom70825.6ms clicked successfully.237foregroundRAF p95164.6/p99200.3/max310ms stillFAIL16.7ms. Whole-page6feedbackp95344.7/EventTimingp95328ms includes preparation events, not isolated sustained-input gate. KeyboardPause worked and rawdownload saved. No server/runtime/SIMcommand. This is improved actual responsiveness, not completeperformance/GPU/two-resolution/three-trial acceptance.

Raw bytes46183/SHA67c64e1be00f16a8dc39815313133d051006dcfdb8eeab618d6d365dfc8cc154 independentlyverified and copied unchanged to data/workspace/validation/t076_240_scope_advancing_raw_0702.json. Private minimal shared-context presentation port isunderREDimplementation, not included in this measuredcommit. All-model liveGPU andT079matrix continueonexistingAsidehandle; fullT075-T084 remainsactive.

### 2026-10-07 07:17 complete JavaScript checkpoint

FullNode1207PASS/0FAIL/0SKIP11503.8273ms (full_migration_node_0720.log) covers complete private node context, trusted network scope/presentation wiring, and private definition canonicalization. Independent owner/wiring/context/canonical reviews found no blocker. Public full receipts, original calculations, fresh station/fault/runtime/UTC guards and generic fallback remain intact. Backend unchanged after fullPython965PASS/1PillowSKIP223.97s. New actual240 replay measurement pending; prior164.6ms failure remains authoritative. Aside53586 confirmed live with22uniqueGPU captures in progress; static56options/50asset scope is not full GPU acceptance. FullT075-T084 stays active.

## 2026-10-07 07:19 private context actual advancing measurement

Committed bf9bf9d / fullNode1207PASS; same isolated localhost240draft/0accepted,1280x720/DPR1/NVIDIA5070/models64/path/OISL, TERRA25994 GPepoch14:00:37.897344 and explicit startUTC07:11:41.280576/DAEJEON. Native ready and selected NODE0193 four optical tracking terminals verified before Play. Recorder64278→94352.2ms (30.0742s), Play64517.4ms; actual node zoom79369.4ms succeeded. 331 foreground RAF intervals p95109.5/p99180/max252ms: FAIL original16.7ms criterion. Wholepage feedback6p95498.6/EventTiming6p95336ms includes preparation, not isolated sustained-input acceptance. KeyboardPause/download worked, original SIM/runtime/accepted roster unchanged. Raw44103bytes/SHAa50b18760336b63c07e1d40cffd234b42b46769c526305dcfbd391ac81678a29 independently copied unchanged to data/workspace/validation/t076_240_context_advancing_raw_0719.json. Other Aside GPU validation may coexist; diagnostic comparative trial, not final isolated protocol.

After measurement, separate CPU profile43.415455s stopped/disabled: drafts3893, opticalempty1472, UTCparse1367,serveCommunication1288,opticalordered1048, satellite_nodesrefresh753. Parent inspection locates drafts in panel scenecontrol/context/list and communication metadata refresh; optical snapshot fullcohort pending copies called twice per panel. Next bounded changes assigned to existing parallel agents with separate file ownership. No throttling, removed nodes, lowered criteria or action receipt shortcuts.
