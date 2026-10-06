# T075–T077 원본과 현재 조립 대조

대조 원본은 읽기 전용 참조의 `1a1e00297a0301637455b0ef2cf48b2e74576b07`이다. 현재 제품은 `D:/projects/ISDC/isdc_odt_node_worktree`의 실제 파일과 call chain을 읽었다. 오래된 task 체크박스와 전체 시험 수를 기능 완료 근거로 사용하지 않았다. 이 감사는 정적 대조이며 새 실행·브라우저·서버·Git 조작을 하지 않았다.

## 실제 미이식 기능

| 묶음 | 원본 실제 함수/경로 | 현재 실제 차이 | 필요한 행동 |
|---|---|---|---|
| T075 관심 위성·정렬·SDC 필터 | tabs/orbit.js loadFavorites/updateFavorites/filterCatalog/bindControls; orbit/catalog_view.js selectCatalog; 관심 등록/관심만 보기, 이름/NORAD/궤도군/epoch 경과 정렬, 배치 노드만 SDC 표시 | 현재 tabs/catalog_workspace.js는 검색/궤도군/100개 페이지/선택만 제공. 전체 web/scripts에 favorite/data-catalog-sort 호출 없음. 노드는 별도 패널/레이어에 존재하지만 원본 SDC 필터와 관심 정책 연결은 없음 | 원본 순수 selectCatalog와 관심 저장 정책 재사용. 100개 현재 페이지 정렬을 전체 검색 결과 정렬로 오해하지 않도록 조회 범위 계약부터 연결. SDC는 기존 accepted node/renderer의 표시 사본으로 연결 |
| T075 레이블 표시 토글 | tabs/orbit.js data-globe-mode=labels → globe.toggleLabels | 현재 OrbitGlobe에 labels 토글 public port, globe_view 패널에 토글 없음. 카탈로그 레이블 collection 자체는 존재 | 기존 label collection show를 관리하는 명시적 표시 port/버튼 연결. Viewer 추가 금지 |
| T075 관측 선·동적 지상국 카드 | 원본 visualization/globe.js updateStationLink와 orbit.js renderStationCard/stationNextPass; 지상국 카드가 선택 위성 기하/다음 pass 표시 | 현재 station_workspace.js는 stationCardModel(site)로 정적 facts만 표시. 카탈로그 time/pass 패널은 계산을 제공하지만 선택 카드에 live/nextpass 인계 없음. OrbitGlobe.setGroundPoint는 점/레이블만 추가하고 관측 선은 없음 | 기존 precise catalog/ground results를 카드에 주입하고 현재 UTC와 일치할 때만 live facts 표시. 현재 ITRF 점→WGS84 지점 observer line은 기존 계산값만 렌더링 |
| T075 상세 궤도 정보 일부 | orbit/inspector.js renderElements/renderSource/renderPosition의 RAAN/argp/mean anomaly/mean motion과 분석 UTC–epoch 경과 | 현재 catalog_workspace.profileRows는 주기/경사/이심률/근원지점/캐시 당시 epoch 경과와 기본 SATCAT만 표시. 현재 UTC의 전체 궤도 요소·분석 epoch 경과와 전체 위치 inspector 출력은 연결하지 않음 | 이미 가진 raw GP 및 현재 native row를 출처·단위와 함께 표시. 캐시 epoch 경과를 현재 분석 경과로 재라벨링 금지 |
| T077 통신망 2D 연결도 | tabs/communication.js renderDiagram → digital_twin/visualization/network_diagram.js layoutNetwork/diagramMarkup | 현재 network_diagram.js 파일 자체 없음; ground_network.js는 링크 JSON/품질 표만 제공 | 원본 순수 SVG layout/markup을 검증된 network snapshot과 accepted fabric verdict 사본에 주입. 클릭 선택/상세 인계 추가 |
| T077 지상 링크·커버리지 3D | 원본 network_scene.js extends NodeScene, setGroundLinks/setGroundLinksVisible/setCoverageVisible; communication.js applyGroundLinks/coverageAltitudeKm와 tracks/links/ground/coverage/models controls | 현재 NodeScene는 원본 OISL/점/레이블/모델/궤적을 렌더링하지만 NetworkScene/ground links/coverage 파일·호출·public port 없음. fixed29개 지점 지도와 운용 station store도 별도 | 단일 Viewer/기존 native states에서 ground endpoint와 검증된 ground links를 렌더링. 지상국 모델의 원본 대표 커버리지 반경임을 표시하며 정밀 RF 검증으로 주장 금지 |
| T077 편집 지상국의 노드 전체 미래 passes | 원본 communication.js computePasses/renderPasses는 활성 station과 배치 노드 각각의 Kepler+J2 예측창을 합쳐 AOS/LOS/peak/duration/현재구간 표시 | 현재 source ground_network 패널은 현재 snapshot 계산만 제공. 기존 stored GP visibility와 selected catalog24h 패스는 다른 입력 범위. mission windows에는 native 노드 contact_reports 계산이 있으나 통신 panel 미래 pass 목록으로 연결 안 됨 | 기존 Native mission-window port를 재사용하여 활성 station·accepted nodes·현재 표시 UTC별 contact_reports를 통신창에 표시. 원본 browser node propagator를 새로 추가하지 않음 |
| T077 노드/지상국/링크 상세·경로 홉·개별 DTN 표시 | communication.js satelliteDetail/stationDetail/linkDetail/renderRoute/renderDtn; 선택 대상에서 route-from/to, 링크 RF 가정값 계산, route.hop_list 표, report.nodes custody/stored/generation/next_hop | 현재 ground_network.js는 snapshot 링크 JSON, accepted links 품질과 전체 DTN 요약, route.path/총지연/병목/신뢰도만 표시. 원본 대상별 상세 선택, 홉 표, 개별 노드 custody 표와 사용 대상 인계 없음 | 기존 snapshot/receipt/route 필드의 표·선택·RF 초안 인계를 먼저 구현. 계산식이나 module lifecycle은 재구현하지 않음 |

