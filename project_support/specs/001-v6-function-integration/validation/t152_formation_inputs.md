# T152 편대 입력과 실제 장비·공유 화면 검증

2026-10-06. 전체 T075–T084 목표 중 T076/T151/T152의 부분 검증이다.

## 확인한 결함과 수정
실제8891 화면에서 prefix와2면×3기 입력 후 명시 생성했지만 change/blur를 거치지 않은 입력이 controller에 전달되지 않아 기존ODT/4면×10기로 생성됐다. 기존 개별 초안NODE-0001은 변경되지 않았다. 잘못 생성된 검증용40기를 JSON으로 보존한 뒤 원래 편대 제거 버튼으로 그 편대만 제거했다. before_formation.json/formation_before_fix.json에 전후 정의를 보존했다.

숫자와 접두사 input을 실행 상태와 별개인 편집 초안으로 보존한다. 다른 필드 publish가 미확정 입력을 덮어쓰지 않는다. 명시 생성 또는 개별 추가 시 기존 change 검증/정규화를 통해 현재 입력을 확정한다. 빈 값은 이전 정상값으로 생성하지 않고 실패한다. 미확정 입력은 기존120ms live 재배치를 취소하며 다른 필드 변경도 이 작업을 다시 예약하지 않는다. 프리셋 또는 다른 편대 채택은 해당 편집 초안을 정리한다. 동역학, native API, 저장 형식, 장비 계산식과 배치 권위는 변경하지 않는다.

회귀시험: 명시 생성40!==6 RED 후 수정; 빈 초안 도중 다른 입력 변경이 live 작업을 다시 예약하는1!==0 RED 후 추가 수정. 수정 후 전체Node687PASS5004.2388ms. 기존 원본 형상/프리셋/golden 비교와 손상 저장/배치/지구 시험을 유지한다. 전체Python650PASS8warnings252.54s(session65808exit0).

## 실제 브라우저 관측
수정된 일반 새로고침 후 동일2면×3기/prefix 검증 입력으로 정확히6기 생성되어 기존1기와 함께7개 초안이 됐다. 검증-A1에 DTN 저장 전달 장치 추가/안전 모드 저장 후 이 노드만 편대에서 분리되고8개 장비 중 TT&C와GNSS만 켜졌으며 DTN/OISL은 꺼졌다. 소비133W는 원본 가정이며 실제 전력 측정이나 데이터 전달/HIL이 아니다. 나머지5기는 같은 편대를 유지했다.

satellite→scene→composer→satellite 실제 해시 전환 후 전체 노드 정의가 JSON 동일하고 Cesium canvas1개였다. 원래NODE-0001 정의는 before_formation의 사본과 완전히 같다. 두해상도1280x720/1920x1080 편집 화면과 저장된안전모드/모델을 관측하고 screenshot을 저장했다. 브라우저 console 새error 없음. 임시 정지 후 저장GP1배속 재생을 복원했고 viewport override를 해제했다. 서버 배치는GET만 수행했으며 명시 deploy하지 않았다. 검증 초안7개는 보존했다.

로컬 ignored 증거: data/workspace/validation/t151_live/{before_formation.json,formation_before_fix.json,formation_equipment_safe.json,formation_receipt.json,formation_1280.jpg,formation_1920.jpg,formation_full_node.log,formation_full_python.log}. DOM 텍스트와 사용자 입력을 통한 실제 관측이며 all240 GPU 성능/모든프리셋/전체장비/실제통신을 증명하지 않는다. 장비 editor의 운용모드 select가 getByLabel로 발견되지 않아 실제data-path로 선택했으며, label 연결 품질은 후속 검토가 필요하다.

T151/T152/T153 및T075–T084는 미완료 유지. 다음 실제4프리셋/배속·역방향/모드·장비/대규모편대/hover·morph/배치 실패와모든자산 검증을 계속한다. N001 multiwindow/T032 performance/T137auth/장비와RF/HIL/임무·데이터·보안·설정/파일bytes 및리뷰가 남는다.
