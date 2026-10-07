# ADR0058 검증된 분석 시계의 상태 문구

실제 TERRA25994 API→기존 catalogueTimeline→nodeClock read probe는 frozen leap
6cb6 및 정규9자리 UTC, 선택GP hash가 일치하고 mode='카탈로그'를 반환한다.
buffer 미계산 상태에서는 running을 생략하며 재생을 제한하는 것이 기존 계약이다.
satellite_nodes label은 legacy live/paused/runningtrue만 읽어 정상 source mode를
'표시 시각 미확인'으로 표시한다. 데이터/승인/계산 장애가 아닌 표시 분기 누락이다.

기존 UI 문구 분기에서 검증된 readClock의 기존 mode만 인식한다. 기존 live/paused
표시를 보존하고 catalogue의 running 생략은 '카탈로그 분석 시각 · 재생 샘플 미계산',
runningtrue/false는 재생/정지로 표시한다. 저장 궤도/SIM/따라가기도 실제 기존
mode와 명시 running만 표시하며 없는/알 수 없는 mode는 미확인으로 유지한다.
UTC/owner/재생조건/버튼/명령/native/승인 로직은 변경하지 않는다.

현재 source mode/미계산버퍼/legacy/unknown/재생정지에 의미 있는 RED를 먼저
추가하고 관련 원본 UI/clock 회귀 및 전체 변경 JS를 검증한다. native/body/전체
배치 승인/GPU/완료 판정을 문구로 대체하지 않는다.

사전 독립 분석 HIGH0/CRITICAL0. 알려진 source mode만 정확한 allowlist로
추가 인식하고, 기존 mode 없는 runningtrue의 일반 '분석 시각 · 재생' fallback은
유지한다. 알 수 없는 mode에 source 이름을 새로 부여하지 않는다. 기존 unknown
fallback과 버튼 enable 조건은 바꾸지 않는다.
