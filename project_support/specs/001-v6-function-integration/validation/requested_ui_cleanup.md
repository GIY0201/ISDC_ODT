# 요청한 UI 표기 및 진단 도구 정리

사용자는 localhost:8891/?validation=t032 화면에서 자동 노출된 원시 성능 패널, 연구용 고정 시연 배지, 비어 있는 작업창 shelf, V6 시안과 V6/HTML 문구를 지적했다. 추가로 Data attribution 접근을 설정으로 옮기도록 요청했다.

## 구현과 검증

기존 workspace와 측정 도구를 재사용한다. validation=t028/t032 자동 설치를 제거하고 명시적인 성능 진단 버튼에서만 설치한다. 스타일과 닫기/재열기를 제공하며 기존 raw와 실행 중 프레임 trial은 유지한다. 닫힌 동안 관측하지 못한 계산 완료를 지연 결과로 기록하지 않는다. 관련 독립 리뷰에서 재현한 60초 오측정은 중단 event와 pending query 해제로 수정했다.

빈 shelf 전체를 숨기고 최소화하면 복원 버튼과 함께 표시한다. 복원하거나 닫으면 다시 숨긴다. 오래된 시안 표기 세 개를 제거하고 ISDC 브랜드와 실제 SIM/미확인 출처 표시는 유지한다.

Meaningful RED 2건 이후 기존 3개 가까운 suite 21 PASS. 측정 중단 문제 RED 후 22 PASS / 0 FAIL / 417ms. JS 문법과 diff 검사 통과. 독립 수정 후 리뷰와 실제 화면 smoke는 진행 중이다. 제품 계산/서버/native/저장 계약은 변경하지 않았다. 이미 완료된 전체 Node1996/Python967 회귀를 이 표시 변경으로 중복 실행하지 않는다.

## 출처 접근

Cesium 1.143 CreditDisplay.container는 공개 접근이고 showLightbox는 private이다. 기존 원본 expand-link를 설정의 명시 동작에서 사용하는 버전 고정 어댑터를 검토한다. 원본 출처 DOM을 복제하거나 필수 화면 출처를 전부 숨기지 않는다. 연결이 없으면 기존 하단 접근을 유지한다. 구현/검증은 T186에 별도로 기록한다.

공식 근거: https://cesium.com/learn/cesiumjs/ref-doc/CreditDisplay.html 및 https://cesium.com/learn/ion/content-usage-and-attribution-guide/

T185/T186 및 전체 이식 완료를 이 문서만으로 선언하지 않는다.

## 최종 좁은 회귀와 검토

환경 설정 버튼은 왼쪽 하단에서 기존 settings 작업창을 연다. 공용 지도/2D·3D/테마/위성 강조/태양 음영 설정은 기존 globe_view owner와 동일한 control IDs를 재사용하고 환경 설정의 최상단에 표시한다. 모듈 연결 설정·자료 출처·성능 진단은 그 아래에 모았다. 진단은 workspace owner의 단일 lazy recorder를 사용하여 설정 창 재진입 시 중복 설치하지 않는다.

Cesium 1.143 endFrame이 expand link의 inline display를 갱신하는 점을 확인했다. 어댑터가 소유한 정확한 expand link 클래스만 숨기고, 원본 logo/text/container를 유지한다. 연결 없음·비활성·unbind·destroy에서 기존 접근으로 복원한다. 실제 원본 클릭 handler를 재사용하며 private showLightbox를 호출하지 않는다.

최종 author 가까운 6개 시험군 42 PASS / 0 FAIL / 463.59ms, JS 문법과 diff 검사 통과. 독립 readonly 검토 CLEAN, 관련 47 PASS / 0 FAIL / 492.7834ms. 실제 브라우저 smoke와 전체 GPU·두 해상도·성능 검증은 진행 중이다. 기존 콘솔 legacy.html/app.js는 이번 수정 대상이 아니며 최근 변경도 없음을 Git에서 확인했다.

## 사용자의 설정 분류 정정과 밝은 기본 테마

모듈 연결 설정과 ICD를 DT 그룹의 integration 작업창으로 옮겼다. 왼쪽 환경 설정은 공용 지구 표시·자료 출처·성능 진단만 제공한다. 기존 source_settings 단일 controller, 저장 키, 선택 링크와 editor/mode 초안을 보존한다. 화면을 오갈 때 초안을 캡처하고 재조립된 DOM의 기존 listener를 정리한다. 별도 창의 st-* draft는 기존 view 일치와 settings_link 검사를 그대로 따른다.

공용 지구의 최초 choice.theme을 light로 변경했다. 명시적인 dark 선택과 초안 적용은 유지한다. 원본 계산, UTC, 배치, 서버 실행은 바꾸지 않는다.

Author 의미 있는 분리 RED12건과 기본 테마 RED1건 후 가까운6시험군35 PASS / 0 FAIL / 527.61ms. 독립 readonly 검토 CLEAN, 가까운4시험군32 PASS / 472.768ms. 문법·diff 검사 통과. 실제 수정 화면 smoke와 전체 T075-T083/게임 성능/두 해상도는 별도 진행 중이다.
