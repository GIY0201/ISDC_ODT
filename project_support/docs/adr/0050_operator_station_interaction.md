# 운영 지상국의 공용 지구 선택과 초점

상태: N017c–e 구현 전 설계. 전체 N017 미래 통과와 OISL 경로는 미완료다.
기준 원본 communication.js 293, 890–891행은 지상국 단일 클릭 선택,
더블클릭 선택 및 flyTo 높이 2400000m/duration 1.4s를 제공한다.

현재 공용 OrbitGlobe의 하나인 ScreenSpaceEventHandler를 확장한다.
별도 Viewer, 입력 handler, 시계 또는 현재 station store를 만들지 않는다.
GP 기준 지점과 편집 가능한 운영 지상국은 서로 다른 소유자이다.

NativeNetworkScene에 stationPick(picked), captureStationPick(id),
verifyStationPick(value)를 추가한다.
stationPick은 실제 owned entry.entity/coverage와 동일한 picked.id만 허용한다.
properties.stationId의 값만 같은 외부 객체는 거부한다. 현재 렌더러와
Viewer, 표시된 entity, enabled station 정의, exact 또는 등록된 sampled
display의 현재 소유권이 유효해야 한다. 반환 {id,station}은 깊이 동결하고
private WeakMap에 등록한다. verify는 동일 값의 등록과 같은 entry/entity,
station 정의, renderer/Viewer 및 현재 표시 소유권을 재확인한다. 이 포트는
정적인 지상국 UI 선택만 허용하며 native/fabric/mission 승인이 아니다.
화면 이탈, clear, invalid scope, morph 및 dispose는 선택 권한을 철회한다.
기존 stationAt(screenPosition)은 실제 scene.pick 뒤 이 포트로 검증한다.
명시적 버튼은 captureStationPick(id)에서 같은 owner 검증을 거쳐 등록 값을
받는다. 호출자는 renderer 내부 entity를 읽거나 pick 객체를 합성하지 않는다.
같은 entry/정의/Viewer의 유효한 일반 redraw는 token을 유지할 수 있지만
실제 clear/hidden/invalid 및 정의 교체의 권한 철회 후에는 복구하지 않는다.

OrbitGlobe.setGroundNetworkInteraction({read,verify,onSelect,onFocus})와
workspace_globe.bindGroundNetworkInteraction을 scoped optional binding으로
추가한다. read는 실제 pick을 소유자에 전달하고 verify는 반환 등록 값을
검증한다. 콜백 전후 binding/Viewer/disposal/morph 및 최종 verify를 확인한다.
운영 station 후보가 거부되면 다른 GP/node/catalog 선택으로 넘기지 않는다.
후보는 picked.id.properties.stationId의 존재로 구분하되 이는 fallback 차단
신호일 뿐 승인 근거가 아니다. 후보가 아닌 null read는 기존 선택으로 넘긴다.
단일 클릭은 onSelect만, 더블클릭은 onSelect 후 재검증한 onFocus만 호출한다.
기존 node/catalog/reference 지상국 처리와 단일 handler 수명을 유지한다.

focusGroundNetworkStation(station,{verify})는 같은 카메라 소유자에서만
실행한다. 유한 경위도/범위 및 콜백 전후 verify를 확인하고 model tracking을
해제한 뒤 원본 높이/duration의 flyTo를 실행하며 requestRender를 요청한다.
단일 클릭은 카메라나 공용 UTC/GP 선택을 바꾸지 않는다.

workspace_nodes는 ground active 상태, 실제 renderer 등록 값과 조립 지점의
운영 station 정의 일치 및 externalPending을 함께 확인한다. 네트워크 입력
포트에 selectStation(id), stationInteractionReady()를 주입하고 기존 sourceGround
store.select를 사용한다. 패널 focusStation 버튼과 3D 클릭은 같은 경계를 쓴다.
동일 station 목록에서 selectedId만 바뀐 store 알림은 입력 변경이 아니므로
native 분석을 정리하지 않는다. 실제 정의 변경은 이전처럼 정리한다.
패널의 다른 창 편집 충돌 및 화면 종료는 선택/초점을 막는다.

RED 시험은 actual owned entity와 coverage, fake/removed/changed/hidden station,
old binding/Viewer/중첩 callback/clear/dispose, morph, selection-only no-fly,
double-click와 명시 버튼의 원본 camera 값, GP/UTC/runtime 입력 보존,
기존 하나 handler와 새 binding 정리, 실제 workspace 조립 두 해상도를 다룬다.
전체 Node/Python 회귀와 실제8891 화면 확인 후에만 연결 수용을 판단한다.

ground 소비자의 활성 여부는 sampled 결과 사용 가능 여부와 다르다. 현재
표시 UTC와 같고 실제 owner가 검증한 exact snapshot을 먼저 표시하고 선택
증명에도 사용한다. exact가 없으면 등록된 sampled 증명을 확인하며, 둘 다
없으면 숨긴다. 숨김·검증 실패는 기존 token epoch를 철회하고 다시 보이는
프레임이 이전 token을 되살리지 않는다. coverage toggle도 같은 규칙을 따른다.
