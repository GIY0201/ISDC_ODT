# Workspace contract

UI hash: wall, normal, initial, exception, mission, operations, satellite, ground, data, security, facility, em, scene, composer, run, compare.
Aliases: orbit -> satellite; communication -> ground; analysis -> compare; hil -> em.
Unknown hash -> wall.
Mapping: satellite/scene/initial/run -> orbit; ground -> communication; mission/normal/composer -> mission; operations/exception/data/compare -> analysis; em -> hil; security/facility -> 미연동 설명.
모든 API와 WebSocket은 기존 communication/browser/api.js를 통해 호출한다. wire schema와 계산식 변경 없음.
V6의 업무 진입점과 기존 기능은 같은 의미라고 주장하지 않는다. 각 작업에 연결 범위와 미지원 조건을 표시한다.
GP 위치와 SIM 텔레메트리는 동일 위성 실측으로 결합하지 않는다. EM 작업은 MOCK-HIL이다.
별도 창은 현재 작업 hash와 popout=1을 포함한다. 서버 runtime을 공유하고 선택 UI를 복제하지 않는다.
