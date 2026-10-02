# Orbit API v1: 입력/상태/선택/samples 구현, visibility 검토 계약
기존 endpoint/WS는 보존. 새 prefix /api/orbit. 공개 구현 전 ADR 기록.

## 공통
모든 시각은 timezone을 포함한 UTC ISO 문자열. 내부 jd1/jd2 보존. 모든 결과는 client_request_id, revision, input_id/hash, EOP/leap snapshot hash, profile, frame 및 단위를 포함한다. 권위선택은 runtime, query는 사본으로 계산. HTTP계층은 계산 구현을 직접 생성하지 않고 주입된 호출을 사용한다.

## GET /api/orbit/inputs
검증된 저장 입력 metadata 배열 반환: 식별자, 출처, epoch, 확보시각, hash, 형식, 적용 frame/time/profile. HTTP원문파일경로 노출 금지. 첫1위성, 저장TLE/OMM 형식 지원. 외부실시간 카탈로그와 별도.

## GET /api/orbit/state
OrbitSelection snapshot 반환. 처음 input 미선택 가능, revision0. 기존 SIM snapshot과 별도 계약.

## PUT /api/orbit/selection
입력: client_request_id, expected_revision, input_id, ground_point, minimum_elevation_deg, anchor_utc, playing, play_rate. 전체 설정검증 후 단일원자갱신, server revision+1. response selection snapshot. 서로다른 최신 변경은409 conflict 후 최신 snapshot 재조회. client_request_id는응답식별자이며 인증기능아님. 서버는시간순서도착을사용자의최종의도라고추정하지않음. 브라우저는 변경명령을직렬화/합치고 staleintent를보내지않는다.

## POST /api/orbit/samples
입력: client_request_id, selection_revision, input_id, start_utc, step_seconds>0, count(1..3601). revision/input이현재선택과맞아야함. 주입된 EOP범위검증 후 immutable 행 반환. query는현재UTC를변경하지않음. 운영기본 최대601행 prefetch(1초간격10분). private buffer는Python↔Rust경계에서만사용,wire는JSON ITRF m와고도각deg. JSON으로float NaN/Inf를전송하지않음. 행별오류는status/error_code와null값,부분오류를정상좌표로대체하지않음.

## POST /api/orbit/visibility
입력: client_request_id, selection_revision, input_id, start_utc,end_utc(0<범위<=24h),ground_point,minimum_elevation_deg. 반환: search range, intervals(start/end/peak UTC,max angle,clipped flags), contacts(duration0),status,provenance,communication_status=unknown. threshold와지점은snapshot선택과일치해야함. 없음은200 status=none, 실패와구별. 부분 실패가 있으면 탐지 범위 완전성 주장 금지.

## 오류 및 실행
422: 형식/NaN/시각/좌표/범위/상한 오류.404: 입력없음.409: revision충돌.503: 큐가득/native모듈미설치/EOP미준비. 계산 행오류는200 partial 가능, EOP범위밖은422 eop_out_of_range. native crash를성공으로숨기지않음.

최대worker2,대기2 configs 제안. asyncroute에서native계산/파일읽기직접block하지않는다. 주입된bounded executor 사용. AbortSignal은취소의도, 이미실행중nativecall강제중단보장없음. 이후chunk중단/늦은결과폐기/서버다른요청응답가능성은제품시험게이트.

예: satellite_id25544의 저장 input_id와UTC를선택한뒤samples조회,그context로globe/panel함께갱신. 시간선택이바뀌면새revision과request_id이전응답은무시. 매프레임full24hquery전송금지.


## 2026-10-02 구현 응답 형식
inputs: {inputs:[metadata],eop_sha256,leap_sha256}. state/selection: selection필드 flat + current_utc/observed_monotonic_s/input_hash/EOP·윤초hash/frame=ITRF/profile/units/communication_status=unknown. ground_point wire는 latitude_deg/longitude_deg/ellipsoid_height_m, virtual=true/ellipsoid=WGS84 선택기본값이다. metadata 입력frame은TEME이며query결과frame과구분한다. samples: client_request_id/revision/input_id/input_hash/rows[{utc,position_m,elevation_deg,error_code,status}]/hashes/stale/status/units/profile/frame. 전부실패error/일부partial/완료complete. 원본file/TLE본문은반환하지않는다. error.detail는code/message,409은state를함께반환. 형식validation.detail은type/loc/msg 배열이고불법NaN 원입력은echo하지않는다. visibility는아직미구현이며T021/T022대상.
