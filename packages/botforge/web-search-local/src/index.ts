/**
 * Local search provider: no paid API, no Redis. Uses DuckDuckGo HTML search
 * via the same anonymous fetch seam (web-fetch-http) then lightweight HTML
 * snippet extraction without extra deps. Falls back to empty results rather
 * than throwing when offline/blocked — caller (tool-web) already surfaces it.
 * @module @deepseek-ai/dsh-web-search-local
 */
import type { Context } from '@deepseek-ai/cordis'
import type { WebSearchProvider, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'

export const name = 'web-search-local'
export const inject = ['web'] as const

const ID = 'local-html'

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

function extractSources(html: string): WebSearchSource[] {
  const out: WebSearchSource[] = []
  // DuckDuckGo html: each result is <a class="result__a" href="...">title</a> + snippet
  const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null && out.length < 10) {
    const rawUrl = m[1]!
    const title = stripTags(m[2] ?? '').slice(0, 180)
    // DDG wraps with /l/?uddg=ENCODED — unwrap if present
    let url = rawUrl
    try {
      if (url.includes('uddg=')) {
        const u = new URL(url, 'https://html.duckduckgo.com')
        const inner = u.searchParams.get('uddg')
        if (inner) url = decodeURIComponent(inner)
      }
      // validate parseable
      new URL(url)
    } catch { continue }
    // snippet: nearest result__snippet after this anchor
    const after = html.slice(m.index, m.index + 4000)
    const snipM = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(after)
    const snippet = snipM ? stripTags(snipM[1] ?? '') : undefined
    const src: WebSearchSource = { url, ...(title ? { title } : {}), ...(snippet ? { snippet } : {}) }
    out.push(src)
  }
  return out
}

class LocalSearchProvider implements WebSearchProvider {
  readonly id = ID
  constructor(private readonly ctx: Context) {}
  available(): boolean { return true }
  async search(req: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<WebSearchResult> {
    const q = req.query.trim()
    if (!q) return { sources: [], truncated: false }
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
    try {
      const fetched = await this.ctx.web.fetch({ url }, signal)
      // WebFetchBody is a closed html|text union; every arm carries `content`.
      const html = fetched.body.content
      const sources = extractSources(html)
      const max = req.maxResults
      const sliced = max !== undefined ? sources.slice(0, max) : sources
      return { sources: sliced, truncated: max !== undefined && sources.length > sliced.length }
    } catch {
      return { sources: [], truncated: false }
    }
  }
}

export function apply(ctx: Context): void {
  ctx.web.registerSearchProvider(new LocalSearchProvider(ctx))
}
