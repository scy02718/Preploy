// Declaration shim for lucide-react.
//
// NOTE: This is an out-of-scope unblocker added during the /standup loop for the
// feedback-stale-return + feedback-page-flicker stories. The `lucide-react` package
// pinned at "^1.7.0" in apps/web/package.json resolves to an abandoned v1.x line
// that never shipped TypeScript declarations, causing `tsc --noEmit` to fail with
// 38 TS7016 errors across every icon-importing component.
//
// The proper fix is to upgrade lucide-react to the active line (^0.400.0+), which
// should be tracked as a separate infrastructure story. Remove this file when that
// upgrade lands.
declare module "lucide-react";
