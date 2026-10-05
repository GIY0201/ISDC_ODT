# T147 native node display coordinator (component complete)

Original fullT075–84 scope and current feature retained. Existing createNodeTimeline/createNodeTrackTimeline/source period/native receipt decoder/UTC codec reused. createNodeDisplayTimeline has setDefinitions/observe(sharedUTC,{seek})/retry/clear/geometryFor/pathFor/snapshot/destroy. There is no private clock, RAF/interval, deployment command or timed JavaScript propagation.

One client runner awaits each complete sample/track operation before another starts. All240 definitions use83/83/74 sample chunks, atomically accepted before one29040row track request. Track response hashes must match sampled definitions. Context changes abort both concrete signals and invalidate both generations. The runner still waits for the old transport to settle, including an injected transport ignoring abort, before starting the new scope. Latest supplied UTC wins while a request is pending. Explicit seek clears old geometry and paths immediately; disposal never starts late work.

Sample lookahead uses the fixed half-buffer boundary: forward elapsed>=300 requests oldstart+300, backward elapsed<=300 requests oldstart-300. The old complete buffer remains only until the matching whole background candidate commits. Outside the current range, query starts at current UTC for forward playback and currentUTC-600 for reverse playback. No extrapolation occurs. Pause/readonly access makes no request. Sample errors latch across moving frames until explicit retry/context reset. Track errors hide tracks independently and retain valid sampled geometry; automatic retry stays latched.

Regression fixes:

- Leap display caused the scheduler's Gregorian track comparison to clear valid SI sample buffers. RED8PASS1FAIL; track failure now remains local and the original unsupported_node_time sample row survives at :60.
- Definition epochs used the display leap-table validator and rejected native-supported Gregorian epochs before1972. RED12PASS1FAIL; normal string epochs now use explicit Gregorian calendar validation, retaining submillisecond fractions and +00:00. Known leap epochs still require the frozen codec and retain native errors; malformed leap/calendar/year-zero inputs fail. Display SI/UTC validation is unchanged. Three corresponding Python prepare_node_definitions cases executed and accepted; no server model change.

Evidence:

- Missing coordinator export RED before product edits; first8PASS189.4601ms.
- Coordinator11PASS1346.0618ms including full240 pipeline/client max1 active transport, fixed pending prefetch, scope change with ignored abort, latest UTC, explicit seek/disposal and native hash mismatch.
- Final fullNode508PASS0FAIL0skip2798.805ms; original native mapping/GP/UTC/store/panel/track regressions included. Log data/workspace/validation/ground_stations/t147_display_node.log.
- Full Python546PASS8existingwarnings152.69s; session72615 terminal exit0. Explicit0.3.0 wheel/fresh short basetemp/cache. Python product unchanged; later JS-only epoch repair/helper rename/new regressions covered by final Node. Log data/workspace/validation/ground_stations/t147_display_pytest.log.
- Syntax and staged diff whitespace checks. Existing prerequisites/checklist8of8/hooks absent.

T147 local implementation criteria are met:601samples<=83chunks/full240 atomic publication/cancel/hash fences/121vertices/source period and TimeClip/30second refresh/shared supplied UTC/client serialization/prefetch/no per-frame HTTP. No actual browser scheduler/native transport/JSON/frame/GPU performance claim. Test executors prove cooperative calls only; the native server may continue an aborted operation and return explicit busy503 to a later request, so the client count is not backend cancellation evidence. Actual scheduling/cancellation/busy behavior and response costs remain T151/T152/T032.

Next T148 original NodeScene; T079 verified activation/T149–153 remain required before actual mount/accepted deployments/fullT076 closure. N001/N003/T075–84/Terra/all50/T137auth/equipment/RF/HIL/download/AeroDT remain. Existing port8891/native installation/browser/remote PR/merge unchanged. This component milestone does not complete the whole goal.
