# N019 원본 선택 지상 링크 → 기존 RF 계산기 입력 연결

ADR0056/계약 사전 독립 분석 HIGH0/CRITICAL0 후 RED-first로 구현했다.
원본 communication.js linkDetail 및 calculateBudget의 11필드 변환을 재사용하고,
기존 RF API와 계산식은 변경하지 않았다. 현재 등록된 native 지상 링크에서
명시적 버튼으로 기존 RF 패널의 편집 가능한 초안을 채운다. 자동 계산/전송은 없다.

완전한 S/X/Ka 입력만 허용하며 module 결과에 섞인 과거 geometry로 native 값을
덮어쓰지 않는다. 분석/표시 UTC 및 장비 미확인을 표시하고 기존 범위 검증을
유지한다. 선택/해제/파괴/callback 변경과 늦은 RF 결과는 초안을 덮어쓰지 않는다.
수동 편집 또는 공식 주파수 적용 시 이전 선택 링크의 출처 안내를 제거한다.

원본 11필드/초안/프로필 및 실제 root DI 관련7묶음50PASS445.1562ms,
ground 관련68PASS536.747ms, 독립 ground12개 검토 통과.
전체 Node1878PASS0FAIL0SKIP26050.4651ms(exit0),
`data/workspace/validation/full_N019_node.log`. Python 전체 결과는 최종 기록 참조.
1920×1080/2560×1440 root 조립 시험은 fixture 증거이며 실제 물리 화면 증거가 아니다.

실제8891 브라우저의 native 표시가 EOP 범위 오류로 막혀 있어 실제 화면의
선택→RF 입력→수동 계산 전 과정을 완료했다고 기록하지 않는다. T171 실제 화면
수용 및 장비/RF 운용 검증은 미완료이며, 전체 목표/PR 완료를 뜻하지 않는다.

Final N019 full regression: Python967PASS1existingPillowSKIP8existingERFAwarnings272.95s exit0; data/workspace/validation/full_N019_python.log. Node1878PASS0FAIL0SKIP26050.4651ms exit0. No product edits during this full run. Whole live/GPU/PR gates remain open.
