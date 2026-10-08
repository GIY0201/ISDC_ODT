# PostgreSQL workspace configuration operations

현재 설치: PostgreSQL 18.6, Windows EDB binary distribution. DB는 127.0.0.1:5432에만 바인딩하며 isdc_workspace를 사용한다. 프로젝트 Python 환경에 psycopg 3.3.6을 설치했다. DB 관리자와 앱 계정은 분리했고 비밀번호는 출력하지 않는다.

## 경로와 시작

바이너리: project_support/tooling/postgresql/pgsql/bin (Git 제외).
클러스터/접속 설정/로그/백업: data/workspace/postgresql (Git 제외, 현재 OS 사용자 접근만 허용).
연결 설정: connection.json의 app 및 admin 항목. 파일을 공개하거나 웹 정적 경로로 옮기지 않는다.
로그인 예약 작업 ISDC-PostgreSQL은 현재 사용자 로그온 때 DB를 시작한다. 시스템 부팅 전 사용자 로그온 없이 실행하는 Windows 서비스는 아니다.

```powershell
./project_support/tooling/start_workspace_database.ps1
project_support/.venv/Scripts/python.exe project_support/tooling/workspace_database.py status
project_support/.venv/Scripts/python.exe project_support/tooling/workspace_database.py backup
project_support/.venv/Scripts/python.exe project_support/tooling/workspace_database.py verify
```

verify는 새 시험 DB에서 백업을 복원한 뒤 설정과 변경 이력의 값을 비교한다. 생성한 시험 DB만 삭제하고 기존 DB는 유지한다. dump와 roles.sql은 함께 보존한다. role 파일에는 인증 정보가 포함되므로 백업 폴더 접근 제한을 유지한다.

## 바탕화면 실행 파일

바탕화면의 `ISDC 서버 실행.bat`를 더블클릭한다. 이 파일은 저장소의 `project_support/tooling/start_workspace.bat`를 호출하며, PowerShell 실행기가 기존 PostgreSQL/웹 시작 스크립트를 사용한다. 비밀번호는 배치 파일에 넣지 않는다. 기동 성공 시 접속 URL이 나오고, 결과 창을 닫아도 별도로 시작된 서버는 유지된다.

실행 중인 8891 서버가 있으면 앱 식별과 PostgreSQL 실제 설정 조회를 확인한 뒤 중복 기동하지 않는다. 다른 앱이 포트를 점유하거나 DB 조회가 실패하면 오류를 표시하며 프로세스를 종료하지 않는다. 동시에 실행한 기동 요청은 잠금으로 차단한다. 웹 준비 응답을 최대30초 기다리고 실패하면 로그 위치를 안내한다.

이 배치 파일은 서버 시작용이며 자동 부팅 서비스나 실행 상태 복원 도구가 아니다. 서버를 새로 시작하면 새 SIM이 생성된다. PostgreSQL의 지상국·작성 시나리오 정의는 유지된다. 프로젝트를 이동하면 바탕화면 배치 파일의 호출 경로를 갱신한다.

## 웹 연결과 기존 데이터

start_workspace_app.ps1은 같은 8891 포트가 비어 있을 때만 실행한다. 기존 서버를 자동 종료하지 않는다. ISDC_DATABASE_CONFIG로 접속 설정 경로를 전달하고 제품의 stored orbit factory를 사용한다. 기본 startup은 새 SIM을 만들므로 기존 시험 상태를 보존한다고 해석하지 않는다.

2026-10-07 사용자가 실행 초기화를 명시적으로 허용한 뒤 8891 웹 서버에 DB 연결을 적용했다. 기존 40기 배치는 초기화했으며 저장 궤도 선택을 복원했다. 기존 서울을 포함한 지상국 4개와 UI 검증용 시나리오 TEST-001의 DB 저장 및 새로고침 복원을 확인했다. 실제 설정과 변경 이력의 백업/별도 DB 복원 비교도 통과했다(20261007T143506Z).

DB 연결된 앱에서 브라우저 첫 로드는 서버 설정을 가져온다. 서버에 아직 정의가 없을 때만 기존 localStorage 내용을 초기 이관한다. 기존 로컬 값은 .before-postgresql 키로 백업하고 저장 대기/실패 값은 .pending-postgresql에 보존한다. 서버에 이미 설정이 있으면 해당 서버 버전을 사용하므로 다른 브라우저의 독립된 정의를 자동 병합하지 않는다. 보존한 브라우저별 정의의 병합은 검토 후 수행한다.

동일 프로젝트의 지상국과 사용자 시나리오 정의만 동기화한다. 사용자 입력/현재 상태/계산 결과 전체가 DB로 옮겨졌다고 주장하지 않는다. 시나리오 정의 저장은 장애의 실제 자동 주입 기능과 별개다.

## 나중에 다른 서버로 이관

1. 동일하거나 호환되는 PostgreSQL을 준비하고 현재 백업과 role 설정, 필요한 외부 파일을 안전하게 전달한다.
2. roles.sql과 workspace.dump를 새 DB에 복원하고 backup verify와 같은 값 비교를 수행한다.
3. 새 서버 접속 정보를 별도 connection.json에 기록하고 ISDC_DATABASE_CONFIG를 변경한다.
4. 최종 전환 시 쓰기를 잠시 중단하거나 최종 차분을 반영한 뒤 화면 저장/새로고침 복원을 확인한다.
5. 원본 DB와 백업은 전환 확인까지 보존한다. 설치 폴더를 이동하면 로그인 예약 작업의 경로도 갱신한다.
