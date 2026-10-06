# T152 실제 프리셋·240기 상한과 복제 이름 수정

2026-10-06. T076/T151/T152 부분 검증이며 T075–T084 전체 완료가 아니다.

## 결함과 수정
유효한40자 이름을 복제하면 기존 cloneNode의 자동 사본 접미사 때문에 validateNode가 거부했다. 실제 반복 복제도205기에서 같은 제한에 도달했다. 회귀시험40-codepoint name duplication RED 후 모델 정의의 기존40-codepoint 상한을 readonly MAX_NODE_NAME_LENGTH로 공개하고 store가 복제 이름을 그 상한에서 접미사 길이를 뺀 codepoint 단위로 잘라 전달한다. 원본 cloneNode/원본 노드와 짧은 이름의 기존 golden 결과는 유지한다. 상한 완화, UTF16 surrogate 분리, 원본 이름 덮어쓰기 또는 실패 시 ID 소비는 하지 않는다. 공개 상수는 ADR0022에 기록했다.

전체 Node688PASS5655.8677ms; Python650PASS8warnings295.01s(session54487exit0). 목표 store 시험은40codepoint emoji 이름을239번 반복 복제하고240개의 서로 다른id/catalog을 확인하며241번째 실패 전후 모든 상태 동일성을 검증한다. 원본 golden/회귀와 손상 저장/모델/배치 검사는 유지됐다.

## 실제8891 검증
기존 개별NODE-0001과 안전모드/DTN 설정NODE-0042를 보존하고 검증 편대만 live 슬라이더로 교체했다. 단일1기, 열차형2기, Walker별4기, Walker델타12면×16=192기 정의와 출력 기록을 보존했다. 입력값 정규화와 기존 기체/장비 정의를 사용하며 wall-clock은 편대 정의 epoch일 뿐 별도 분석 시계가 아니다. 도구 fill/Tab만으로 숫자change가 확정되지 않은 관측은 프리셋 실패로 계산하지 않고, 실제 슬라이더 ArrowRight/Home/End input 경로로 결과를 확인했다.

192기 편대와 보존한2개별 위성으로194개였다. 검증 복제본46개로240개에 도달했다. 최초11개 이후 long-copy 오류를 수정한 일반 새로고침 후 나머지35개가 생성됐다.241번째복제는 명확한240개 오류와 함께 거부됐고 DOM 정의JSON은 완전히 동일했다. 실제 UI native 상태는 계산 후 Kepler+J2 모의 계산으로 정착하고 새consoleerror는 없었다. 별도 실제HTTP samples count1 쿼리로240모두 원본id순서/동일UTC/valid row임을 검증했다. frame EARTH_FIXED_GMST_UTC_APPROX/profile SOURCE_KEPLER_J2_V1/quality engineering_assumption 유지. 측정HTTP응답0.0556347s는 단일쿼리 관측이며 GPU/frame 성능 또는 부하수용 기준이 아니다.

1280x720/1920x1080 목록240개 화면 증거를 저장했다. 임시 복제46개를 정확한id 목록으로 제거하고 검증 편대를5기 열차형으로 되돌려 전체7개를 보존했다. 기존2개별 정의는 before_presets와JSON 동일했다. 저장GP1xplaying복원/viewportreset/배치POST없음. 모든 전후 JSON과 native응답은 ignored data/workspace/validation/t151_live에 보존했다. 예시 우측카드는 여전히 실제 선택과 별개이며 실측이나 배치 수락이 아니다.

## T075 자산 전송 추가 확인
실제 같은8891의50 GLB와50 thumbnail HTTP200/파일byte수/SHA256이 asset_receipt와 모두 일치했다. 따라서 현재 factory에 package가 mounted되지 않았다는 README 문구를 갱신했다. 하지만 Terra에는 여전히 누락된Side_Panels_TERRA.tga/solarpanels.tga 의존성이 있고 receipt.complete=false를 유지한다. 전송/무결성은50모델 실제GPU렌더/faithfulTerra복원 증거가 아니다.

## 증거와 남은 범위
Local ignored: before_presets.json/preset_receipts.json/formation_192.json/formation_240.json/native_240_receipt.json/native_240_response.json/preset_cleanup_receipt.json/cap_count_1280.jpg/cap_count_1920.jpg/model_http_bytes.json/presets_full_node.log/presets_full_python.log. Earlier cap_*.jpg shows unrelated scrolled GP view and is not count proof; use cap_count_*.
T151/T152/T153 및T075–T084는 미완료 유지. 모든50GPU/Terra/카메라·hover·morph·배속·역방향/전체장비·모드/실제배치오류·활성화/240GPU프레임/N001다중창/T032성능/T137인증/장비RFHIL/통신망·임무·데이터·보안·PoC·설정/파일bytes 및리뷰가 남는다. 다음 원본통신망 연결에 필요한 source snapshot 계약과 실제모델 오류/공용시계 검증을 이어간다. 새branch/remoteGit/serverrestart/originalenv변경 없음.
