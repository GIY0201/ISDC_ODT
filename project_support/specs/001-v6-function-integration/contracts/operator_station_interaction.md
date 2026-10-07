# 운영 지상국 선택 UI 계약

ADR0050의 renderer stationPick/verifyStationPick은 registered deeply-frozen
{id,station}만 승인하며 actual owned visible entity/coverage와 current display
scope에 한정한다. 외부 properties ID, cloned token, stale definition/Viewer,
hidden/clear/morph/disposed scope는 거부한다. 통신/임무 승인에는 쓰지 않는다.
captureStationPick(id)는 같은 owner 내부 검증으로 명시 버튼에 새 등록 값을
제공한다. 호출자는 entity 내부를 읽거나 가짜 pick을 만들지 않는다.
유효한 unchanged entry/정의/Viewer redraw는 유지할 수 있지만 clear/hidden/
invalid/교체 후에는 token을 되살리지 않는다.

기존 공용 globe optional groundNetworkInteraction은 read(picked), verify(value),
onSelect(value), onFocus(value)를 받는다. binding/Viewer/currentness를 외부
콜백 전후 검증하며 native node/GP/reference 지상국 선택과 별도이다.
하나인 ScreenSpaceEventHandler에서 단일/더블클릭을 처리한다.
picked.id.properties.stationId의 존재는 운영 station 후보로만 사용한다.
후보의 read 실패는 fallback을 막고, 후보가 아닌 null은 기존 처리를 유지한다.

focusGroundNetworkStation(station,{verify})는 기존 camera owner의 명시 동작이며
모델 추적 해제 후 원본 높이2400000m/duration1.4s와 requestRender를 사용한다.
verify가 없거나 false이거나 callback이 소유권을 바꾸면 flyTo하지 않는다.

조립은 기존 sourceGround store에만 선택을 전달한다. actual station definition,
ground active와 external edit conflict를 검증한다. 선택만 바뀌면 native 분석
입력을 정리하지 않고, station 정의 변경은 정리한다. 별도 상태 store 없음.

활성 ground 소비자는 현재 UTC의 검증된 exact snapshot을 우선한다. sampled
소비자가 활성이라는 이유만으로 exact 지상국을 숨기지 않는다. exact가 없으면
등록된 sampled proof를 요구한다. 숨김/실패는 token을 영구 철회하고 유효한
같은 entry의 일반 redraw만 token을 유지한다.
