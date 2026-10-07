# ADR0060 같은 카탈로그 초안의 화면 인계

실제558에서 카탈로그 native 관측 계산/정지와 배치 확인을 기록했지만, ground
이동 뒤559의 기존 접촉 조회는 clock.running 미확인으로 거절됐다. 현재 render는
화면 이동 전 초안을 캡처하고 새 화면 구성 후 applyWorkspaceDraft로 다시 적용한다.
catalog_time.applyDraft는 값이 같아도 detach/invalidate하여 기존 buffer를 지운다.
이것은 원본 계산식 오류가 아니라 V6 화면 인계의 연결 오류다.

기존 catalog_time.applyDraft에서 지원하는 station/height/angle/utc 문자열 값을
현재 owner 초안과 먼저 비교한다. 실제 차이가 없으면 부작용 없는 no-op으로
반환한다. 실제 값이 달라진 경우에는 기존 follow detach/입력 적용/UTC dirty/
timeline invalidate/명시 재계산 안내를 유지한다. 다른 필드·타입은 기존과 같이
적용하지 않는다. UI 텍스트·단위·숫자 또는 UTC를 정규화해 다른 입력을 같다고
간주하지 않는다. clock.running을 생성하거나 buffer를 재생성하지 않는다.

같은 owner의 local remount와 동일 remote draft 인계에 적용한다. 실제 변경된
원격 입력은 기존 capability를 철회해야 한다. 선택 source 변경·pending/late
query·follow/UTC/observer 검증은 유지하며 서버·저장 ISS·SIM은 변경하지 않는다.

사전 독립 검토→실제 root navigation 회귀 RED→최소 수정→독립 검토→변경 JS
전체 회귀 및 실제 ground 이동/통과 조회를 검증한다. T075–T084/두 해상도/
모델/GPU/성능/PR 게이트는 별도이며 이 수정으로 전체 완료를 주장하지 않는다.
