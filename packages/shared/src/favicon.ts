/**
 * Privacy fork stopgap: only an inline (`data:`) image a provider event supplied is shown. A linked
 * origin's /favicon.ico, a provider's remote icon URL and GitHub's asset CDN would each be fetched
 * directly from the viewer; those tool rows use the generic icon instead.
 */
function inlineFaviconUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || rawUrl.length > 65_536) return null;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "data:" ? url.href : null;
  } catch {
    return null;
  }
}

export function toolActivityFaviconUrl(
  icon: {
    readonly pageUrl: string;
    readonly faviconUrl?: string | undefined;
    readonly faviconUrlDark?: string | undefined;
  },
  appearance: "light" | "dark",
  _size = 32,
): string | null {
  return (
    (appearance === "dark" ? inlineFaviconUrl(icon.faviconUrlDark) : null) ??
    inlineFaviconUrl(icon.faviconUrl)
  );
}

// Fork: no third-party favicon service; it saw every hostname a chat or preview showed.
// Callers fall back to a captured favicon or a generic icon.
export function faviconUrlForOrigin(_rawUrl: string | null | undefined, _size = 32): string | null {
  return null;
}
