import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("gt-react", async (original) => ({
  ...(await original<typeof import("gt-react")>()),
  useGT: () => (text: string, vars: Record<string, string>) =>
    text.replace(/\{(\w+)\}/gu, (_match, name: string) => vars[name] ?? ""),
}));

import { ClickToLoadRemoteMedia, remoteMediaHost } from "./ChatMarkdownMedia";

describe("remote markdown media", () => {
  it("treats only http(s) media on another origin as remote", () => {
    expect(remoteMediaHost("https://cdn.example.com/a.png?t=1")).toBe("cdn.example.com");
    expect(remoteMediaHost("http://10.0.0.2:8080/a.mp4")).toBe("10.0.0.2:8080");
    expect(remoteMediaHost("data:image/png;base64,AAAA")).toBeNull();
    expect(remoteMediaHost("blob:t3code://app/1")).toBeNull();
    expect(remoteMediaHost("http://host:3773/a.png", "http://host:3773")).toBeNull();
  });

  it("shows a placeholder naming the host instead of loading remote media", () => {
    const html = renderToStaticMarkup(
      <ClickToLoadRemoteMedia src="https://tracker.example.net/pixel.png" kind="image">
        <img src="https://tracker.example.net/pixel.png" alt="" />
      </ClickToLoadRemoteMedia>,
    );
    expect(html).toContain("Load image from tracker.example.net");
    expect(html).not.toContain("<img");
  });

  it("renders inline media directly", () => {
    const src = "data:image/png;base64,AAAA";
    const html = renderToStaticMarkup(
      <ClickToLoadRemoteMedia src={src} kind="image">
        <img src={src} alt="" />
      </ClickToLoadRemoteMedia>,
    );
    expect(html).toContain("<img");
  });
});
