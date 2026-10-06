# T151 node startup recovery and browser identities, partial

Actual node start catches damaged/deferred/denied storage errors and mounts the
original panel with visible error. Store exposes existing loaded readiness only.
Storage access is an injected lazy proxy so a denied localStorage property itself
cannot abort construction and later permission recovery can be retried. No memory
fallback after denied storage and no deletion/overwrite of damaged bytes.

Added explicit nodes-restore control routes retryRestore. One pending Promise
coalesces repeated clicks. Only a not-loaded store is loaded; current edited drafts
are retained. Existing deployment initialize/refresh GET is retried; no POST or
server acceptance is produced passively. Deploy/recall disable until store loaded
and existing server readiness permits. Disposed callbacks produce no writes.

browser_identity.js centralizes existing default IDs: native randomUUID with its
receiver, otherwise getRandomValues 16bytes with UUIDv4 version/variant bits, or an
explicit unsupported error. No timestamp/Math.random fallback or new state owner.
Stored orbit, catalog samples/scene/track/passes, solar, ground and RF controllers,
node samples/deployment/formation and equipment use the same helper. Injected
request IDs remain unchanged. It is correlation/editor identity, not authentication.

Beforecode RED missing loaded getter, startup rejected malformed draft, and missing
identity module. Tests verify unchanged malformed bytes/no writes; safe denied
property then recovered access; single-flight server GET retry with edited draft;
UUID receiver/byte reference/version/variant/unsupported capability. Actual V6
assembly modules with DOM/Cesium/HTTP boundaries at1280x720/1920x1080 show error,
retry same mounted control without writing/deploying, then add/edit equipment with
only getRandomValues available. Source store rules and pinned transitions retained.
Two earlier data-URL isolation fixtures needed real helper import resolution;
no behavioral assertions were weakened. No live HTTP/browser or GPU claim.

Final fullNode663PASS4574.3132ms. FullPython649PASS8existingERFAwarnings211.99s, session77831exit0. ADR0020. Native installation/root/live8891 and
remoteGit unchanged. T151/T152/T153/N005/fullT075-T084 remain open, including
hover facts/scene composer/live acceptance/Terra/allassets/N001/T032/T137auth/
equipment/RF/HIL/filebytes/review. No new branch.

Syntax/git diff --check pass. Actual isolated receipt data/workspace/validation/install/2935f60dbf35453e8aecdaf7f92432aa/isolated_call.json:60native/selectedposes/source numeric5.4569682106375694e-12/time0ms/equality+verifiertrue; wheel SHA d6a62057b9cd62e5c37b3bad18473aa08c6514952c18770211f10c24ecb1bc97. No actual8891/native-root installation/remoteGit/newbranch changes.
