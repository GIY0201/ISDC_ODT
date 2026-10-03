# ISS APRS 수신 공식 조건 부분 프로파일 v1

FR010/SC008, R006/R007, US2. 사용자: ISS부터, 지상 장비 미선정. GET `/api/communication/iss-receive-profile`은 고정된 버전 모델의 사본을 반환한다. 요청 시 외부 네트워크나 runtime 변경 없음. 기존 RF POST/계산/API schema 보존.

schema_version=1, profile_id=iss_aprs_receive_v1, satellite_catalog_number=25544, service=APRS, station=RS0ISS, direction=receive_only. source의 url/status_as_of/checked_utc와 원자료 frequency_mhz를 보존한다. known_inputs에는 frequency_ghz만 허용하며 MHz/1000으로 변환한다. communication_status=unknown, equipment_status=not_selected. source_report는 공식 공지의 testing 상태이며 현재 전파 수신 증거가 아니다. notes는 SSTV 공지 중복/운용 중단 가능성을 요약한다. profile_sha256은 원본 profile.json을 UTF8 JSON(sort_keys=True, ensure_ascii=False, separators=(',',':'))으로 직렬화한 SHA256이다. manifest 형식 1과 ID/hash를 검증하며 손상은 400, 임의 fallback 없음.

불러오기는 명시적 버튼이다. 적용은 주파수만 바꾸며 나머지 draft는 보존한다. 빈 값은 unknown, 입력된 값은 user_assumption, 공식 주파수를 명시적으로 적용한 경우만 official_confirmed다. 수동/별도 창 주파수 편집은 가정값으로 되돌린다. 불러오기/적용/출처 변경은 같은 수치여도 기존 RF 결과를 무효화한다. generation/abort/종료로 늦은 응답을 폐기한다. 실패 시 공식 정상 표시 없이 수동 계산은 가능하다.

공식 공지 날짜와 확인 UTC, 브라우저 현재 날짜 기준 공지 나이를 표시한다. 저장 GP epoch/계산 UTC와 별개이며 프로파일 적용은 궤도/기하 가시성/통신 미확인 상태를 바꾸지 않는다. 장비별 이득/손실/잡음, 현재 송신 전력/데이터율/대역폭/요구 EbNo, 도플러/복조/현장 수신은 미확인. 2012년 1200 baud 자료와 일반 25W capability를 현재 RS0ISS 조건으로 적용하지 않는다. 기존 S/X/Ka 접시 모델도 UHF 장비로 사용하지 않는다.
