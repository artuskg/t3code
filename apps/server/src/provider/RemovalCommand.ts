// Fork: Codex and Antigravity send no removal-safety signal, so match rm, rmdir, unlink and
// find -delete through paths, wrappers, quotes, escapes, shell -c scripts and $IFS splitting.
// It errs towards denying: git rm, npm rm and docker rm match too. Case-insensitive because
// macOS file systems are, so RM runs rm there.
const REMOVAL_COMMAND =
  /(?:^|[\s;&|(`'"\\{=<>!])(?:\S*\/)?(?:rm|rmdir|unlink)(?=$|[\s;&|)`'"$}<>,])|(?:^|[\s;&|(`'"\\{=<>!])(?:\S*\/)?find\s[^;&|]*\s-delete(?=$|[\s;&|)`'"}<>,])/i;

const LINE_CONTINUATION = /\\\r?\n/g;
const ANSI_C_QUOTED = /\$'((?:[^'\\]|\\.)*)'/g;
const ANSI_C_ESCAPE = /\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|[0-7]{1,3}|.)/g;

// The matching is quadratic on adversarial input, so a command longer than this counts as a
// removal: it is declined, never run unasked. At this length the worst case is under 0.1 s.
const MAX_CHECKED_LENGTH = 8_192;

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

// None of these change which program the shell runs: line continuations, $'...' escapes,
// $"..." and other quotes, and backslashes. Undo them all and match again; this only adds
// matches, so it errs further towards denying.
function withoutShellSpelling(command: string): string {
  return command
    .replace(LINE_CONTINUATION, "")
    .replace(ANSI_C_QUOTED, (_match, body: string) => decodeAnsiC(body))
    .replace(/\$"/g, '"')
    .replace(/['"\\]/g, "");
}

export function commandRunsRemoval(command: string): boolean {
  if (command.length > MAX_CHECKED_LENGTH) return true;
  return REMOVAL_COMMAND.test(command) || REMOVAL_COMMAND.test(withoutShellSpelling(command));
}
