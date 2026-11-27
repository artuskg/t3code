import { describe, expect, it } from "@effect/vitest";

import { faviconUrlForOrigin, toolActivityFaviconUrl } from "./favicon.ts";

describe("faviconUrlForOrigin", () => {
  // Fork: no Google favicon lookup, even for a public host.
  it("never builds a third-party favicon URL", () => {
    expect(faviconUrlForOrigin("https://github.com:8443/pingdotgg/t3code?private=query", 64)).toBe(
      null,
    );
  });

  // regression: #5838 no favicon request for missing or non-http origins
  it.each([null, "invalid URL", "file:///tmp/private"])(
    "rejects an invalid or unsupported origin %s",
    (origin) => {
      expect(faviconUrlForOrigin(origin)).toBeNull();
    },
  );
});

describe("toolActivityFaviconUrl", () => {
  it("never fetches a linked origin's favicon or GitHub's asset CDN", () => {
    for (const appearance of ["light", "dark"] as const) {
      expect(toolActivityFaviconUrl({ pageUrl: "https://example.com/docs?q=1" }, appearance)).toBe(
        null,
      );
      expect(toolActivityFaviconUrl({ pageUrl: "https://github.com/o/r/pull/1" }, appearance)).toBe(
        null,
      );
    }
  });

  it("shows only inline provider images, never a remote or extension URL", () => {
    const inline = "data:image/png;base64,iVBORw0KGgo=";
    expect(
      toolActivityFaviconUrl({ pageUrl: "https://example.com", faviconUrl: inline }, "light"),
    ).toBe(inline);
    expect(
      toolActivityFaviconUrl(
        { pageUrl: "https://example.com", faviconUrl: "https://example.com/icon.png" },
        "light",
      ),
    ).toBeNull();
    expect(
      toolActivityFaviconUrl(
        { pageUrl: "https://example.com", faviconUrl: "chrome-extension://example/_favicon/" },
        "dark",
      ),
    ).toBeNull();
  });
});
