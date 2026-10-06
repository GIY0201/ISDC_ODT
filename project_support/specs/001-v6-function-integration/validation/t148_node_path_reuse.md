# T148 native 궤적 결과 재사용 부분 검증

원본121정점 및 공용 UTC의30초 track refresh는 보존한다. 이전 제품의 매 update full path 복사와 Cartesian 재생성을 immutable accepted-buffer revision으로 줄였다. 실제 프레임 성능이나 전체 기능 완료는 주장하지 않는다.

- 회귀 먼저: 기존53PASS/신규6FAIL. revision getter 부재와240개 궤적의 반복 읽기, missing/changing revision stale 표시 확인.
- Buffer의 opaque frozen per-node reference, full-definition equality, 새 buffer identity, 사본 불변, 실제 track background/pending/acceptance/failure/cancel/dispose, shared-display forwarding 검사.
- 모든240개121점 궤적: 첫 full read240회; 같은 revision20update 이후 여전히240회. 새 revision시480회. Positions reference 유지/새 결과 교체, layer toggle/선택, missing/failure/reentrant revision 차단 검사.
- 실제 createNodeTrackBuffer에서 나온 reference/path를 NodeScene에 연결한 구성요소 시험: 초기2read 후30update에도2회; native failure buffer로4회와whole-path hide, buffer null때old line 숨김. 주입 rows/Cesium double이므로 실제 Rust/transport/GPU 증거가 아니다.
- Target60PASS1399.0408ms. 전체Node540PASS3148.9647ms. 전체Python546PASS8기존warnings155.13s(session46419terminalexit0). syntax/diff check PASS. 추가 통합시험에서 fixture callback이 path receipt를 받는데 node로 취급한 오류1FAIL을 node_definition 전달로 수정한 후 통과했다.

API/native 설치/8891서버/사용자화면/원격PR/병합 변경 없음. Revision은 JSON field/독립 시간/서버 수락/hash가 아니며 immutable presentation buffer의 비직렬화 식별자다. T148은 실제T077 verified OISL 주입 및 남은assembly 수용과 구분하며unchecked 유지. 다음T079 isolated-v1 module activation→T149–153로 연결한다. T075/Terra/all50/T076–84/N001/N003/T137auth/T032/장비·RF·HIL/다운로드/AeroDT 유지.
