# 0007 ISS 공식 수신 조건 부분 프로파일

2026-10-04. 승인 범위: ISS부터, 지상 장비 미선정. 공식 ARISS 공지 snapshot을 버전 모델 패키지와 read-only GET `/api/communication/iss-receive-profile`로 제공한다. 모델 JSON은 model_library에 두며 조립은 application, HTTP는 callback에 의존한다. import IO/외부 요청/runtime 변경 없음. manifest의 canonical UTF8 JSON SHA256으로 CRLF 차이에 독립적인 무결성을 검증한다.

현재 source가 확인하는 주파수만 명시적으로 적용한다. 빈값 unknown, 채워진 장비값 user_assumption, 적용 주파수 official_confirmed. 현재 운용/수신은 unknown. 동일 주파수 재적용도 과거 RF 결과를 폐기하고 수동/별도 창 편집은 공식 출처를 승계하지 않는다. 기존 RF 함수/API/schema 및 S/X/Ka 대표 모델을 변경하지 않는다. 실제 장비/도플러/복조/수신 검증과 F001 전체는 후속이다.
