# 전체 기능 연결 계획: 독립 ISDC ODT

2026-10-01. 이 문서가 최초 요청 전체의 범위와 단계 관계를 정의한다. plan.md와 tasks.md는 이 중 W01/W02 및 W00의 첫 상세 구현 묶음이다. 첫 ISS 시연이나 연구시험을 전체 제품 완료로 기록하지 않는다. 이후 묶음은 현재 기능 결과를 함께 검토해 상세 명세/계약/작업을 작성하며, 아래 순서는 제안이지 확정 승인 이력이 아니다.

## 최초 요청과 공통 구조
현재 checkpoint(2026-10-03): 아래 표의 W00~W02 상태는 초기 계획 이력이다. W01/W02 첫 제품 흐름과 W00 창·별도창은 구현·회귀 검증했고 로컬wheel 설치도 통과했다. W00의 게임UX/하루1초는 SC-006 미달(T032)이다. W03~W08 상세 기능과 W09 다른PC/실제AeroDT연계는 여전히 후속이다. 전체 목적을 ISS 시험으로 축소하지 않는다.

채택 V6 UI에 선배 ISDC-ODT의 실제 존재하는 기능을 단계적으로 연결한다. 독립 개발 루트는 ISDC_ODT, AeroDT는 계층 책임/파일 생성 규칙/좌표·단위·계약을 공유할 향후 연결 대상이다. 지금 UAM을 ISDC 내부에 넣거나 AeroDT의 UAM 빌드 범위를 바꾸지 않는다.
foundation은 단위/시간/좌표의 공통 정의, communication은 HTTP/native/향후 외부 연결, data는 입력/산출물, digital_twin의 contracts/model_library/simulation/runtime/visualization은 각각 계약/정의/계산/현재상태/표현, user_application은 조립/사용자흐름/configs, project_support는 문서/시험/도구를 맡는다. ai_eng/ai_pnp는 실제 승인 기능이 없으므로 폴더를 미리 만들지 않는다. runtime의 현재 상태를 data/renderer/native에 중복 소유시키지 않는다.

## 기능 묶음과 완료 기준
| ID | 전체 기능 | 선배 코드 근거 / V6 연결 | 구조와 재사용 방침 | 완료 게이트 / 상태 |
|---|---|---|---|---|
| W00 | V6 업무공간과 공용 맥락 | V6 html/css/js, index.html/scripts, globe.js / 모든업무 | user_application의창/입력흐름, visualization은주입표현. 원본동작 보존 후 기능별연결 | 이동/크기/최소화/확장/복원/별도창, 입력보존/충돌, 실제두해상도/gameUX. 첫설계, 미구현 |
| W01 | 실제저장궤도 입력과 전파/UTC | data/catalog 및 simulation/browser/orbit.js / satellite,wall | 기존카탈로그참고, 정확전파는Rust와Python좌표경계. data원문/hash, runtimeUTC | TLE/OMM/출처/UTC/오류/정확도/재현. 연구완료, 제품미구현 |
| W02 | 지점 및 기하학적 가시성 | browser/orbit.js elevation/pass / ground,wall | WGS84지점/EOP/고도각/가시query simulation. 기존구면/45초/5도/3개제한은대체 | 0.01도/경계1초, 짧은구간/접점/잘림/없음, 가상과통신미확인. 첫상세설계 |
| W03 | 실제조건을반영한RF/접촉/경로 | communication/http/rf_network.py, simulation/rf_network.py / ground,operations | 기존link-budget/route/contacts를회귀보존. 공식서비스/장비/손실/도플러/여유조건을model_library versionedpackage, 운용선택configs, 계산simulation | 공식자료필수입력/단위/유효범위, 정상·실패·미확인. 기하/모델충족/실수신구분. F001필수미구현 |
| W04 | 임무와규칙기반재계획 | http/missions.py, runtime/missions.py / mission,normal,composer | 기존tasks/action/validate/replan typed호출재사용. 현상태runtime, 계획입력사본 | 임무작성/변경/검증/재계획전후 재현/의도한연결. AI로표시금지. 상세설계대기 |
| W05 | SIM 실행/초기화/장애와텔레메트리 | http/runtime.py,telemetry.py, runtime/state.py / operations,initial,exception,run | 기존control/speed/scenario/faults/WS 보존. GP UTC와SIM elapsed를명시분리. runtime↔model_library↔simulation 경계 | 정지/재개/속도/시나리오/장애/이벤트와WS일치. 실제명령ACK아님. 상세설계대기 |
| W06 | KPI/비교/분석 및 내보내기 | verification/kpis.py, data/exports.py,http/reports.py / compare,data,operations | 기존SIM KPI/CSV/JSON 회귀유지. 실제추가궤도/RF 결과별출처와공통run/inputhash를contracts→data에전달 | 지표정의/단위/자료종류/수치재현, CSV/JSON 원본표시동일. mock지표를실측성능으로표시금지. 상세설계대기 |
| W07 | MOCK-HIL 장비동작/시험sequence | simulation/mock_hil.py,http/hil.py / em,initial,exception | preflight/device/sequence/recording-control 기존동작재사용. EM 실제adapter는향후승인범위 | 성공/실패시나리오/sequence증거/MOCK-HIL표시. recording flag≠영구기록/재생. 실제HIL은F004 별도 |
| W08 | 장면·사건·실행·비교 연구흐름 | V6 scene/composer/run/compare, 선배scenario/task/fault/control/KPI 기능 | 기존가능기능을workflow로연결하고미지원부분명시. scenario정의model_library, 임무/사건runtime, 산출물data | 같은선택/입력으로장면→사건→SIM실행→비교전환보존. 장면영구저장/시간예약사건/replay는현재코드존재확인후범위협의. 상세설계대기 |
| W09 | 독립배포와향후AeroDT연결 | bootstrap/application/configs 및버전계약 | 같은폴더책임/명명, snapshot/단위/시간의버전계약. nativebuild를project_support에두고호스트adapter로설치 | AeroDT없는실행, wheel/DLL license/ABI/설치receipt, 다른PC검증지원범위. AeroDT실제연결은인터페이스검토후별도작업 |

