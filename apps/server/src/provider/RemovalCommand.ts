// Fork: Codex and Antigravity send no removal-safety signal, so match rm, rmdir, unlink and
// find -delete through paths, wrappers, quotes, escapes, shell -c scripts and $IFS splitting.
// It errs towards denying: git rm, npm rm and docker rm match too.
const REMOVAL_COMMAND =
  /(?:^|[\s;&|(`'"\\{])(?:\S*\/)?(?:rm|rmdir|unlink)(?=$|[\s;&|)`'"$}])|(?:^|[\s;&|(`'"\\{])find\s[^;&|]*\s-delete(?=$|[\s;&|)`'"}])/;

const ANSI_C_QUOTED = /\$'((?:[^'\\]|\\.)*)'/g;
const ANSI_C_ESCAPE = /\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|[0-7]{1,3}|.)/g;

function decodeAnsiC(body: string): string {
  return body.replace(ANSI_C_ESCAPE, (_match, escape: string) => {
    const kind = escape[0];
    if ((kind === "x" || kind === "u" || kind === "U") && escape.length > 1) {
      return String.fromCodePoint(Number.parseInt(escape.slice(1), 16));
    }
    if (/^[0-7]+$/.test(escape)) return String.fromCodePoint(Number.parseInt(escape, 8));
    return escape;
  });
}

// Quotes and escapes don't change which program the shell runs: r""m, r\m, 'r'm and $'\x72m'
// all run rm. Decode $'...' and drop every quote and backslash, then match again. This only
// adds matches, so it errs further towards denying.
function withoutShellQuoting(command: string): string {
  return command
    .replace(ANSI_C_QUOTED, (_match, body: string) => decodeAnsiC(body))
    .replace(/['"\\]/g, "");
}

export function commandRunsRemoval(command: string): boolean {
  return REMOVAL_COMMAND.test(command) || REMOVAL_COMMAND.test(withoutShellQuoting(command));
}
