# N017 읽기 전용 조회 계약

ADR0049의 pollStatus는 GET 관찰이며 send/refresh/route와 다른 취소 수명을
가진다. busy 명령은 조회하지 않고, 중복 조회는 동일 promise를 반환한다.
command 진입/endpoint 변경/화면 이탈/종료는 먼저 조회를 취소한다.
미확인 명령, review와 오류를 자동으로 해제하지 않는다.

moduleStatus는 별도 사본으로 endpoint/status/value/error를 반환한다.
기존 snapshot 계약은 그대로이다. qualityHistory(linkId)는 실제 수락 뒤
등록된 최대48개 과거 samples의 사본이며 정확 UTC 명령 verifier와 관계없다.
품질/UTC/instance/sequence/network hash/request/link를 같이 보관한다.
endpoint 또는 module instance 변경, 명시적 invalidate와 dispose는 이력을
정리한다. 새 수락 receipt의 링크 명부에서 사라진 link ID는 prune한다.
UTC/network_hash/sequence/request ID는 sample 출처·중복 판정이며 전체 이력
초기화 사유가 아니다. 자연 UTC와 같은 링크의 과거 이력을 유지한다.

지상 UI에만 30초 wall timer와 즉시 초기 조회가 있으며 기존 분석 timer를
대체하거나 추가 분석 clock을 만들지 않는다. 선택 이력은 원본 sparkline,
별도 분석 UTC/과거 label을 사용한다. 실패/늦은 응답/이탈은 명령 수락을
위조하지 않는다. 실제 RF와 장비 조건은 미확인으로 유지한다.