## 이미 구현됐으며 검증을 구분해야 하는 범위

### T075

`workspace_orbit.js`에서 createCatalogPanel → createCatalogGeometry → catalogTimeline → globe.catalog, createCatalogScene → globe.catalogScene와 같은 실제 call chain을 확인했다. createCatalogTrack/pass → globe.catalogTrack/pass table/AOS seek, catalog time의 관측 지점·높이·최소각, 2D/3D/BlueMarble/ArcGIS/OSM/NaturalEarth/밝음·어두움·강조 표시도 실제 조립되어 있다.

모델은 createSatelliteModelSelection → manifest/resolver → globe.setSatelliteModel → 기존 단일 Viewer의 SatelliteModelLayer로 연결되고 노드의 explicit model_key와 카탈로그의 ordered mapping이 구분된다. 모델 초점/현재 거리 추적/해제/재시도와 hover, 썸네일·credit·exact/series/representative 품질 문구가 구현되어 있다. 그러나 **50개 모두 실제 렌더링이 검증된 것과는 다르다**.

실제 현재 패키지 파일 수를 읽어 **56 mappings, 50 GLB, 50 JPG**를 확인했다. asset_receipt.json은 complete=false/render_status=unverified이고 `terra.glb`의 외부 `Side_Panels_TERRA.tga`, `solarpanels.tga` 2개 의존성 오류를 유지한다. GLB50개가 없어서 미이식된 것이 아니라 Terra의 faithful texture 해결과 전체50개의 실제 renderer/codec 검증이 남은 상태다. 같은 이름의 texture를 추정 생성해 원본으로 주장하면 안 된다.

태양/day-night는 `workspace_orbit.js createWorkspaceSolar` → existing displayContext → solarTimeline → `/api/solar/samples` → SolarDisplay renderer와 globe_view lighting toggle에 연결되어 있다. 원본 `globe_lighting.js`와 같은 localStorage key/event, 밝은 테마의 음영 해제 원칙을 유지하며 ERFA/EOP UTC 결과를 사용한다. 따라서 태양 자체를 '아직 구현 안 됨'으로 다시 나열하면 안 된다. 실제 재생·모드·테마·다른창·자료오류·공존 검증은 해당 코드 버전의 화면 증거로 확인해야 한다.

**대표 SVG 관련 정정:** pinned 원본 orbit.js renderShape는 GLB 매핑 및 JPG thumbnail을 사용한다. 원본 orbit/visualization 검색에서 위성 대표 SVG 구현을 확인하지 못했다. 실제 SVG 기능은 network_diagram, mission_timeline, settings topology이다. 과거 task의 '대표SVG' 표현을 근거로 새로운 위성 형상을 발명하지 않는다.

### T076

`workspace_orbit.js`는 createNodeLibrary/createWorkspaceNodes/NodeScene/NodeClockControls를 실제 조립하며 satellite/scene/composer에 같은 panel을 표시한다. `nodes/editor.js`, tabs/satellite_nodes.js와 constellation store에 다음 원본 명령이 존재한다.

