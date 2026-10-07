# 읽기 전용 모듈 조회와 품질 이력

상태: N017 구현 설계. 선배 communication.js의 30초 상태 조회와 48개
품질 이력을 기존 fabric 소유자와 지상 화면에 연결한다. 기존 명시적
refresh는 미확인 명령 검토이므로 자동 호출하지 않는다.

같은 createFabricExchange에 pollStatus(), cancelStatusPoll(), moduleStatus(),
qualityHistory(linkId)를 추가한다. 기존 snapshot/send/refresh/route 계약은
유지한다. pollStatus는 읽기 전용 GET만 수행한다. 명령이 실행 중이면 null,
조회가 진행 중이면 동일 promise를 반환한다. endpoint를 캡처하며 취소,
endpoint 변경, 종료와 새 send/refresh/route 진입은 조회를 먼저 철회한다.
무시된 abort의 늦은 응답은 상태를 게시하지 않는다.
실제 client.status 요청에 캡처한 endpoint를 target으로 전달한다. 완료 후
비교만으로 요청 대상을 정하지 않는다. GET 전후 endpoint와 취소 ticket을
확인하며 endpoint가 잠시 변경됐다 돌아오는 경우도 회귀 검증한다.

자동 조회는 uncertain command와 review/error를 해제하지 않는다. 현재 수락
receipt의 instance/sequence/hash가 조회와 다르면 receipt와 route를 철회한다.
다른 instance의 미수락 command는 재시도를 막고 명시적 검토를 요구한다.
명령 ID/sequence를 새로 할당하거나, 상태 응답의 network를 승인으로
채택하거나, 명령을 자동 재전송하지 않는다. 실패는 조회 상태에 기록한다.
읽기 전용 상태는 endpoint, status(pending/valid/error/unavailable), value,
error를 별도 getter의 사본으로 제공하며 기존 snapshot 모양을 바꾸지 않는다.

qualityHistory는 같은 소유자 안의 제한된 과거 시각화 데이터이다. 실제
send가 native 현재 context와 guarded receipt를 검증한 뒤에만 추가한다.
instance/sequence/hash/request/link ID로 중복을 방지한다. 알려진 usable과
유한한 quality는 그대로, 알려진 unusable은 원본 0으로 저장하고 미확인은
건너뛴다. 링크별 48개, 현재 receipt의 링크 목록으로 prune한다. endpoint와
instance 변경, 명시적 invalidate/dispose는 이력을 정리한다. 자연 UTC 변경은
현재 수락을 만료시키지만 과거 이력 자체를 지우거나 현재 승인으로 쓰지
않는다. getter는 과거 samples(quality,utc,instance_id,sequence,network_hash,
request_id,link_id)의 사본을 제공한다. 전역 charts history를 쓰지 않는다.
이력 scope는 endpoint/module instance와 링크 ID 명부이다. UTC, hash,
sequence, request ID의 자연 변경은 출처·중복 판정이며 전체 이력을 지우지
않는다. 같은 링크의 다른 분석 입력 결과도 과거 기록으로만 보관한다.

지상 화면에서만 30초 타이머 하나를 설치하고 최초 진입에 즉시 조회한다.
이탈/종료는 타이머와 읽기 전용 조회를 취소하며 다시 진입하면 새로 조회한다.
기존 1초 분석 스케줄러는 그대로이다. 별도 상태 라벨은 모듈 조회 시점을
표시하며 통신망 수락과 구별한다. 선택한 링크의 과거 이력은 원본
drawSparkline으로 그린다. 실제 RF 또는 현재 사용 가능 상태라고 부르지
않으며 이력이 없으면 미확인이다. 렌더링 중 외부 콜백 예외와 중첩 갱신은
현재 화면 ticket을 확인해 새 화면을 덮어쓰지 않는다.

필수 RED: busy 조회가 명령 promise를 반환하지 않음, review/conflict 보존,
foreign instance/hash와 endpoint 늦은 응답, abort/숨김/재진입/종료, 명령
도중 polling 침입, 한 timer/중복 조회, 49개→48개와 입력 사본, 미확인 값은
0이 아님, 자연 UTC의 과거 보존/현재 수락 만료, endpoint와 instance scope
정리, 원본 drawSparkline 연결과 현재 승인 버튼 유지. 기존 exact 경로와
전체 회귀를 수행한다. 미래 통과/3D station/OISL route/N018은 계속 미완료.
