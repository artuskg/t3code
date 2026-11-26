import { describe, expect, it } from "@effect/vitest";

import { commandRunsRemoval } from "./RemovalCommand.ts";

describe("commandRunsRemoval", () => {
  it.each([
    "rm -rf data",
    "/bin/rm -rf data",
    "cd /tmp && rm x",
    "rmdir out",
    "xargs unlink < list",
    "find . -name '*.o' -delete",
    "sh -c 'rm -rf x'",
    "\\rm -rf x",
    '"rm" -rf x',
    "rm$IFS-rf x",
    'r""m -rf data',
    "r\\m -rf data",
    "'r'm -rf data",
    "$'\\x72m' -rf data",
    "$'\\162\\155' -rf data",
    'r$""m -rf data',
    "r\\\nm -rf data",
    "r\\\r\nm -rf data",
    '"r\\\nm" -rf data',
    "find . -de\\\nlete",
    "fi\\\nnd . -delete",
    "/usr/bin/find . -delete",
    "/bin/find . -name '*.o' -delete",
    "x{,}; {rm,-rf,data}",
    "RM -rf data",
    "/BIN/Rm -rf data",
    "rm>/dev/null -rf data",
    "rm<list",
    "=rm -rf data",
    "alias x=rm; x -rf data",
  ])("matches %j", (command) => {
    expect(commandRunsRemoval(command)).toBe(true);
  });

  it.each([
    "docker run --rm alpine true",
    "ls -la",
    "echo {perm,form}",
    "ls {src,test}/*.ts",
    "printf 'arm\\n'",
    "git commit -m 'format the firmware'",
    "awk '{print $1}' file",
    "echo {a..z}{a..z}{a..z}{a..z}",
  ])("leaves %j alone", (command) => {
    expect(commandRunsRemoval(command)).toBe(false);
  });

  it("treats a command too long to check as a removal", () => {
    expect(commandRunsRemoval(`echo ${"x".repeat(8_192)}`)).toBe(true);
  });

  it.each(["x", "=x", "'a", "(a", "=/", "{a,", "$'x", "find "])(
    "still checks an 8 KiB run of %j",
    (unit) => {
      const command = unit.repeat(Math.ceil(8_192 / unit.length)).slice(0, 8_192);
      expect(commandRunsRemoval(command)).toBe(false);
    },
  );
});
