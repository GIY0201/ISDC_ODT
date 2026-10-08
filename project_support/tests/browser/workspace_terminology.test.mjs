import test from 'node:test';
import assert from 'node:assert/strict';
import {presentOperatorText} from '../../../user_application/web/scripts/workspace_terminology.js';
test('operator labels use task language without rewriting identifiers or units',()=>{
 assert.equal(presentOperatorText('서버 최근 사건 (SIM)'), '모의실험 이벤트 기록');
 assert.equal(presentOperatorText('정상 임무 흐름'), '정상 운용 절차');
 assert.equal(presentOperatorText('SIM 일시정지'), '모의실험 일시정지');
 assert.equal(presentOperatorText('runtime.speed.changed'), '재생 속도 변경');
 assert.equal(presentOperatorText('RUN-904CE008D00B / NODE-0041 / 38.50 µs'), 'RUN-904CE008D00B / NODE-0041 / 38.50 µs');
 assert.equal(presentOperatorText('모의실험 일시정지'), '모의실험 일시정지');
});

test('presentation is idempotent for repeated dynamic renders',()=>{for(const label of ['시나리오 작성','시험 시나리오 작성','SIM 일시정지','선택 정의 불러오기','공용 상황판']){const shown=presentOperatorText(label);assert.equal(presentOperatorText(shown),shown);}});

test('EOP range errors explain an explicit recovery without changing timestamps',()=>{const text=presentOperatorText('error UTC outside EOP snapshot range');assert.match(text,/보정자료의 유효기간/);assert.match(text,/입력 기준 시각으로 복귀/);assert.equal(presentOperatorText(text),text);assert.equal(presentOperatorText('2026-10-06T22:37:13.663250000Z'),'2026-10-06T22:37:13.663250000Z');});
