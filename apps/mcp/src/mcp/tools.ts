import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { ApiError } from '../api.js';

interface ApiLedgers {
  user: { username: string };
  ledgers: { ledgerId: number; name: string; role: string; owner: string; label: string }[];
}

/** What one `/mcp` request may do: read as its user, and spend that user's tool calls. */
export interface RequestScope {
  read<T>(path: string): Promise<T>;
  /** Takes one tool call: 0 when allowed, otherwise the seconds until one is free. */
  takeToolCall(tool: string): number;
}

const errorResult = (text: string): CallToolResult => ({ content: [{ type: 'text', text }], isError: true });

/** Runs a tool, handing a refusal or an API error to the LLM as a result it can read, not a protocol failure. */
async function toolResult(
  scope: RequestScope,
  tool: string,
  read: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  const waitSeconds = scope.takeToolCall(tool);
  if (waitSeconds > 0) {
    return errorResult(`rate_limited: too many requests from this connection; try again in ${waitSeconds} s`);
  }
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await read()) }] };
  } catch (err) {
    if (err instanceof ApiError) return errorResult(err.code);
    throw err;
  }
}

/** A server for one request: `scope` is its user's, so a tool can only reach what that user can. */
export function buildServer(scope: RequestScope): McpServer {
  const server = new McpServer({ name: 'kopiyka', version: '0.1.0' });

  server.registerTool(
    'list_ledgers',
    {
      description:
        'Lists the budgets (ledgers) the signed-in user can read. Use a ledgerId from here in the other tools. ' +
        'All amounts in a ledger are in EUR.',
      annotations: { readOnlyHint: true },
    },
    () =>
      toolResult(scope, 'list_ledgers', async () => {
        const { user, ledgers } = await scope.read<ApiLedgers>('/api/ledgers');
        return {
          user: { username: user.username },
          ledgers: ledgers.map(({ ledgerId, name, label, role, owner }) => ({
            ledgerId,
            name,
            label,
            role,
            owner,
            currency: 'EUR',
          })),
        };
      }),
  );

  return server;
}