- 추가, 편집·저장·취소, 복제, 삭제, 작업 세트 지우기, 선택, 뷰 정렬.
- 버스5종 flat_panel/comms_small/eo_smallsat/cubesat_3u/geo_relay, 3D model_key 선택.
- 궤도 epoch/고도/이심률/경사/RAAN/argp/mean anomaly, 발전W/버스W/배터리Wh, nominal/standby/safe.
- 장비9종 OISL표준/장거리/소형, Ka/X/S RF, camera, DTN, GNSS; 추가/삭제/활성/역할·상대 단말 선택과 검증.
- single/train/Walker delta/Walker star, 원본 formation sliders/planes/per_plane/phasing/RAAN spread/anomaly/bus/link_policy, generate/replace/remove/live debounce.
- 배치/회수/서버 조회/초안 재적용/초안 복원, dirty 및 다른 창 충돌/원격 구성 확인.
- 원본 statusFrame/fleet/terminal presentation; native 전력 순간 수지와 일조/실측 분리; OISL 포착/지향/진행률, 카메라/zoom/track/link/model/light 명령.

실제 배치 명령은 nodes/data_deployment → browser API → data-management/deployment → 기존 RuntimeState.apply_data_deployment → accepted scoped data module receipt 뒤에만 local deployed copy를 갱신한다. native node points/tracks/communication states → node timeline/optical → NodeScene bindNodeRenderer/preRender를 사용하며 새로운 시계/Viewer/브라우저 전파 계산을 만들지 않았다. 따라서 T076를 통째로 '미구현'으로 기록할 근거는 없다. 원본 모든 bus/equipment/formation/status/camera/수락/회수/오류/다중창을 실제 V6에서 종합 검증하는 것이 남는다.

### T077 계산·모듈 경로

`workspace_orbit.js sourceNetworkModel` → createNetworkSnapshotModel(library,oisl,groundLinks) → workspace_nodes networkInputs → nodes/network_timeline의 full nodes/stations/faults/current UTC signature와 native requestCommunicationStates/optical verified receipt → buildNetworkSnapshot. `ground_network.calculate`는 실제 SIM을 조회한 뒤 이 network.update를 호출한다.

`fabric_exchange.send`는 verified current snapshot에만 createDataFabricClient.guardedUpdate → POST/api/data-fabric/network → runtime/data_fabric/exchange → 선배 stand_in 모듈을 호출한다. module instance/sequence/request/network hash와 late-response/변경 입력 fencing이 존재한다. route는 accepted receipt와 같은 hash/sequence에만 guardedRoute를 호출한다. DTN 계산과 route 자체가 빠진 것이 아니라 위 표의 원본 상세 표시·diagram/3D ground rendering·미래 pass 인계가 빠졌다.

현재 광학 포착/상대 지향, ground RF representative parameters, 모의 경로와 DTN은 원본 공학적 SIM 모델이다. 실제 수신 장비·실제 광학/RF 링크 예산·패킷 전송·장비 HIL은 원본 기능 이식 완료와 별도로 미확인이다.

## 권고 실행 순서

1. 계산을 건드리지 않는 개별 DTN/route hop 표와 대상 상세 선택/RF 초안 인계를 먼저 연결한다. 이미 응답에 있는 필드를 현재 UI에 옮기는 작업이라 바로 검증할 수 있다.
2. 원본 pure network_diagram/layout를 재사용해 현재 verified snapshot으로 SVG 연결도를 연결한다. 고유 Viewer 추가와 물리 재계산은 필요 없다.
3. T075 원본 관심/정렬/SDC/labels와 정적 지상국 카드의 live/nextpass 인계를 각각 구분해서 연결한다. 전체 검색 결과와 현재100개 페이지를 섞지 않는다.
4. 원본 NetworkScene 3D ground links/coverage 및 native 노드 미래 contacts는 native receipt/UTC 소유권 계약을 유지하며 구현한다.
5. T076는 새 editor 재구현보다 source 명령별 실제 V6 evidence를 채운다. Terra 공식 texture와 전체50 renderer 검증은 별도 입증이 필요하다.

모든 기능 이식 완료 판정은 위 실제 미구현 부분이 연결되고 해당 V6 owner/입력/결과/실패가 실제 화면에서 확인된 뒤에 가능하다. 이 감사만으로 T075–T077를 완료로 닫지 않는다.
