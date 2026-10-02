# ADR 0005: 정확도 계약을 유지하는 batch 처리와 native 설치 검증

2026-10-03. T028/T029 구현. 기존 HTTP wire, runtime 소유권, WGS72_AFSPC와 TEME→ITRF 계산식 및 1초 visibility 탐색을 보존한다.

## 결정
UTC batch 파싱/포맷은 foundation, 저장 EOP의 벡터 보간은 data, 이미 검증한 UtcInstant를 전달하는 native adapter는 communication, EOP/geometry/native 조립은 user_application이 맡는다. 기존 scalar at 공급자도 주입 가능하다. 같은 UTC nanosecond/윤초/SGP4 quasi-JD, 오류 행/불변 buffer, snapshot hash 및 자료 범위 거절을 유지한다. geometry 입력 ndarray의 수치형 검사와 유한값 검사를 보존하며 반복적인 작은 배열 생성을 피한다.

가시성의 서로 독립적인 극값 bracket은 동일한 ternary 평가점을 round별 batch로 전달한다. 기존 40회/1e-6초 극값 보정, 0.01초 root bracket, 실패 행 분리와 contact 의미를 바꾸지 않는다. coarse grid, 임의 3구간 제한, 결과 캐시를 통한 측정 단축을 도입하지 않는다. 실제 하루 결과의 경계/peak를 수정 전 기록과 대조하는 회귀 및 기존 독립 oracle 시험을 유지한다. 이는 실측 정확도나 임의 고주파 함수의 완전성 증거가 아니다.

시각화는 지점 좌표가 같을 때 ConstantPositionProperty를 재사용한다. 서버 상태 사본 외에 새 상태 소유자를 만들지 않는다.

wheel은 날짜별 출력으로 이전 산출물을 보존한다. 선택 Python의 DLL 탐색 경로를 앞에 두고 wheel에 포함된 zlib을 설치 package hash/receipt와 대조하며 LICENSE/RECORD를 포함한다. 알려지지 않은 DLL은 빌드 실패로 남긴다. 지원 태그는 로컬 cp314-cp314-win_amd64이며 별도 venv의 -I 호출을 검증한다. 다른 PC/OS/ABI 및 자체 crate 대외 배포 license 선택은 F006에서 검토한다.

## 검증 경계
브라우저 계측은 validation=t028에서만 켜진다. RAF 간격과 입력 후 두 RAF의 보수적 presentation proxy, UI에 완료 결과가 생길 때까지의 지연을 원문과 함께 보존한다. 실제 GPU rendered frames나 물리 화면 주사율을 이 도구만으로 증명하지 않는다. 미달/불충분 조건을 성공으로 기록하거나 합의 목표를 완화하지 않는다. 성능 gate와 기능 회귀/격리 설치 gate는 구분한다.