단계 제안: W00+W01→W02→W03. 이후 W04/W05 중 사용자가우선할업무를선정, W06은연결된결과를기준으로추가, W07 및 W08을단계적으로연결한다. W09의구조/설치검증은각단계에서병행관리. 임무/장비의실제실행은이순서표만으로외부전송을승인하지않는다.

## V6 전영역 누락 점검
| 업무 ID | 연결할 기능 | 현재없는부분/보존할범위 |
|---|---|---|
| wall | W01위치/W02다음가시/W05사건/각자료출처 | 고정시연값을실제관측으로표시하지않음 |
| normal | W04임무흐름/W05SIM상태 | 실제운용승인/ACK는선배기능아님 |
| initial | W05시나리오선택/W07preflight | 실제장비초기화는미연동 |
| exception | W05faults/events/W07실패sequence | 실제경보/안전판정으로주장하지않음 |
| mission | W04작성/action/validate/replan | 규칙기반과AI구분 |
| operations | W05SIM제어/telemetry/W03조건/W06KPI | GP/SIM시간및출처분리 |
| satellite | W01자료/위치/궤도/UTC | 정확전파자료나이와예측범위 |
| ground | W02가상지점/기하/W03RF접촉/경로 | 실제시설/장비사양조사필수 |
| data | W01입력manifest/W06CSV/JSON | 영구기록/replay는별도미구현 |
| security | 기존모의auth지표의범위확인/W06출처 | 보안인증/접근제어제품은선배prototype에존재하는지추가확인. 새보안시스템을암묵적으로발명하지않고미연동표시보존 |
| facility | W02지점/W07모의장비목록 | 실제시설감시·명령은미연동, 시설상세기능은존재여부/요구확인 |
| em | W07MOCK-HIL | 실제EM연결로표현금지 |
| scene | W08장면/시나리오선택 | V6편집입력보존,영구저장은지원범위확인 |
| composer | W04임무/W05사건/W08연구흐름 | 예약실행/인과관계편집은선배기능과동일하지않음 |
| run | W05실행/W07시험/W08흐름 | 실측/실장비실행아님 |
| compare | W06KPI/산출물/W08흐름 | 같은조건비교/출처필요,runhistory/replay미지원구분 |

작업목록 전체를 유지한다. 의미가 비슷한 화면을 임의로 같은 기능으로 완료 처리하지 않는다. security/facility의 신규실기능은목록에노출된다는이유만으로구현범위를발명하지않는다. 요구와기존코드확인후관련단계에서논의한다.

## 전체 요구 추적과 첫 작업 묶음
R001독립/구조=W09및모든묶음, R002V6=W00/전업무표, R003선배기능=W01~W08, R004단계검토=각묶음종료, R005첫기능=W01/W02, R006실제통신조건=W03, R007출처/검증=전체, R008언어/환경=W09와계산경계, R009게임사용성=W00+각기능측정, R010보존=전체.

현재 tasks.md의T001~T030 및T031은W00~W02의상세작업과W09의최소설치게이트다. W03~W08을구현한작업이아니다. T030은후속추적업무이며RF/임무/KPI구현완료증거로계산하지않는다. 전체완료율을첫묶음의checkbox 비율로계산하지않는다.

각후속묶음진입시 기존feature의추적표를확장하거나명시적새기능scope를작성하되최초요구를연결한다. 실제API/데이터모델/파일수준계약/순차tasks를추가하고일관성검사후구현한다. RF상세는서비스/장비필수입력선정후, 지원하지않는장면/시설등은근거와함께사용자에게남은항목으로보고한다. 담당단계는F001통신plan/verify, F002나머지기능plan/tasks, F003환경/성능verify, F004실제HIL·영구기록요구검토, F005실측위치verify, F006배포plan/verify.

## 2026-10-04 최신 W03 checkpoint
W03-A 범용 RF UI와W03-B ISS 공식 주파수 부분프로파일 연결/검증완료. 선배 RF 계산/API 유지. 장비 미선정과실제운용/수신unknown,F001전체미완료. W03나머지조건/접촉/경로,W04~08기능및실제AerODT연계는후속. 최초전체목적을ISS프로파일로축소하지않는다. T032프레임보류유지.

## 2026-10-04 W03-D checkpoint
W03-C 시나리오 경로·접촉 계획과 W03-D 저장 ISS 단일시점 거리·도플러 V6 연결/검증 완료. validation/t044_communication_planning.md 및 t049_orbit_radio.md 참조. 기존 W04 임무 순서·전체 목적 보존. F001 전체 실제통신조건/F002 전체 기능/W04~08/다른PC·실제AerODT연계 미완료, T032 보류 유지.

## 2026-10-04 W03-E checkpoint
가시구간→거리/고도각/도플러 변화와표본요약 연결 검증완료(T050~54). 선배 상대속도식 및 기존 batch/가시조회 재사용. validation/t054_orbit_radio_series.md. 실제 수신/장비/조건 전체와임무/SIM/KPI/다른 후속범위는미완료, T032보류유지.
