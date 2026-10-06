# ADR 0039: 데이터 없는 개발 SIM의 상태 보존 전환

새 HTTP 라우터 적용에 필요한 개발 서버 재시작에서 기존 SIM/run/elapsed/events/missions/devices를 잃지 않도록, 시작 전 runtime method와 명시적인 tooling factory를 제공한다. 정상 product factory는 자동으로 파일을 읽거나 복원하지 않는다. 입력 파일은 프로젝트 validation workspace 안의 캡처만 허용한다.

SIM mode, 등록 scenario, finite 시간·배속·counter, 같은 model roster와 이벤트를 검증한 뒤 기존 runtime owner를 한 번에 교체한다. 현재 시계가 실행 중이거나 수락 배치가 존재하거나 활성 장애가 있으면 거부한다. 원본 status API의 elapsed millisecond 정밀도로 복원하며 서버 정지 중 시간은 분석 시간에 더하지 않는다. GP는 기존 selection API로 별도로 복원하고, module instance의 과거 승인 증거를 복제하지 않는다.

장기 checkpoint/real hardware/accepted data deployment 복원 기능은 아니다. 향후에는 각 모듈의 실제 상태 export/restore 계약을 따로 검증해야 한다.


2026-10-07 추가: 검증용 배치를 명시적으로 회수한 빈 명부도 revision/deployment ID/scope를 검증해 복원한다. 비어 있지 않은 명부와 활성 장애, 이미 시작된 runtime은 계속 거부한다. 기존 빈 배치의 revision과 현재 ID를 기존 runtime owner에 복사하고 현재 ID 재사용을 차단한다. 과거 데이터 모듈/군집 예약의 복원으로 확대하지 않으며, 새 데이터 범위 시작은 현재 SIM 시각이다.
