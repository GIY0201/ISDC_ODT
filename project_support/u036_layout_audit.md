# U036 layout audit evidence

Date: 2026-10-08. Live page: http://103.218.163.201:8891. Read-only UI actions in a temporary hidden tab. Browser viewport 1280×720; normal and expanded work windows. No viewport override set by this auditor. No scenario, node, link, device, database, or simulation state was changed.

## Coverage

14 distinct tab/panel views across the assigned Trial, System and Settings groups were inspected. Internal System integration tabs count separately. Native scrolling used overlapping increments of roughly 70% of the scroll area height. DOM text supplemented visible inspection. 138 recorded scroll observations are in `u036_layout_coverage.json`; repeated final verification labels are not additional views.

| View | Actual scroll evidence (client / content → final scrollTop px) | Expanded content |
|---|---|---|
| 시험 환경 구성 | Initial nested editor 196 / 1684 → 1488. Final outer screen 487 / 2269 → 1782; expanded 487 / 2665 → 2178 | Shared node definition and server JSON. Inner node JSON 384 / 1497 → 1112; full text read |
| 내 시험 시나리오 작성 | Initial 395 / 741 → 346; final stacked layout with explanation 395 / 1227 → 830 (rounding within 2px) | 작성 시나리오와 실행의 연결 |
| 운용 시나리오 시험 | Initial 378 / 1602 → 1224; final expanded 378 / 1804 → 1426 | All four additional tools, run identity, base UTC, ICD record disclosures; remained open through updates |
| 모의실험 실행 및 기록 | Expanded window 573 / 1146 → 573; final normal window expanded 449 / 1467 → 1018 | All three run identity, received frame, time/fault explanations |
| 시나리오 시험 결과 | Initial 502 / 1101 → 599; final expanded disclosures 378 / 1264 → 886 | Identity, UTC and ICD record |
| KPI 분석과 결과 내보내기 | Initial 530 / 1275 → 745; final expanded 406 / 1515 → 1109 | Identity, source/received frame, calculation/raw sample |
| 시스템 연동: 연결도 | 302 / 636 → 333 (rounding) | All 18 module positions; scope/help disclosure read |
| 시스템 연동: 연결 목록, 편집 | List 302 / 1107 → 804; editor 302 / 362 → 60 | All 17 link rows and editor controls; no edits |
| 시스템 연동: 모듈 | 302 / 3948 → 3646 | All 18 module disclosures opened; full descriptions read |
| 시스템 연동: 인터페이스 명세 | 302 / 4680 → 4378 | All 8 ICD disclosures opened and all tables read |
| 지상 시스템 관리 | 597 / 597; hidden child content observed | Static legacy role view clipped its lower status rows. Reported to parent, who owns role-view consolidation |
| 장비 연동 시험 | 591 / 1823 → 1232 | All device rows, topology, checks, statistics and log region. Device actions not run |
| 공용 지구 표시 설정 | No vertical overflow in normal window | Common globe help opened/read; switch and map/solar controls inspected |
| 화면 설정과 자료 출처 | 424 / 424 → 0 | Appearance and attribution help read; performance help button exposed no additional text during audit |

## Changes in this audit

- The selected feature fits its available work area instead of expanding beyond the viewport. Nested static panels and node details no longer create inaccessible fixed-height sections.
- Trial introduction and node configuration share an outer scroll area; the introduction no longer leaves only 17px for the editor.
- Map layout uses the work window's width, with columns retained to 620px and stacking below that. Scenario/trial cards adapt below 760px. A narrow map is bounded to 280–360px high.
- Definition lists with grouped row elements preserve their own row structure. Only flat dt/dd lists receive the global two-column grid.
- Sticky table headings follow the selected workspace theme. Long table content wraps. Summary and textarea keyboard focus is visible.
- The resting clock collapses below an open work window instead of covering bottom buttons.
- Animated network flows respect reduced-motion preference.
- Catalog globe-position information button stays inline beside the clear button.

## Validation

- Five regression checks failed before the CSS changes (`u036_layout_red.log`). The updated map breakpoint check failed before its follow-up adjustment (`u036_layout_map_red.log`).
- Final targeted tests: 13 passed, 0 failed (`u036_layout_green.log`): workspace_content_accessibility, workspace_shell_presentation, work_window_layout.
- Scoped `git diff --check` passed (only line-ending warning).
- Parent is running repository-wide suites and auditing the other groups.
- Screenshots: `u036_trial_layout.jpg` (trial inspector fully reachable); `u036_authoring_layout.jpg` (stacked authoring form).

## Limits and follow-up passed to parent

This is a UI/readability audit, not validation of runtime, save/apply, device, or telemetry behavior. No live run was started or stopped. Empty record areas were inspected in their present state. The original clipped legacy ground-system view could not expose its hidden content through scrolling; parent was notified for consolidation. Live data can change counts and labels during inspection.

Settings solar status still displayed EOP/UT1 implementation details in the inspected u036 page; common globe help also retained catalog-page count wording. Parent owns their text cleanup. The final map 620px change and inline catalog information button are covered by source tests and parent live validation; this auditor did not revisit the ground/catalog groups, which belong to the parent. No viewport reset was needed; temporary audit tab was closed.
