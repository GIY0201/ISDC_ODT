# 0004: 선택 snapshot을 사용하는 가시 구간 HTTP 조회

T022 구현 결정. 기존 endpoint/WS/샘플 계산은 보존하고 `/api/orbit/visibility` POST와 VisibilityRequest schema를 추가한다. 기존 OpenAPI 원본 fixture는 변경하지 않고 새 경로/schema 하나씩만 호환성 시험의 허용 목록에 추가한다.

wire 요청은 client_request_id/selection_revision/input_id/start_utc/end_utc/ground_point/minimum_elevation_deg다. 명시적 UTC를 나노초 문자열로 정규화하고 조회 길이는 윤초를 포함한 SI 시간으로0초 초과~24시간 이하를 허용한다. 잘못된 형식/범위/좌표/virtual/ellipsoid는422이며 불법 NaN/Inf 원문은 응답에 echo하지 않는다.

runtime은 lock 안에서 revision/input/지점/높이/임계값과 현재 선택을 비교하여 불일치하는 유효 요청을409로 거절한다. immutable 선택 사본과 저장 입력을 잡은 뒤 기존 bounded executor에서 T020 search와 주입 calculation을 실행한다. 계산 스레드는 현재 상태를 수정하지 않는다. 완료 후 revision을 다시 비교해 오래된 응답에 stale=true를 표시한다. 현재 UTC/재생 상태는 조회에서 변경하지 않는다.

OrbitVisibilityQueryResult는 request/revision/input hash/지점/result/stale의 내부 immutable 계약이다. HTTP adapter가 VisibilityResult를 flat JSON으로 직렬화하고 units/virtual/WGS84/communication_status=unknown을 더한다. 접점 elevation_deg는 임계값이며 duration0이다. T020 계산의 EOP/leap hash/frame/profile과 오류 시각/error_code를 그대로 전달한다. renderer나 runtime이 HTTP 형식을 소유하지 않는다.

없음은200/none, 일부 행 실패는200/partial, 전체 행 실패는200/error다. 존재하지 않는 입력404, 유효 context 충돌409, 자료 범위422/eop_out_of_range, native/EOP/계산 미준비 또는 과부하503으로 구분한다. 기존 executor worker2/대기2의 실행/취소 한계는 유지한다. 실행중 native call의 즉시 중단이나 모든 동시 요청 시나리오를 이번 시험만으로 보장하지 않는다.

첫 API 연결은 현재 승인된 계산 함수를 그대로 조립한다. API가 하루1초 성능 목표를 달성했다고 주장하지 않는다. T023 UI, T026/T027 race/취소, T028 게임 성능, F001 실제 통신 조건과 F002 전체 기능은 계속 남아 있다. 기하 가시성으로 실제 통신 성공을 판단하지 않는다.
