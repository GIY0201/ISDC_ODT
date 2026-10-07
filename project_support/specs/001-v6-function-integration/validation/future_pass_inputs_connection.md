# 미래 통과 입력 연결 검증

N017f는 선배 프로그램의 전체 배치 위성 통과 조회를 연결하기 위한 입력
경계이다. 기존 workspace owner에서 실제 서버 수락 명부, 선택한 활성
지상국과 분석 UTC를 불변 등록 값으로 읽는다. 이 단계는 미래 통과 계산과
목록 UI의 완료를 뜻하지 않는다.

실제 240개 노드를 기존 store와 배치 HTTP adapter로 수락한 뒤 전체 명부,
receipt, 지상국, 사본 위조 거부와 깊은 불변성을 검증했다. 초안 변경,
서버 불일치, 오류, 로딩, busy, 비활성·잘못된 지상국, 표시 source/UTC 변경,
projected SIM, 윤초 입력과 dispose를 거부한다. 자연 catalog 재생은 기존
owner가 발급한 연속성 증명으로만 허용하며 분석 시각을 고정한다. 기존
정지 임무 승인 조건을 완화하지 않았다.

저장 궤도, SIM 및 시나리오의 실제 제어 scope에 optional 관찰 callback을
주입했다. HTTP 응답 이후 실제 state adopt, bootstrap, refreshRuntime 및
busy 정리까지 대기하며, 같은 UTC 제어와 중첩·실패·폐기에도 이전 입력을
살리지 않는다. 기본 callback 미지정 동작과 요청 payload·요청 수를 보존한다.
GET 조회와 telemetry는 새로운 제어를 생성하지 않는다.

조회 callback은 실제 owner의 사본·증명을 반환하는 관찰 포트다. 허용된
상태 변경은 기존 철회 이벤트 또는 제어 scope를 거쳐야 한다. 실제 owner
이벤트 재진입과 반환 mode/readiness/lease 변경을 시험한다. 알림 없이 다른
owner 내부를 변경하는 임의 getter까지 유한 조회로 보장한다고 주장하지 않는다.

검증 이력:

- 초기 입력 API 누락 15개 RED → 전체 범위 시험 보완.
- 저장/SIM/시나리오 observer 5개 RED → 관련 85개 통과.
- 실제 root 조립의 callback 미연결 RED → 실제 저장 seek 및 SIM pause의
  bootstrap 대기·상태 반영 시험 통과. 시나리오 root callback 확인은 DI
  범위이며 실제 operation 수명은 별도 기존 owner 시험으로 확인했다.
- full-source/station 비교의 조건 우선순위와 관찰된 source/UTC의
  이동 후 복귀를 보완했다. 잘못된 지상국 validator 반환 누락도 RED 후
  수정해 선택하지 않은 지상국까지 거부한다. 최종 workspace 87개 통과.
- 독립 설계 분석은 세 번째 보완 후 통과했다. 코드의 최종 검토와 전체
  JavaScript 재검증 결과는 아래 최종 기록으로 확정한다.
- Python 전체 965개 통과, 기존 Pillow 의존 시험 1개 건너뜀,
  기존 ERFA 경고 8개, 233.65초, exit0. 마지막 JavaScript 지상국 오류
  반환 수정 전 실행했으며 Python 소스 변경은 없다.

Context7의 공식 MDN async/await·try/finally 문서를 조회해 정리 scope를
대조했다. 정확한 질의와 출처는 research_network_lifecycle.md에 기록한다.
문서 조회는 실제 제품 검증을 대신하지 않는다.

서버·현재 SIM·수락 배치·포트·Git 브랜치를 교체하지 않았다. 실제8891
지상국 초점 검증은 입력 UTC 미확인으로 세 번 시도 후 미완료로 남겼다.
별도 화면의 과거 품질 문구 차이와 전체 모델 GPU/성능 수용도 열려 있다.
N017g의 기존 native API 조회, N017h의 원본3시간/위성별3/첫12/60초초과
갱신과 현재 통과 표시, mixed route 및 N018, 전체 T075–T084/T032는 계속 남는다.

최종 기록: 독립 수정 확인의 집중 27개 및 잘못된 지상국 1개 통과,
현재 N017f 범위의 추가 차단 결함 없음. 최종 JavaScript 전체 1565개 통과,
실패·건너뜀 0개, 23841.0923ms, session93803 exit0. 로그는
data/workspace/validation/full_migration_node_N017_future_inputs.log와
full_migration_python_N017_future_inputs.log이다. whitespace 검사 통과,
extensions.yml 없음으로 실행 전·후 hook 없음. T154/T155만 완료한다.
