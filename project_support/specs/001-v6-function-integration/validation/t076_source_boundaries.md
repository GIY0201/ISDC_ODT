# T076 원본 계약 사전 대조

2026-10-05. 원본 checkout HEAD `1a1e00297a0301637455b0ef2cf48b2e74576b07`의 파일을 직접 읽었다. 제품 구현이나 T076 수용 완료가 아니라, 다음 설계에서 보존해야 할 동작과 경계의 근거다. 전체 T075–T084 범위를 유지한다.

## 읽은 원본과 SHA-256

| 원본 상대 경로 | SHA-256 |
|---|---|
| digital_twin/model_library/browser/satellite_nodes.js | 722323b356b8c0937896aff45f919300099aed789372054ec142148520eadafb |
| digital_twin/simulation/browser/satellite_dynamics.js | 5580263519e45f6b3e1f7d2a5dbceae097d99d6949f8190ce8c87fe2145f6eb5 |
| user_application/web/scripts/nodes/constellation.js | a4b7a68595ae219688ee16922fe58af852d2a074641c7185081242cc9760f231 |
| user_application/web/scripts/nodes/editor.js | 51d2c72023e702a9c568c72838fe3383101b34a231e33e2631955ae75159ed93 |

## 확인한 의미

- 노드 schema1, 가상 catalog 번호 기준900000, 버스5종/장비9종/운용모드 nominal·standby·safe, 단일·열차·Walker delta·star 배치를 제공한다. 수치는 제조사 사양이 아닌 원본 sandbox 대표값이다.
- 초안과 배치 사본은 브라우저 localStorage의 별도 키다. deploy는 structuredClone으로 사본을 만들고 recall은 배치 사본만 지운다. 서버 runtime 변경이 아니다. 최대240개, 복원 시 ID/가상번호 중 가장 큰 값 이후로 sequence를 재개한다. 변경 판정은 updated_at을 제외한다.
- 원본 편집기는 이름/버스/모델/장비/궤도/전력/모드를 편집한다. Walker 면당 위상과 면간 F, 열차 간격, RAAN 범위, formation 소속 분리 의미를 보존해야 한다.
- `orbitElements`는 Kepler+J2 secular 모델이다. 근지점>=120km, 원지점<=200000km, 0<=e<0.95, 경사각0..180도를 검사하고 불가능한 궤도는 null로 반환한다. UI 설명의 ‘0~0.95’는 실제 상한 배타 조건과 차이가 있다. 단주기 항은 포함하지 않는다.
- `nodeStateAt`는 원본의 GMST 회전 및 저정밀 태양/원통형 그림자로 fixed 위치와 일조를 만든다. 현재 제품의 GP→Rust SGP4→정밀 ITRF/Solar 계약과 같은 정확도나 프레임으로 주장할 수 없다. 이 부분은 명시 모델/프레임 계약과 비교 자료를 먼저 작성해야 한다.
- `powerBudget`는 순간 발전/소비/여유다. 배터리 Wh는 정의에 있지만 SOC 적분은 없다. safe는 essential만 활성, standby는 OISL 비활성, activeTerminals 집합을 주입하면 OISL 소비 선택을 반영한다. 실제 RF/광링크 또는 배터리 지속 운용 증거가 아니다.

## 설계 전에 해결할 경계

1. 기존 GP 입력/Rust 전파를 사용자 배치 Kepler+J2로 교체하지 않는다. 원본 계산식의 재사용과 제품 좌표/시간 변환을 분리하고 원본 수치 golden을 먼저 확보한다. 계산 언어·프레임·시간 세부 결정은 아직 확정하지 않았다.
2. 원본 localStorage 전역 singleton과 Date.now 기본값을 그대로 import하지 않는다. 저장/시간/ID를 조립 지점에서 주입하고 초안·배치 사본과 서버 runtime 권위를 구분한다. 배치 버튼의 의미를 실제 서버 배포로 확대하지 않는다.
3. 원본 검사에서 전력 Infinity가 `>=0`으로 통과할 수 있고 getter가 내부 배열을 노출한다. finite/사본/저장 실패/복원 손상·중복/240개 경계 회귀를 작성하고 호환 보완 이유를 기록해야 한다. 이번에는 코드를 수정하지 않았다.
4. 노드와 편대 편집, 배치/회수, 장비/전력, 모델 표시, 원본 계산, scene/composer 조립, 두해상도 실제 수용까지 T076을 세분화한다. Terra 자산과 기존 T075 수용 미완료는 따로 유지한다.

검증은 원본 파일 읽기/해시/HEAD 조회뿐이다. 원본 실행 동등성, 수치 정확도, 제품 UI 연결, 새 회귀 통과를 주장하지 않는다.

## 추가 호출 경로 대조: 실제 배치 버튼은 서버 수락과 연결됨

위의 브라우저 사본 설명은 `constellation.js` 함수 자체에 한정된다. 전체 UI의 배치/회수 의미를 로컬 변경만으로 설명하면 원본 기능을 누락한다. 추가로 `tabs/nodes.js`의 submitDeployment, `nodes/deployment_client.js`와 `nodes/data_deployment.js`를 직접 읽었다.

- `data_deployment.js` SHA256 `3774b247d3fe3fb1048ea583b2f2ac1547e3c488f3e2b64d97b46a5900b438b4`; `deployment_client.js` SHA256 `6aa25932eac8c38a0d29ee4f38e9cebea03c994d630c5030187fe9e7d9052d10`.
- UI 버튼은 공유 deployment client를 호출한다. `/api/data-management/deployment` GET/POST가 revision/run_id/scope_id/deployment_id 및 노드·장비 식별자를 관리한다. 확장된 장비 모델 값이나 궤도는 이 배치 요청에 포함하지 않는다.
- 직렬 요청, 15초 timeout, 동일 요청 재시도 시 deployment_id 유지, expected_revision과409 재조회, 수락 응답의 ID/구성 대조 후에만 로컬 deploy/recall이 실행된다. 충돌 시 원본 UI가 사용자 확인을 받고 서버 구성을 덮어쓴다. 사본/초안/이전 배치를 실패 중 보존한다.
- 원본 initialize는 revision0/null 서버에 저장된 브라우저 배치가 있으면 restore POST를 자동 수행한다. 새 제품의 복원 시 자동 명령 금지 계약과 충돌하는 동작이므로 승인되지 않은 restore POST로 그대로 이식하지 않는다. 표시 사본 복원과 명시 서버 배치 수락을 별도 계약/회귀로 다룬다.
- T076 편집/표시와 T079 데이터 관리 배치 endpoint를 하나의 acceptance 연결로 추적한다. 로컬 배치만 구현한 상태를 원본 배치 기능 완료로 처리하지 않는다. 현재 제품 서버에 해당 endpoint를 새로 만들거나 호출하지 않았다.
