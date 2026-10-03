# W03-C 기존 시나리오 통신 기능 표시

FR011/SC009, US2. `/api/bootstrap`의communication.nodes/links 사본으로 선택지를 만든다. `/api/communication/route` POST(source,target,objective), `/api/communication/contacts?hours=...` GET 및server/schema/계산을보존한다. network/route/contacts 명시버튼으로조회하며자동서버명령없음. 기존browser api 인자에optional {signal}만추가해호환유지.

source,target는graph내ID이며같은ID도기존알고리즘의0hop을표시한다. 목적은latency/reliability/balanced. hours는정수1~72이며접촉계획의생성파라미터다. 원알고리즘은종료시각을hours안으로엄밀히자르지않으므로그대로표시하고조건을알린다. 모든일정행을표시하며임의3개/최대행절단없음. 접촉시간은UTC로표시,조회브라우저UTC를구분한다. provenance=scenario-contact-plan-v1는envelope/item모두확인한다.

route는입력echo/knownpath/link정합/hops/cost/status/active_fault_targets를검증한다. contacts는hours/count/items/link참조/UTC순서/유한duration/quality/capacity를검증한다. graph는비어있을수있고ID중복/누락link/비유한quality는오류다. 실패는정상/없음과구분하고명시취소가능. 입력변경/재조회/망reload/종료/원격편집은관련결과를무효화,route/contacts독립세대와abort로늦은응답폐기. 동일값원격draft도과거결과폐기. local창재구성은값/결과사본보존.

시나리오데모망과quality기반비용임을상시명시한다. status available/unavailable은시나리오모델의경로유무이며실제ISS접촉/수신가능으로번역하지않는다. ISSprofile/RF/GP선택/UTC/가시성/Viewer를바꾸지않는다. 실제장애계측/예약/권한/운용동기화없음. 필요새폴더/상태저장소/Viewer없음.
