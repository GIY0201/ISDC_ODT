# ADR0012 지상국 대표 좌표를 계산 초안에 연결
선택은 화면 상태이므로 서버 적용과 분리한다. 원본 lat/lon/minElevationDeg만 명시 복사하고 기존 저장GP 선택/setGround(preserveUtc)/samples/visibility/radio 계약을 재사용한다. 원본 altitudeKm은 높이 기준면 미확인으로 WGS84 ellipsoid_height_m에 자동 매핑하지 않는다. 사용자 기존 높이·조회 범위·주파수 초안을 유지한다. 저장 입력 미선택/적용 중에는 복사를 거절해 초안 소실을 예방한다. 카탈로그 표시를 저장 계산 입력으로 동일시하지 않는다. publicHTTP/API/계산 변경없음. 검증 validation/t098_station_observer.md.
