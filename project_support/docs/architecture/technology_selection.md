# 개발 언어와 환경: 현재 첫 연결 검토안
2026-10-01. 기존 TypeScript/Vite 권고는미합의초안이며review_history에보존했다. 최신사용자합의는JavaScript/Cesium,Python API, Rust우선계산후보와실제성능검증이다.

| 영역 | 첫구현안 | 근거/범위 |
|---|---|---|
| UI | JavaScript ES modules + HTML/CSS | V6유지/기존정적배포재사용, TS/React/Vite보류 |
| Globe | CesiumJS1.143 기존기준선 | 공용viewer하나, serverITRF입력, 기존camera조작재사용 |
| API/조립 | Python3.14/기존FastAPI | 기존API시험보존, typed주입/현재상태runtime |
| 궤도전파 | Rust sgp4 2.4.0 WGS72/AFSPC | 공식시험 및C++수치일치, Rust가C++보다무조건빠르다는주장없음 |
| 연결 | PyO3 0.29.2 / maturin1.15.0 | 소유 버퍼의 batch 결과/읽기전용view, 9연결시험. 행별오류/OMM제품계약확장필요 |
| 좌표·가시성 | Python Astropy8.0.1/pyerfa2.0.1.5/numpy2.5.3 | 검증한Rust→Python조합과1초이내하루탐색. Rust좌표커널추가를첫필수조건으로만들지않음 |
| 자료 | 고정IERS B/윤초및궤도원문hash | offline재현,범위밖거절. 운영중자동네트워크변경없음 |
| 도구 | project_support아래venv/RustMSVC/buildtarget | 설치된실험환경보존,제품wheel/DLLlicense/다른PC는검증범위명시 |

Python및기존FastAPI의실제버전은구현첫환경task에서receipt와pinnedrequirements로동결한다. 새uv/pnpm전환을동작이식과섞지않는다. 현재Cp314wheel제품화부터검증하고추가ABI지원은후속. AeroDT와언어동일화보다typed계약/좌표·단위/파일책임을공유한다. 실제기능범위/작업순서는feature plan/tasks를따른다.

