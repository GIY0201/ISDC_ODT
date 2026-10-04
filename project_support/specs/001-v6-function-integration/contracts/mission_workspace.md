# W04 기존 임무 계약
GET /api/bootstrap -> missions 사본. POST /api/missions/action {mission_id,action:start|pause|replan|abort|complete} -> mission.
POST /api/missions/tasks {mission_id,operation:create|update|delete,task_id?,lane?,name?,start?,duration?,status?,predecessor?,priority?} -> {mission,validation}.
GET /api/missions/{id}/validate -> validation. POST /api/missions/replan {mission_id,apply:false|true} -> {mission,applied,diff,validation}.
기존 400/422 및 응답을 보존한다. UI는 null predecessor와 빈 문자열의 차이, preview 현재 validation, SIM 시간축 의미를 보존한다. 미리보기 적용의 원자성/버전 전제조건은 기존 API에 없으며 자동 재시도를 하지 않는다.
