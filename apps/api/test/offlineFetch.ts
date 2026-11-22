// Preloaded (`node --import`) into the scripts the tests run as child processes, before the script loads: it
// replaces `fetch`, so a script can never reach Notion or the NBU. A Notion data source query is answered from
// FAKE_NOTION_ROWS (JSON: data source id → the pages Notion would return); any other call fails like a network error.
const fakeRows = JSON.parse(process.env.FAKE_NOTION_ROWS ?? '{}') as Record<string, unknown[]>;
const QUERY_PATH = /^https:\/\/api\.notion\.com\/v1\/data_sources\/([^/]+)\/query$/;

globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const dataSourceId = QUERY_PATH.exec(url)?.[1];
  const results = dataSourceId === undefined ? undefined : fakeRows[dataSourceId];
  if (results === undefined) throw new TypeError('no network in tests');
  return Response.json({ results, has_more: false, next_cursor: null });
};
