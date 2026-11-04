import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { ApiError, type ApiClient } from '../api.js';

interface ApiLedgers {
  user: { username: string };
  ledgers: { ledgerId: number; name: string; role: string; owner: string; label: string }[];
}

/** Runs a tool, handing an API error to the LLM as a result it can read rather than a protocol failure. */
async function toolResult(read: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await read()) }] };
  } catch (err) {
    if (err instanceof ApiError) return { content: [{ type: 'text', text: err.code }], isError: true };
    throw err;
  }
}

/** A server for one request: `apiToken` is its user's, so a tool can only reach what that user can. */
export function buildServer(api: ApiClient, apiToken: string): McpServer {
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
      toolResult(async () => {
        const { user, ledgers } = await api.get<ApiLedgers>('/api/ledgers', apiToken);
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
