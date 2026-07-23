/**
 * The governed web crawler (ADR-0052) — SSRF-safe server-side source acquisition.
 *
 * Fetching an arbitrary URL from our own infrastructure is a security boundary, not a parsing
 * feature: a naive fetch is a textbook SSRF (server-side request forgery) that could reach cloud
 * metadata (169.254.169.254), localhost services, or private-network hosts. So the crawler's essence
 * is a *deny-by-default policy that runs before any byte is fetched* and re-runs on every redirect
 * hop. `validateCrawlUrl` is that policy — pure, network-free, exhaustively testable. The actual
 * fetch (`createGovernedWebFetcher`) is bounded (timeout, size cap), content-typed (HTML only), and
 * handles redirects manually so each hop is re-validated. Rejections are typed errors, never a silent
 * empty success (Constitution #4).
 *
 * Spec: spec/architecture-decisions/ADR-0052-governed-web-crawler.md.
 */
import { CosError, err, ok, type Result } from "@inevitable/shared";

export interface WebFetchResult {
  /** The fetched HTML (already content-type-checked). */
  readonly html: string;
  /** The final URL after any (validated) redirects — the honest attributed source. */
  readonly finalUrl: string;
  readonly contentType: string;
}

/** The injectable fetch seam. Given an already-validated URL, returns HTML or a typed error. */
export type WebFetchFn = (url: URL) => Promise<Result<WebFetchResult, CosError>>;

export interface GovernedWebFetcherOptions {
  /** Max response bytes before the read is aborted (default 5 MiB). */
  readonly maxBytes?: number;
  /** Per-request timeout in ms (default 15s). */
  readonly timeoutMs?: number;
  /** Max redirect hops, each re-validated (default 5). */
  readonly maxRedirects?: number;
  /** Injected fetch (tests); defaults to the platform `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

function crawlError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, {
    specRef: "spec/architecture-decisions/ADR-0052-governed-web-crawler.md",
    details,
  });
}

// ── The SSRF policy (pure, network-free) ─────────────────────────────────────────────────────────

/** True when `host` is an address the crawler must never reach (loopback/private/link-local/etc). */
export function isBlockedHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, ""); // drop a trailing dot
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;

  // IPv6 literal (URL hosts keep the brackets stripped by URL parsing, but guard both forms).
  const v6 = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (v6.includes(":")) return isBlockedIpv6(v6);

  // IPv4 literal — only treat as an IP when it's four numeric octets.
  const octets = h.split(".");
  if (octets.length === 4 && octets.every((o) => /^\d{1,3}$/.test(o))) {
    const nums = octets.map((o) => Number(o));
    if (nums.some((n) => n > 255)) return true; // malformed → refuse
    return isBlockedIpv4(nums as [number, number, number, number]);
  }
  // A DNS name — allowed at T1 (resolved-address validation / DNS-rebinding is deferred, ADR-0052).
  return false;
}

function isBlockedIpv4([a, b]: [number, number, number, number]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT (100.64/10)
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIpv6(addr: string): boolean {
  const a = addr.toLowerCase();
  if (a === "::1" || a === "::") return true; // loopback / unspecified
  if (a.startsWith("fe80") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb"))
    return true; // link-local fe80::/10
  if (a.startsWith("fc") || a.startsWith("fd")) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:127.0.0.1) — validate the embedded v4.
  const mapped = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(a);
  if (mapped?.[1]) return isBlockedHost(mapped[1]);
  return false;
}

/** The gate: parse + apply the deny-by-default policy. Runs before any fetch and on each redirect. */
export function validateCrawlUrl(raw: string): Result<URL, CosError> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return err(crawlError("E_CRAWL_URL_INVALID", `not a valid URL: ${raw.slice(0, 120)}`));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err(
      crawlError(
        "E_CRAWL_SCHEME_BLOCKED",
        `scheme "${url.protocol}" is not allowed (http/https only)`,
      ),
    );
  }
  if (url.username || url.password) {
    return err(crawlError("E_CRAWL_CREDENTIALS_BLOCKED", "URLs with credentials are not allowed"));
  }
  if (isBlockedHost(url.hostname)) {
    return err(
      crawlError("E_CRAWL_HOST_BLOCKED", `host "${url.hostname}" is private/loopback/link-local`, {
        host: url.hostname,
      }),
    );
  }
  return ok(url);
}

// ── The governed fetcher ─────────────────────────────────────────────────────────────────────────

const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const USER_AGENT = "TheInevitable-CognitiveCrawler/1.0 (+governed; ADR-0052)";

export function createGovernedWebFetcher(opts: GovernedWebFetcherOptions = {}): WebFetchFn {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRedirects = opts.maxRedirects ?? 5;
  const doFetch = opts.fetchImpl ?? fetch;

  return async (start: URL): Promise<Result<WebFetchResult, CosError>> => {
    let current = start;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await doFetch(current.toString(), {
          method: "GET",
          redirect: "manual", // each hop is re-validated by us, never auto-followed (SSRF)
          signal: controller.signal,
          headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
        });
      } catch (cause) {
        clearTimeout(timer);
        return err(
          crawlError("E_CRAWL_FETCH_FAILED", `fetch failed: ${String(cause)}`, {
            url: current.toString(),
          }),
        );
      }
      clearTimeout(timer);

      // Redirect: validate the next hop through the SAME policy before following it.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          return err(crawlError("E_CRAWL_FETCH_FAILED", "redirect without a location"));
        if (hop === maxRedirects) {
          return err(
            crawlError("E_CRAWL_TOO_MANY_REDIRECTS", `exceeded ${maxRedirects} redirects`),
          );
        }
        const nextRaw = new URL(location, current).toString();
        const validated = validateCrawlUrl(nextRaw);
        if (!validated.ok) return validated;
        current = validated.value;
        continue;
      }

      if (!response.ok) {
        return err(
          crawlError("E_CRAWL_HTTP_ERROR", `upstream returned HTTP ${response.status}`, {
            status: response.status,
          }),
        );
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!HTML_CONTENT_TYPES.some((t) => contentType.includes(t))) {
        return err(
          crawlError(
            "E_CRAWL_CONTENT_TYPE",
            `content-type "${contentType || "unknown"}" is not HTML`,
          ),
        );
      }

      const declared = Number(response.headers.get("content-length") ?? "");
      if (Number.isFinite(declared) && declared > maxBytes) {
        return err(
          crawlError("E_CRAWL_TOO_LARGE", `content-length ${declared} exceeds ${maxBytes}`),
        );
      }

      const text = await readBounded(response, maxBytes);
      if (!text.ok) return text;
      return ok({ html: text.value, finalUrl: current.toString(), contentType });
    }
    return err(crawlError("E_CRAWL_TOO_MANY_REDIRECTS", `exceeded ${maxRedirects} redirects`));
  };
}

/** Read a response body, aborting past `maxBytes` (no unbounded read). */
async function readBounded(
  response: Response,
  maxBytes: number,
): Promise<Result<string, CosError>> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes)
      return err(crawlError("E_CRAWL_TOO_LARGE", "body exceeds size cap"));
    return ok(text);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return err(crawlError("E_CRAWL_TOO_LARGE", `body exceeds ${maxBytes} bytes`));
      }
      chunks.push(value);
    }
  }
  return ok(new TextDecoder().decode(concat(chunks)));
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
