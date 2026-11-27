import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("gt-react", async (original) => ({
  ...(await original<typeof import("gt-react")>()),
  useMessages: () => (value: unknown) => value,
  T: ({ children }: { children: ReactNode }) => children,
  Var: ({ children }: { children: ReactNode }) => children,
  useGT: () => (text: string, vars?: Record<string, string>) =>
    text.replace(/\{(\w+)\}/gu, (_match, name: string) => vars?.[name] ?? ""),
}));
// The selected environment cannot sign forge media, so each forge URL takes its direct fallback.
vi.mock("~/assets/assetUrls", () => ({
  useAssetUrlState: () => ({ _tag: "Failure", reason: "missing-file-access" }),
  useAssetUrlRefresh: () => async () => undefined,
}));
vi.mock("~/state/query", async (original) => ({
  ...(await original<typeof import("~/state/query")>()),
  useEnvironmentQuery: () => ({
    data: {
      scope: "example/repo",
      displayKey: "#1",
      state: "open",
      title: "Example",
      createdAt: "2026-11-27T00:00:00.000Z",
      author: { login: "octo", avatarUrl: "https://avatar.invalid/octo.png" },
    },
    error: null,
  }),
}));

import ChatMarkdown from "../ChatMarkdown";
import { IssueLinkPreviewFallback } from "../issue/IssueLinkPreview";
import { PullRequestMarkdown } from "../pullRequest/PullRequestMarkdown";

afterEach(() => vi.unstubAllGlobals());

const FORGE_VIDEO =
  "https://github.com/user-attachments/assets/2f8c1a90-1b2c-4d5e-8f90-abcdef123456";

describe("remote media consent", () => {
  it("gates a raw external video in a pull request body", () => {
    const html = renderToStaticMarkup(
      <PullRequestMarkdown
        cwd="/example"
        environmentId={"example" as never}
        text={'<video src="https://video.invalid/test.mp4"></video>'}
      />,
    );
    expect(html).not.toContain("<video");
    expect(html).toContain("Load video from video.invalid");
  });

  it("gates the direct fallback of a forge video the environment could not sign", () => {
    const html = renderToStaticMarkup(
      <PullRequestMarkdown cwd="/example" environmentId={"example" as never} text={FORGE_VIDEO} />,
    );
    expect(html).not.toContain(`src="${FORGE_VIDEO}`);
    expect(html).toContain("Load video from github.com");
  });

  it("gates the direct fallback of a forge image the environment could not sign", () => {
    const url = "https://github.com/user-attachments/assets/0d6e1b3c-1111-4222-8333-944455556666";
    vi.stubGlobal("window", {
      location: new URL("https://renderer.invalid/"),
      localStorage: { getItem: () => null, setItem: () => undefined },
    });
    const html = renderToStaticMarkup(
      <ChatMarkdown
        text={`![shot](${url})`}
        cwd="/example"
        environmentId={"example" as never}
        sourceControlMedia
      />,
    );
    expect(html).not.toContain(`src="${url}`);
    expect(html).toContain("Load image from github.com");
  });

  it("shows initials, not the forge avatar, in a hover card", () => {
    const html = renderToStaticMarkup(
      <IssueLinkPreviewFallback
        originalUrl="https://github.com/example/repo/issues/1"
        target={{ environmentId: "example" as never, input: {} as never }}
      />,
    );
    expect(html).toContain("octo");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("avatar.invalid");
  });
});
