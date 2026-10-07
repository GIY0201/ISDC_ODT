# native 미래 통과 표시 계약

ADR0052, N017g/h. createFuturePasses({api,inputs,readDisplay,codec,nextRequestId,onChange})
는 실제 N017f input owner를 사용한다. api.nodeMissionWindows만 호출하고
contextHash/accepted_context/임무·fabric/SIM 명령 경로를 사용하지 않는다.

- setActive(boolean): 활성 진입에서 observe, 비활성은 즉시 취소·숨김.
- selectStation(id): 명시 활성 지상국으로 즉시 조회. null만 첫 enabled fallback.
- refresh(): 전체 실제 입력으로 고정3시간 조회, generation/AbortController 소유.
- observe(): 기존 owner 표시 이벤트 기반 최초/입력변경/strict absΔDateUTC>60000
  갱신. 대기 중 자연 이동은 추가 parallel 조회 없이 직렬 완료 후 최신 관찰.
- presentation()/verifyPresentation(value): privately registered frozen
  FUTURE_PASSES_UI_V1과 전후 actual input/display 증명. clone/fake는 false.
- snapshot(): 진단 사본. authority로 사용하지 않음.
- cancel()/destroy(): 이전값·늦은 결과·오류·finally·재진입 철회. cancel은 같은
  입력/시각의 자동 재시작을 막고 refresh/선택변경/재진입으로 명시 재개한다.

정확한 input token 분석 UTC, 전체 accepted<=240 nodes, 단일site와10800초,
target/external/max_external_range_km:null을 보낸다. 요청ID·원본 full 정의·전체
64hex hash·조건·contact/eclipses native metadata와 sampling·모든행·한계를
검증한 뒤 명부순 위성별첫3→stable AOS first12. duration/live/age는 검증된
UTC에서 유도한다. flags live는 start<=실제display<=end를 포함한다.

필드: presentation_kind,status,availability,analysis_utc,display_utc,end_utc,
age_seconds,station,satellite_count,rows,coverage,communication_status:'unknown'.
조회 대기 중 자연 연속성의 기존 검증 결과만 age와 pending으로 유지할 수
있으며 어떤 action/mission approval도 주지 않는다. 실패·철회는 미확인.

순수 missions/native_contact_bundle.js 검증은 기존 승인 contact 서비스에서도
재사용한다. 승인 서비스의 context/currentness/24h/allsite 검증은 보존한다.
새 표시 조회만 eclipse 필수·단일site·fixed3h·accepted_context 부재를 요구한다.
원본 builder/access/crosslink와 승인50개 페이지는 변경하지 않는다.

ground_network optional futurePasses 포트는 별도 future-pass-* UI만 사용한다.
패널은 한 번 읽은 presentation을 전후검증해 렌더링한다. OISL 미확인은 이
독립 표시를 제거하는 이유가 아니다. 기존표시·편집·runtime 및 포트8891 유지.
