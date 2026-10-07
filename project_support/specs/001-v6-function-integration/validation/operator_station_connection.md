# 운영 지상국 선택·초점 연결 검증

선배 기준 커밋 `1a1e00297a0301637455b0ef2cf48b2e74576b07`의
communication 화면에서 단일 클릭 선택, 더블 클릭 선택/초점 및 flyTo
높이 2400000m/duration1.4s를 대조했다. 운영 지상국은 기존 sourceGround
설정을 사용하며 GP 관측 지점·공용 UTC·SIM 상태를 복제하거나 바꾸지 않는다.

ADR0050/계약/명세/계획/모델/작업/quickstart를 코드 전에 작성했고 독립
분석의 owner capture와 거절 후보 fallback 두 지적을 보완한 뒤 진행했다.
새 renderer 등록 증명, 기존 하나의 globe 입력 handler와 명시 초점 버튼을
연결했다. hidden/invalid/removed/replaced/morph/dispose와 편집 충돌은 선택
권한을 철회한다. 일반 unchanged redraw만 등록 증명을 유지한다.

실패 시험에서 숨겼다가 다시 보인 coverage token, 마지막 검증 실패 뒤
살아난 token, scene mode getter 중 권한 철회, 마지막 station 입력 확인 중
편집 충돌을 각각 재현하고 수정했다. ground 활성 여부와 sampled 지원은
다르므로 현재 UTC의 검증된 exact geometry를 우선하도록 수정했다.

실제 조립 시험에서 별도 오류도 찾았다. sampled 결과가 없는 읽기 전용
조회가 null permit 비교로 정상 exact 결과를 삭제했다. 실제 optical/source
producer 회귀시험에서 실패를 재현하고 null permit으로 exact 결과를 삭제하지
않도록 수정했다. 실제 workspace/store/renderer/globe와 정상 계산 버튼을
사용하는 1920×1080, 2560×1440 시험이 선택·명시 초점·공용 입력 보존을
확인했다. HTTP/DOM/Cesium 어댑터 시험이며 실제 GPU 검증은 아니다.

독립 검토: renderer 38개, globe 29개, 최종 null permit/품질 설명 36개
통과. 품질 정보가 없는 실제 화면 receipt349의 빈칸은 유효망 없음·링크
미선택·선택 링크 소실·수락 이력 없음으로 구분해 설명하도록 수정했고 네
실패 시험을 추가했다. 임의 품질 이력이나 자동 fabric 전송은 없다.

전체 Node: 1529 PASS, 0 FAIL, 0 SKIP, 23850.9712ms, exit0.
전체 Python: 965 PASS, 기존 Pillow 의존 시험 1 SKIP, 기존 ERFA 경고 8개,
239.50초, exit0.
로그: data/workspace/validation/full_migration_node_N017_station.log 및
full_migration_python_N017_station.log. null permit RED 로그는
network_exact_readonly_sampled_red.log에 보존했다.

Context7 실제 Cesium 공식 docs 조회 및 출처는 research_network_lifecycle.md에
기록했다. 최신 문서와 대조하되 Cesium 의존성을 임의 업그레이드하지 않았다.
실제8891 Aside 후속 검증은 기존 격리 탭에서 진행 중이다. 이전 receipt349는
1440×900의 모듈 조회/fabric 분리만 수용했고 품질과 두 번째 해상도는 미확인이다.
새 코드 실제 화면·GPU·미래 통과·경로·N018 및 전체 T075–T084 수용은 열려 있다.

새 Aside DOM receipt357도 직접 확인했다. 실제1440×900 격리 지상 화면에서
`과거 모의 링크 품질 미확인 · 검증된 통신망 결과 없음`과 별도 모듈 조회
설명이 표시되고, history는 숨김이며 send/route는 비활성이다. source 폼과
서버 실행의 변경 없는 후속 검증을 계속한다. 첫 screenshot은 CDP timeout으로
실패했으므로 DOM receipt를 GPU/두 해상도/실제 클릭·초점 수용으로 확대하지
않는다. 원본 receipt 경로:
`C:/Users/gwakinyong/.aside/u/0/sessions/2026-10-07_HRcJMUPbXDTsJAAN/artifacts/357-N017-fresh-readonly-status-explicit-quality-unavailable-current-native-DOM.json`.
