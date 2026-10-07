# Native 미래 통과 연결 검증 — 실제 화면 수용은 진행 중

선배의 전체 deployed/선택 지상국/3시간/위성별 첫3/AOS 안정 정렬 첫12와
strict 절대 Date UTC 차이>60000ms 갱신을 기존 native API에 연결했다.
기존 승인 context·전체 지상국·24시간·50행 페이지 및 builder는 보존했다.
새 결과는 시각화 전용 등록 proof이며 실제 RF나 임무 승인으로 사용하지 않는다.

T156/T157 독립44PASS, T158/T159 독립69PASS. 이후 실패한 표시 proof의
UTC 이동·복귀/조회 오류·회복에 따른 재활성화를2RED로 재현하고 해당 등록만
영구 철회했다.18owner와 관련64PASS. 실제 root DI와 두 해상도 조립, 승인
목록·편집 보존, 활성화 재진입·종료·재마운트·외부 설정 충돌을 시험했다.
최종 전체 Node1624PASS0FAIL0SKIP22504.7643ms(exit0, session30127).
로그 data/workspace/validation/full_migration_node_N017_future_passes_immutable.log.

test_future_pass_native_http.py의 실제 TestClient→NodeGeometryQuery 기본
설치 Rust0.3.0→기존 MissionWindowQuery→JS createFuturePasses 검증은1PASS
22.88초이다. 실제240개/3시간/단일site의135개 원시 통과를 전부 검증하고
원본3/12로 표시했다. 숨겨진 잘못된 contact/eclipse와 accepted_context
응답을 거부했으며 조회 전후 궤도 상태가 동일했다. 입력 등록 fixture를
사용한 생산 API/계산/owner 연결 증거이며 실제8891의 수락 배치 증거는 아니다.

첫 전체 Python 실행은802PASS1기존SKIP8warnings164setupERROR229.86초였다.
오류는 없는 --basetemp 상위 폴더의 pytest mkdir(parents=False) WinError3로
독립 재현했다. 상위 폴더 생성 후 같은 카탈로그8PASS. 원본 실패 로그를
보존했다. 절대 경로/새 상위 폴더의 전체 재시험은966PASS1기존PillowSKIP
8기존ERFAwarnings270.32초(exit0, session88131)로 완료했다.
로그 full_migration_python_N017_future_passes_corrected.log.

Aside 실제 격리 화면은 GPU 검증용 초안1/수락0/UTC없음 상태여서 조회를
보내지 않고 미확인을 표시했다. 서버의 기존40개/revision6은 readonly로
확인했지만 이것을 브라우저 수락 proof로 대체하지 않았다.417 PNG는 상단만
보여 새 영역의 픽셀 수용에 사용하지 않는다. 실제 두 해상도/수락 배치/통과
목록 수용은 계속 진행 중이다. 원본SIM·배치·입력과8891을 보존했다.

Context7의 공식 Cesium 모델 최소 픽셀/최대 배율/bounding sphere/카메라
문서를 조회했다. 문서나 model_ready·작은 marker만으로 GPU 성공을 주장하지
않는다. 전체 N017 혼합 경로/N018, T075–T084/T032/GPU/실제 화면/PR은 미완료다.
