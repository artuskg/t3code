// Fork: Codex and Antigravity send no removal-safety signal, so match rm, rmdir, unlink and
// find -delete through paths, wrappers, quotes, escapes, shell -c scripts and $IFS splitting.
// It errs towards denying: git rm, npm rm and docker rm match too. Case-insensitive because
// macOS file systems are, so RM runs rm there.
const REMOVAL_COMMAND =
  /(?:^|[\s;&|(`'"\\{=<>!])(?:\S*\/)?(?:rm|rmdir|unlink)(?=$|[\s;&|)`'"$}<>,])|(?:^|[\s;&|(`'"\\{=<>!])find\s[^;&|]*\s-delete(?=$|[\s;&|)`'"}<>,])/i;

const LINE_CONTINUATION = /\\\r?\n/g;
const ANSI_C_QUOTED = /\$'((?:[^'\\]|\\.)*)'/g;
const ANSI_C_ESCAPE = /\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|[0-7]{1,3}|.)/g;
const BRACE_GROUP = /([^\s{}]*)\{([^{}\s]*(?:,|\.\.)[^{}\s]*)\}(\S*)/;
const BRACE_RANGE = /^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])(?:\.\.-?\d+)?$/;
const MAX_BRACE_PASSES = 8;
const MAX_RANGE_ITEMS = 128;
const MAX_EXPANDED_LENGTH = 200_000;

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

function braceAlternatives(body: string): readonly string[] {
  const range = BRACE_RANGE.exec(body);
  if (range === null) return body.split(",");
  const [, from = "", to = ""] = range;
  const numeric = /^-?\d+$/.test(from) && /^-?\d+$/.test(to);
  if (!numeric && (/\d/.test(from) || /\d/.test(to))) return [body];
  const start = numeric ? Number.parseInt(from, 10) : from.charCodeAt(0);
  const end = numeric ? Number.parseInt(to, 10) : to.charCodeAt(0);
  if (Math.abs(end - start) >= MAX_RANGE_ITEMS) return [body];
  const step = start <= end ? 1 : -1;
  const items: string[] = [];
  for (let value = start; value !== end + step; value += step) {
    items.push(numeric ? String(value) : String.fromCharCode(value));
  }
  return items;
}

// Brace expansion is lexical: {r,}m and {q..r}m are rm before anything runs.
function expandBraces(command: string): string {
  let expanded = command;
  for (let pass = 0; pass < MAX_BRACE_PASSES; pass += 1) {
    const group = BRACE_GROUP.exec(expanded);
    if (group === null) break;
    const [whole, prefix = "", body = "", suffix = ""] = group;
    const words = braceAlternatives(body).map((alternative) => prefix + alternative + suffix);
    expanded =
      expanded.slice(0, group.index) + words.join(" ") + expanded.slice(group.index + whole.length);
    if (expanded.length > MAX_EXPANDED_LENGTH) break;
  }
  return expanded;
}

// None of these change which program the shell runs: line continuations, $'...' escapes,
// $"..." and other quotes, backslashes and brace expansion. Undo them all and match again;
// this only adds matches, so it errs further towards denying.
function withoutShellSpelling(command: string): string {
  return expandBraces(
    command
      .replace(LINE_CONTINUATION, "")
      .replace(ANSI_C_QUOTED, (_match, body: string) => decodeAnsiC(body))
      .replace(/\$"/g, '"')
      .replace(/['"\\]/g, ""),
  );
}

export function commandRunsRemoval(command: string): boolean {
  return REMOVAL_COMMAND.test(command) || REMOVAL_COMMAND.test(withoutShellSpelling(command));
}
