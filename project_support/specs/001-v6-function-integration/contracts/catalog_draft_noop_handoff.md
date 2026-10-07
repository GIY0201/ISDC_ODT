# 같은 카탈로그 초안 인계 계약

ADR0060/T179–T180: 지원 필드 station/height/angle/utc의 문자열 값이 현재
catalog_time owner 초안과 모두 같으면 applyDraft는 detach/invalidate/계산/시계
명령/UTC dirty 변경을 하지 않는다. 값의 정확한 비교이며 단위·UTC 정규화는 없다.
실제 차이는 기존 적용/철회/명시 재계산 계약을 그대로 사용한다.

시험은 실제 catalog timeline/panel/root navigation과 node clock owner를 사용한다.
계산된 paused buffer가 local 화면 이동과 동일 remote handoff에 유지돼야 하고,
다른 입력은 buffer 및 이전 승인 증거를 철회해야 한다. no-op은 기존에 없는
buffer나 clock.running=false를 만들지 않으며 다른 source에 권한을 주지 않는다.
