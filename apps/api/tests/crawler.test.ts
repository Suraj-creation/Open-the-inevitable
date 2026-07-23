import { describe, expect, test } from "vitest";
import { createGovernedWebFetcher, isBlockedHost, validateCrawlUrl } from "../src/crawler";

/**
 * The governed web crawler's SSRF policy (ADR-0052). The policy is pure and deny-by-default; these
 * tests prove the dangerous vectors are refused with typed errors and only public HTTP(S) URLs pass.
 */

describe("validateCrawlUrl — the SSRF policy (pure, deny-by-default)", () => {
  test("allows a normal public https URL", () => {
    const r = validateCrawlUrl("https://en.wikipedia.org/wiki/Gradient_descent");
    expect(r.ok).toBe(true);
  });

  test("blocks non-http(s) schemes", () => {
    for (const url of ["file:///etc/passwd", "ftp://host/x", "gopher://h", "data:text/html,x"]) {
      const r = validateCrawlUrl(url);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("E_CRAWL_SCHEME_BLOCKED");
    }
  });

  test("blocks credentialed URLs", () => {
    const r = validateCrawlUrl("https://user:pass@example.com/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("E_CRAWL_CREDENTIALS_BLOCKED");
  });

  test("blocks localhost and loopback", () => {
    for (const url of [
      "http://localhost/x",
      "http://localhost:5432/x",
      "http://api.localhost/x",
      "http://127.0.0.1/x",
      "http://127.0.0.1:8080/admin",
      "http://[::1]/x",
    ]) {
      const r = validateCrawlUrl(url);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("E_CRAWL_HOST_BLOCKED");
    }
  });

  test("blocks private, link-local, and the cloud-metadata address", () => {
    for (const url of [
      "http://10.0.0.5/admin",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/", // AWS/GCP metadata — the classic SSRF target
      "http://0.0.0.0/",
      "http://100.64.0.1/", // carrier-grade NAT
    ]) {
      const r = validateCrawlUrl(url);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("E_CRAWL_HOST_BLOCKED");
    }
  });

  test("does not misclassify a public IP-in-range boundary as private", () => {
    // 172.15.x and 172.32.x are PUBLIC (private is only 172.16–172.31).
    expect(validateCrawlUrl("http://172.15.0.1/").ok).toBe(true);
    expect(validateCrawlUrl("http://172.32.0.1/").ok).toBe(true);
  });

  test("rejects a malformed URL", () => {
    const r = validateCrawlUrl("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("E_CRAWL_URL_INVALID");
  });

  test("isBlockedHost is exhaustive on ULA/link-local IPv6", () => {
    expect(isBlockedHost("fd00::1")).toBe(true);
    expect(isBlockedHost("fe80::1")).toBe(true);
    expect(isBlockedHost("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedHost("2606:4700:4700::1111")).toBe(false); // public (Cloudflare)
  });
});

describe("createGovernedWebFetcher — bounded, content-typed, redirect-revalidating", () => {
  const htmlResponse = (html: string, headers: Record<string, string> = {}): Response =>
    new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...headers },
    });

  test("fetches HTML and reports the final URL", async () => {
    const fetcher = createGovernedWebFetcher({
      fetchImpl: async () => htmlResponse("<h1>Gradient Descent</h1>"),
    });
    const r = await fetcher(new URL("https://example.com/page"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.html).toContain("Gradient Descent");
      expect(r.value.finalUrl).toBe("https://example.com/page");
    }
  });

  test("refuses non-HTML content", async () => {
    const fetcher = createGovernedWebFetcher({
      fetchImpl: async () =>
        new Response("%PDF-1.7", { status: 200, headers: { "content-type": "application/pdf" } }),
    });
    const r = await fetcher(new URL("https://example.com/doc.pdf"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("E_CRAWL_CONTENT_TYPE");
  });

  test("re-validates redirect hops through the policy (no redirect-to-internal)", async () => {
    // A public URL 302s to a loopback address — the fetcher must refuse the hop, not follow it.
    const fetcher = createGovernedWebFetcher({
      fetchImpl: async (input) => {
        if (String(input).includes("example.com")) {
          return new Response(null, {
            status: 302,
            headers: { location: "http://127.0.0.1/admin" },
          });
        }
        return htmlResponse("<h1>should never reach here</h1>");
      },
    });
    const r = await fetcher(new URL("https://example.com/redir"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("E_CRAWL_HOST_BLOCKED");
  });

  test("aborts an over-sized body", async () => {
    const fetcher = createGovernedWebFetcher({
      maxBytes: 16,
      fetchImpl: async () => htmlResponse("<html>" + "x".repeat(1000) + "</html>"),
    });
    const r = await fetcher(new URL("https://example.com/big"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("E_CRAWL_TOO_LARGE");
  });
});
