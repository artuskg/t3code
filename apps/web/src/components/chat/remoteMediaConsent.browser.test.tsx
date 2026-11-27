import { describe, expect, it, vi } from "vite-plus/test";

vi.mock(import("gt-react"), async (importOriginal) => ({
  ...(await importOriginal()),
  useGT: () => (text: string, vars?: Record<string, string>) =>
    text.replace(/\{(\w+)\}/gu, (_match, name: string) => vars?.[name] ?? ""),
}));

import { act, render } from "../../../test/render";
import { ClickToLoadRemoteMedia } from "./ChatMarkdownMedia";

// The child stands in for the media element, so the test itself fetches nothing.
function slot(src: string) {
  return (
    <ClickToLoadRemoteMedia src={src} kind="audio">
      <span data-testid="media">{src}</span>
    </ClickToLoadRemoteMedia>
  );
}

describe("remote media consent in a live slot", () => {
  it("asks again when a clicked URL is replaced in place", async () => {
    await using screen = await render(slot("https://first.invalid/a.mp3"), { router: false });
    await act(() => screen.container.querySelector("button")?.click());
    expect(screen.container.querySelector("[data-testid=media]")?.textContent).toBe(
      "https://first.invalid/a.mp3",
    );

    await screen.rerender(slot("https://second.invalid/b.mp3"));
    expect(screen.container.querySelector("[data-testid=media]")).toBeNull();
    expect(screen.container.textContent).toContain("Load audio from second.invalid");
  });
});
