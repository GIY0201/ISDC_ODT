# 편집 가능한 RF 계산기 계약

2026-10-03 승인 A, FR-009/SC-007, 기존 POST `/api/communication/link-budget` 재사용. wire/default/schema 및 서버 계산식 변경 없음. V6는 모든 필드를 빈 입력으로 시작해 명시적으로 채운 값만 전송한다. 숫자는 유한하고 아래 범위를 만족해야 한다.

| 필드 | 단위 | 기존 범위 |
|---|---|---|
|link_id|링크 이름|문자열 길이1~40, 공백만은 UI에서 거부|
|frequency_ghz|GHz|>0.1, ≤300|
|distance_km|km|>1, ≤100000|
|tx_power_w|W|>0.01, ≤100000|
|tx_gain_dbi / rx_gain_dbi|dBi|≥-20, ≤100|
|misc_losses_db|dB|≥0, ≤100|
|bandwidth_mhz / data_rate_mbps|MHz / Mbps|>0.001, ≤100000|
|system_temp_k|K|>1, ≤5000|
|required_ebno_db|dB|≥-10, ≤50|

응답의 `model=RF-Friis-v1`, link_id, inputs 전체 필드가 송신값과 일치하고, status가 pass/marginal/fail이고, 수치 8개가 유한하고, assumptions가 문자열 배열인지 확인한다. 불일치 응답은 결과를 표시하지 않는다.

출력 단위는 eirp_dbw/dBW, fspl_db/dB, received_power_dbw/dBW, noise_power_dbw/dBW, cn_db/dB, ebno_db/dB, margin_db/dB, capacity_mbps/Mbps다. capacity는 Shannon 이론 용량이다. 기존 분류는 반올림 전 margin으로 결정하므로 UI는 status를 그대로 표시한다. 3dB/0dB는 기존 모델 분류이며 실장비 판정 기준이 아니다.

UI는 입력을 사용자 설정 가정, 거리를 직접 입력, 실제 통신을 미확인으로 표시한다. GP 시각/지점/가시 구간과 자동 연결하지 않는다. HTTP422는 필드명과 메시지를 표시하며 네트워크 실패를 정상 결과로 바꾸지 않는다.

draft와 응답은 화면용 사본이다. 입력 변경/새 요청/취소/종료에서 generation을 증가시키고 abort를 무시하는 늦은 응답도 폐기한다. 화면 재구성은 같은 입력이면 결과를 유지한다. 별도 창에서 변경된 draft는 이전 결과를 지우고 재계산을 안내한다. pagehide에서 종료한다. runtime 선택/UTC/revision은 변경하지 않는다.
