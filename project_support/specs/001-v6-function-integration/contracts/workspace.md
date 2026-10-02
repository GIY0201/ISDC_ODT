# Workspace contract: 첫 orbit 연결
검토안. 채택 V6 원본은 AeroDT plan의 isdc_odt_v6.html/css/js 및 review. 기존초안은 review_history에보존. 구현 시 source hash를기록하고 own프로젝트 asset으로이식, 외부개인경로참조금지.

V6 hash/업무식별자 wall,normal,initial,exception,mission,operations,satellite,ground,data,security,facility,em,scene,composer,run,compare 유지. 현재연결하는업무는satellite 및 ground 기하가시성. 그외업무는기존동작을숨기거나첫기능완료라고표시하지않고후속연결범위를설명한다. orbit alias는satellite,communication alias는ground이되RF통신완료로표시하지않음. 이전모든tab mapping은이문서의현재연결범위로대체한다.

하나의Cesium Viewer를공용지구로유지. 창open/minimize/restore/close는viewer재생성및orbit선택초기화를유발하지않음. geometry는화면안clamp하고주요조작은두해상도에서접근가능. tab사이에semanticselection을복제하지않음. DOM재사용및구독해제를검증하고차트비활성작업갱신억제.

browserapi.js만HTTP를호출하고역할별tab은viewflow를맡는다. globe는지구고정좌표와표시UTC를주입받음. GP예측/제주가상/기하가시성/통신미확인 표시. syntheticposition/SIMtelemetry와GP를합치지않음. 기존SIM/MOCK-HIL의의미보존.

시간슬라이더피드백은provisionalUTC,현재계산위치는resultUTC로구분. ready/pending/error/stale표시. client_request_id/revision/hash가최신context에맞는응답만적용. batchinterpolation은수치게이트통과시간간격/재생속도범위만허용. 데이터없으면이전결과임을명시. 프레임마다API호출하지않음.

채택V6의Popout을보존한다. 현재업무/입력사본을같은origin별도창으로전달하고runtime revision으로동기화한다. 동시수정충돌은409상태표시후snapshot재조회하며편집값을조용히덮어쓰지않는다. 팝업차단은오류안내. Viewer는문서당1개, 원문서Viewer는유지한다. 같은origin/channel cleanup과창닫기시험을T031에포함한다.

## V6 원본 identity
HTML SHA256 4e096aea64c1c9beac3218ff40bbe7f6bdd5b3f16750ae92ef3ac16da8c64c5b
CSS SHA256 c0ab17d9d496dd3eb78d984a661793d1cc266fde9c03ed7643dcc16b97a0e262
JS SHA256 7301c5872fd19cb4260dca1424398f37605d425c31397f08022e97feba9fd2c6
이번단계에서원본을수정하거나제품UI를교체하지않았다.

