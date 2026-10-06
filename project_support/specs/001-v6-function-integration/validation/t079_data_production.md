# T079 장비별 모의 제품 계산 부분 검증

원본1a1e002의 model_library/data_deployment.py 및simulation/data_deployment.py/data_products.py hash검사 후 원본함수를 별도 namespace에서 실행했다. 제품계산이 server에 조립된 상태는 아니다.

- 초기 두capture179373bytes/SHA922a90b971fa4bea762cfcdca2f51c639b4ed683546b050e8499e6b8c3d931e9 동일; semantic AST지문추가후 두179848bytes/SHAa71dd733ce93f3fb70bc90ea2a3efb62e6d750cc94e358e1204c170e98939a86 동일.
- Empty/camera-only/storage/safe/disabled/multiple-storage/nominal/4fault×3severity-active/mixed20cases ×6 interval 전체원본Pythonresult 값·순서 일치. sourceprofiles deepcopy/input불변/가상ground미생성 검증.
- Source1node 및240node4hours 전체digest/ref/count 검증: node당telemetry480+imagery160=640;240node153600제품, unique153600, 마지막slot14400. 첫·마지막node의 모든ref집합도 독립 검증. 전체digest는 fixture에저장하며153600제품 bytes를vendoring하지 않았다. Sourceoriginal4hour regression을 그대로 실행했다.
- 회귀먼저 missingmodule collectionRED. 구조이식nominal24PASS/nonfinite3FAIL/finite no-progress1case는 무한반복을 피하려고 이 단계에서 명시 제외. 별도finite/progress boundary보완후 그case까지검증; 최종target34PASS0.84s. AST function/profile 대조에서 선언된finite/progress guard외에 source계산·정책변경없음.
- Actual ScopedDataManagement에혼합장비제품7개 수집 및재전송dedupe 실행, 소스A/B만존재. NaN/Infinity/boolean/문자열/None/overflow integer/nonprogressfinite interval 차단. 정상 역시간/equal range는원본empty유지.
- 전체Node540PASS3052.611ms. 전체Python596PASS8기존warnings156.19s(session85737terminalexit0).

이 증거는 대표장비/모의제품/직접class실행이며 실제저장장비/파일/network/서버동기화/frame성능을입증하지 않는다. 현재RuntimeState 배치수락/생성cursor/HTTP/원격adapter/T149–153 미연결이라T079unchecked. 8891/native/브라우저/원격PR/병합 변경없음. T075–84/T148/T077/N003/Terra/all50/N001/T137auth/T032/장비·RF·HIL/다운로드/AeroDT 유지.

계층/syntax 검사 포함 전체Python gate 통과; staged whitespace gate는커밋전에확인.
