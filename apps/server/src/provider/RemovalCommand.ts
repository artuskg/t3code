// Fork: Codex and Antigravity send no removal-safety signal, so match rm, rmdir, unlink and
// find -delete through paths, wrappers, quotes, escapes, shell -c scripts and $IFS splitting.
// It errs towards denying: git rm, npm rm and docker rm match too.
const REMOVAL_COMMAND =
  /(?:^|[\s;&|(`'"\\{])(?:\S*\/)?(?:rm|rmdir|unlink)(?=$|[\s;&|)`'"$}])|(?:^|[\s;&|(`'"\\{])find\s[^;&|]*\s-delete(?=$|[\s;&|)`'"}])/;

export function commandRunsRemoval(command: string): boolean {
  return REMOVAL_COMMAND.test(command);
}
