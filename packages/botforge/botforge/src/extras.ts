/**
 * Per-employee runtime extras installed into a child's unpublished context:
 * assigned skill bodies and MCP servers.
 * @module @deepseek-ai/dsh-botforge/extras
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-tools'
import { normalizeMcp, type BotForgeMcpServer, type BotForgeWorkerConfig } from './config.ts'
import { lockEmployeeDelegation } from './delegation-lock.ts'

/** MCP client namespace plugin loaded only when a child actually needs a server. */
interface McpClientPlugin {
  readonly apply: (ctx: Context, config: Record<string, unknown>) => Promise<void> | void
  readonly name?: string
  readonly inject?: readonly string[]
  readonly Config?: unknown
}

/**
 * Sanitize an MCP `serverName` so it matches mcp-client's `[A-Za-z0-9_-]{1,32}` rule.
 * The user-facing name is preserved verbatim whenever it already fits the
 * contract; the `e<workerId>_…_<index>` shape is only a fallback for names
 * that are empty, over-long, character-mangled, or already taken within this
 * employee's batch.
 * @param workerId - employee id.
 * @param serverName - user-supplied MCP name.
 * @param index - roster index, used when the sanitized name needs a fallback.
 * @param taken - names already claimed by earlier rows of this batch.
 * @returns a unique-enough namespace within 32 characters.
 */
export function mcpServerName(
  workerId: string,
  serverName: string,
  index: number,
  taken: ReadonlySet<string> = new Set(),
): string {
  const clean = serverName.trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)
  if (clean !== '' && !taken.has(clean)) return clean
  const base = `e${workerId}_${clean === '' ? `mcp${String(index)}` : clean}_${String(index)}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 32)
  if (!taken.has(base)) return base
  let n = 2
  while (true) {
    const suffix = `_${String(n)}`
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`
    if (!taken.has(candidate)) return candidate
    n += 1
  }
}

/**
 * Load assigned skill bodies from a skills service.
 * Missing names are skipped; a missing skills service yields an empty string.
 * @param ctx - context carrying `skills`, usually the parent or the child.
 * @param worker - employee whose `skills` list is loaded.
 * @param cwd - workspace used for skill discovery.
 * @param signal - cancels discovery when the delegation is aborted.
 * @returns joined markdown bodies, or `''`.
 */
export async function loadEmployeeSkillBodies(
  ctx: Context,
  worker: BotForgeWorkerConfig,
  cwd: string | undefined,
  signal: AbortSignal,
): Promise<string> {
  const names = worker.skills.map((name) => name.trim()).filter(Boolean)
  if (names.length === 0) return ''
  const skills = ctx.get('skills') as
    | { get: (name: string, options?: { cwd?: string | undefined; signal?: AbortSignal | undefined }) => Promise<{ content?: string } | undefined> }
    | undefined
  if (skills === undefined) return ''
  const bodies: string[] = []
  for (const name of names) {
    const definition = await skills.get(name, { cwd, signal })
    if (definition?.content?.trim()) {
      bodies.push(`## ${name}\n${definition.content.trim()}`)
    }
  }
  return bodies.join('\n\n')
}

/**
 * Load assigned skill bodies into a child-scoped prompt section.
 * Missing names are skipped; a missing skills or system-prompt service is a no-op.
 * @param childCtx - the child's scoped context.
 * @param worker - employee whose `skills` list is loaded.
 * @param cwd - workspace used for skill discovery.
 * @param signal - cancels discovery when the delegation is aborted.
 */
export async function installEmployeeSkills(
  childCtx: Context,
  worker: BotForgeWorkerConfig,
  cwd: string | undefined,
  signal: AbortSignal,
): Promise<void> {
  const systemPrompt = childCtx.get('systemPrompt') as
    | { section: (spec: { name: string; order: number; text: string }) => () => void }
    | undefined
  if (systemPrompt === undefined) return
  const text = await loadEmployeeSkillBodies(childCtx, worker, cwd, signal)
  if (text === '') return
  systemPrompt.section({
    name: 'botforge:employee-skills',
    order: 14,
    text: `Assigned skills for this employee:\n\n${text}`,
  })
}

/**
 * Start one MCP server inside the child's context so its tools stay off the parent.
 * Connection failures are logged and skipped; they must not abort the child.
 * @param childCtx - the child's scoped context.
 * @param workerId - employee id, used to namespace the server.
 * @param raw - stored MCP row; omitted collections are normalized first.
 * @param index - roster index for a unique serverName.
 * @param loadClient - loader used so tests can stub the mcp-client package.
 * @param forcedName - pre-claimed namespace (batch planning); derived when omitted.
 */
export async function installEmployeeMcpServer(
  childCtx: Context,
  workerId: string,
  raw: Partial<BotForgeMcpServer>,
  index: number,
  loadClient: () => Promise<McpClientPlugin> = loadMcpClient,
  forcedName?: string,
): Promise<void> {
  const server = normalizeMcp(raw)
  const serverName = forcedName
    ?? mcpServerName(workerId, server.name === '' ? `mcp${String(index)}` : server.name, index)
  const url = server.url.trim()
  const command = server.command.trim()
  if (url === '' && command === '') return
  const plugin = await loadClient()
  const config = url !== ''
    ? {
      transport: 'streamable-http',
      serverName,
      url,
      headers: { ...server.headers },
      failOnStartupError: false,
    }
    : {
      transport: 'stdio',
      serverName,
      command,
      args: [...server.args],
      env: { ...server.env },
      cwd: server.cwd,
      failOnStartupError: false,
    }
  try {
    await childCtx.plugin(plugin as never, config as never)
  } catch (error: unknown) {
    const logger = childCtx.logger as { warn?: (m: string) => void }
    logger.warn?.(
      `botforge: MCP "${server.name}" for employee ${workerId} failed to start: ${String(error)}`,
    )
  }
}

/**
 * Install every configured extra onto one employee child inside its creation
 * window: the delegation lock, skills, and every MCP server mount. Called
 * before the child publishes, so its FIRST turn already sees the MCP tools.
 * @param childCtx - the child's scoped context.
 * @param worker - employee configuration.
 * @param cwd - workspace used for skill discovery.
 * @param signal - cancels skill loading when the delegation is aborted.
 */
export async function installEmployeeExtras(
  childCtx: Context,
  worker: BotForgeWorkerConfig,
  cwd: string | undefined,
  signal: AbortSignal,
): Promise<void> {
  const agent = childCtx.agent
  if (agent !== undefined && childCtx.get('tools') !== undefined) {
    lockEmployeeDelegation(childCtx.tools, agent)
  }
  await installEmployeeSkills(childCtx, worker, cwd, signal)
  // Claim clean names first so user-facing rows win over fallback shapes.
  const taken = new Set<string>()
  const planned = worker.mcp.map((server, index) => {
    const serverName = mcpServerName(worker.id, server.name === '' ? `mcp${String(index)}` : server.name, index, taken)
    taken.add(serverName)
    return { server, index, serverName }
  })
  await Promise.all(planned.map(({ server, index, serverName }) =>
    installEmployeeMcpServer(childCtx, worker.id, server, index, loadMcpClient, serverName)))
}

/**
 * Dynamic import isolated so unit tests can stub the MCP client package.
 * @returns the mcp-client namespace plugin.
 */
export async function loadMcpClient(): Promise<McpClientPlugin> {
  return import('@deepseek-ai/dsh-mcp-client') as unknown as Promise<McpClientPlugin>
}
