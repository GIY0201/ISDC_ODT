# T148 통신선과 정성적 흐름 표시 부분 검증

범위: 원본 NodeScene의 통신선 표시를 native 조회 버퍼 기반 NodeScene으로 이식. 전체 T075~T084와 실제 OISL 계산 연결은 완료하지 않았다.

- 원본 commit 1a1e00297a0301637455b0ef2cf48b2e74576b07. NodeScene SHA0a64617def9394bf25414321a30c66f210957bb4d61c494df7c9197359e6f9c6, shader SHAe20347895e3aa3913bb711bc856c547060d163c3c4624e7db8e7b7f8762c3b24 검사 후 원본 클래스 실행.
- capture_original_node_links.mjs 두 결과5617bytes/SHA6ebca8ac66768b4ca0b3e0f9d6e5225470eb417a0787cb72e301ca99939f2407 동일. Cesium doubles와 통제된 render-animation time 구성요소 증거이며 실제 GPU나 통신량 증거가 아니다.
- 원본7개 상태 색상/material/width2/점선12/flow spacing96/rate1.4/phase continuity/hidden and missing endpoint freeze/cleanup 대조. Shader 원문 bytes 보존.
- 회귀시험 먼저 추가: 기존16PASS/신규5FAIL(setLinks 부재). 이식 후 stale/morph phase 시험에서 부동소수점 literal9.8 비교1FAIL; 원본과 같은7000/1000*1.4 표현으로 기대값 수정. 최종 target25PASS541.7998ms.
- 사본과 완전한 현재 정의/UTC/source/quality, 명시 verifier strict true, pair/key/endpoints/state/중복, wrong-frame UTC, nonfinite phase, context 변경 verifier, scope edits, failure endpoints, foreign cleanup 시험. Undefined/false/throwing verifier는 선을 생성하지 않는다.
- 전체 Node533PASS2983.1631ms. 전체 Python546PASS8기존warnings154.07s(session42056terminalexit0). syntax/diff checks PASS.

원본 함수와 shader를 재사용했다. Renderer가 임의 통신 성공을 계산하지 않는다. T077 실제 verifier/native inertial r/LVLH basis 공급 N003은 별도 작업이다. 시험의 true callback은 실제 OISL 수락 증거가 아니다. T148은 path revision 효율화/남은 scoped cases 때문에 unchecked 유지. T079/T149~153/전체T076/T075~84/Terra/all50/N001/N003/T137인증/T032/장비/RF/HIL/다운로드/AeroDT 유지. 이번 변경은 8891서버/native 설치/사용자화면/원격PR/병합을 바꾸지 않았다.

Git index check found automatic line-ending conversion of shader bytes. Added scoped -text attribute, restaged original bytes and verified index/worktree SHA equality; original SHA test remains the portable checkout gate. Python unchanged after its full gate.
