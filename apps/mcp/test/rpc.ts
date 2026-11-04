/** The JSON-RPC result inside a stateless server's SSE answer. */
export function rpcResult(res: { body: string }) {
  const data = res.body.split('\n').find((line) => line.startsWith('data: '));
  return JSON.parse(data!.slice('data: '.length)).result;
}

export const toolData = (result: { content: { text: string }[] }) => JSON.parse(result.content[0]!.text);
