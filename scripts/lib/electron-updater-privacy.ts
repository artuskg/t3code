/**
 * Privacy fork stopgap: electron-updater keeps a persistent staging user ID in `<userData>/.updaterId`
 * and sends it as `x-user-staging-id` on every feed request. The desktop main bundle drops both;
 * staged-rollout percentages are then ignored (every rollout counts as reached).
 */
const APP_UPDATER_MODULE = /[\\/]electron-updater[\\/]out[\\/]AppUpdater\.js$/u;

const EDITS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\n\s*this\.stagingUserIdPromise = new lazy_val_1\.Lazy\(\(\) => this\.getOrCreateStagingUserId\(\)\);/u,
    "",
  ],
  [
    /async isStagingMatch\(updateInfo\) \{\n[\s\S]*?\n {4}\}\n/u,
    "async isStagingMatch(updateInfo) {\n        return true;\n    }\n",
  ],
  [
    /const stagingUserId = await this\.stagingUserIdPromise\.value;\s*client\.setRequestHeaders\(this\.computeFinalHeaders\(\{ "x-user-staging-id": stagingUserId \}\)\);/u,
    "client.setRequestHeaders(this.computeFinalHeaders({}));",
  ],
  [/ {4}async getOrCreateStagingUserId\(\) \{\n[\s\S]*?\n {4}\}\n/u, ""],
];

/** Throws when electron-updater's code no longer has the expected shape, so a bump can't slip by. */
export function stripStagingUserId(code: string): string {
  let next = code;
  for (const [pattern, replacement] of EDITS) {
    if (!pattern.test(next)) throw new Error(`electron-updater changed: ${pattern.source}`);
    next = next.replace(pattern, replacement);
  }
  if (/x-user-staging-id|\.updaterId|stagingUserId/u.test(next)) {
    throw new Error("electron-updater still carries a staging user ID");
  }
  return next;
}

export function electronUpdaterPrivacyPlugin() {
  return {
    name: "t3code:electron-updater-no-staging-id",
    transform(code: string, id: string) {
      return APP_UPDATER_MODULE.test(id) ? { code: stripStagingUserId(code), map: null } : null;
    },
  };
}
