// ── SPA public-page metadata (crawler-facing) ────────────────────────────
//
// Crawlers do not execute the SPA's JavaScript, so SPA-rendered public pages
// (/privacy, /terms, /delete-account) would otherwise be seen with the
// homepage's <title>, meta description, and canonical baked into index.html —
// duplicate titles and wrong canonicals across three URLs. In production the
// server serves the same built index.html with each page's own metadata
// swapped in; the SPA itself boots unchanged.
//
// Pure textual replacement over stable head-tag anchors. If an anchor is
// missing (shell changed), the tag is simply left as-is — never throws.

export interface SpaPageMeta {
  title: string;
  description: string;
  canonical: string;
  /** Overrides <meta name="robots">; used to noindex utility pages. */
  robots?: string;
}

export const SPA_META_PAGES: Record<string, SpaPageMeta> = {
  "/privacy": {
    title: "Privacy Policy | Dime Time",
    description:
      "How Dime Time collects, uses, and protects your information — the plain-language privacy policy for the Dime Time debt payoff app.",
    canonical: "https://dime-time.com/privacy",
  },
  "/terms": {
    title: "Terms of Service | Dime Time",
    description:
      "The terms that govern your use of Dime Time's round-up debt payoff app and website.",
    canonical: "https://dime-time.com/terms",
  },
  "/delete-account": {
    title: "Delete Your Account | Dime Time",
    description:
      "How to permanently delete your Dime Time account and associated data.",
    canonical: "https://dime-time.com/delete-account",
    // Required to stay live for app-store compliance, but it is a utility
    // page — keep it out of search results.
    robots: "noindex, follow",
  },
};

const replaceTag = (html: string, pattern: RegExp, replacement: string): string =>
  pattern.test(html) ? html.replace(pattern, replacement) : html;

export function applySpaMeta(html: string, meta: SpaPageMeta): string {
  let out = html;
  out = replaceTag(out, /<title>[\s\S]*?<\/title>/, `<title>${meta.title}</title>`);
  out = replaceTag(
    out,
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${meta.description}">`,
  );
  out = replaceTag(
    out,
    /<link rel="canonical"[^>]*\/?>/,
    `<link rel="canonical" href="${meta.canonical}" />`,
  );
  out = replaceTag(
    out,
    /<meta property="og:title"[^>]*\/?>/,
    `<meta property="og:title" content="${meta.title}" />`,
  );
  out = replaceTag(
    out,
    /<meta property="og:description"[^>]*\/?>/,
    `<meta property="og:description" content="${meta.description}" />`,
  );
  out = replaceTag(
    out,
    /<meta property="og:url"[^>]*\/?>/,
    `<meta property="og:url" content="${meta.canonical}" />`,
  );
  out = replaceTag(
    out,
    /<meta name="twitter:title"[^>]*\/?>/,
    `<meta name="twitter:title" content="${meta.title}" />`,
  );
  out = replaceTag(
    out,
    /<meta name="twitter:description"[^>]*\/?>/,
    `<meta name="twitter:description" content="${meta.description}" />`,
  );
  if (meta.robots) {
    out = replaceTag(
      out,
      /<meta name="robots"[^>]*\/?>/,
      `<meta name="robots" content="${meta.robots}" />`,
    );
  }
  return out;
}
