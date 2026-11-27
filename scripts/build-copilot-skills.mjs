// Writes Copilot's copies of the kopiyka skills and agents from the `.claude` sources (brief 110, docs/copilot.md).
//   node scripts/build-copilot-skills.mjs          write them (yarn skills:build)
//   node scripts/build-copilot-skills.mjs --check  fail if a committed copy is out of date (yarn skills:check)
//
// Marks in a source file:
//   <!-- claude -->…<!-- /claude -->        body text only Claude gets
//   <!-- copilot: <id> -->                  body placeholder for text only Copilot gets, kept in the front matter as
//   # copilot text <id>:                    YAML comment lines, so Claude never loads it
//   # | <line>                              (`# |` alone is an empty line)
//   # copilot: <key>: <value>               front matter only Copilot gets
// Wording that is the same rule for both tools is a substitution below. An agent's Copilot front matter is built from
// its Claude front matter (TOOL_ALIASES), and its body opens with a line telling Copilot to read the agent's skills.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';

const root = path.resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');

// Applied after the claude blocks are dropped and before the copilot texts go in. Each must match somewhere.
const SUBSTITUTIONS = [
  ['.claude/skills/', '.github/skills/'],
  ['~/.claude/skills', '~/.copilot/skills'],
  ['Spawn ', 'Delegate to '],
  ['(WebFetch)', '(the web fetch tool)'],
  ['Follow the preloaded', 'Follow the'],
  ['Bash is for', 'The terminal is for'],
  ['Bash for reading', 'the terminal is for reading'],
];

// Claude Code tool → Copilot tool alias, in the order Copilot's lists use.
const TOOL_ALIASES = [
  ['Read', 'read'],
  ['Grep', 'search'],
  ['Glob', 'search'],
  ['Write', 'edit'],
  ['Edit', 'edit'],
  ['Bash', 'execute'],
  ['WebFetch', 'web'],
];
const COPILOT_TOOL_ORDER = ['read', 'search', 'edit', 'execute', 'web'];
// Keys Copilot doesn't take are dropped; an unknown key fails, so a new one gets a decision.
const AGENT_KEYS = ['name', 'description', 'tools', 'disallowedTools', 'skills', 'color', 'effort'];

class SourceError extends Error {}

function fail(source, reason) {
  throw new SourceError(`${source}: ${reason}`);
}

function splitFrontMatter(source, raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) fail(source, 'no front matter starting on line 1');
  return { frontLines: match[1].split('\n'), body: raw.slice(match[0].length) };
}

// Splits the front matter into the lines Copilot keeps and the copilot texts by id.
function readFrontMatterMarks(source, frontLines) {
  const kept = [];
  const texts = new Map();
  let openText = null;
  for (const line of frontLines) {
    const textStart = line.match(/^# copilot text ([a-z-]+):$/);
    if (textStart) {
      const id = textStart[1];
      if (texts.has(id)) fail(source, `copilot text "${id}" is defined twice`);
      openText = [];
      texts.set(id, openText);
    } else if (openText && (line === '# |' || line.startsWith('# | '))) {
      openText.push(line.slice('# | '.length));
    } else {
      openText = null;
      kept.push(line.startsWith('# copilot: ') ? line.slice('# copilot: '.length) : line);
    }
  }
  return { kept, texts: new Map([...texts].map(([id, lines]) => [id, lines.join('\n')])) };
}

function dropClaudeBlocks(source, body) {
  const dropped = body.replace(/<!-- claude -->[\s\S]*?<!-- \/claude -->/g, '');
  if (dropped.includes('<!-- claude -->') || dropped.includes('<!-- /claude -->')) {
    fail(source, 'unbalanced <!-- claude --> marker');
  }
  return dropped;
}

function insertCopilotTexts(source, body, texts) {
  const used = new Set();
  const filled = body.replace(/<!-- copilot: ([a-z-]+) -->/g, (_, id) => {
    if (!texts.has(id)) fail(source, `placeholder names unknown copilot text "${id}"`);
    used.add(id);
    return texts.get(id);
  });
  for (const id of texts.keys()) {
    if (!used.has(id)) fail(source, `copilot text "${id}" is never used`);
  }
  return filled;
}

// Reads the flat keys and `  - item` lists of an agent's Claude front matter.
function readAgentFields(source, frontLines) {
  const fields = new Map();
  let listKey = null;
  for (const line of frontLines) {
    const item = line.match(/^ {2}- (.+)$/);
    if (item && listKey) {
      fields.get(listKey).push(item[1]);
      continue;
    }
    const entry = line.match(/^([A-Za-z]+):(?: (.*))?$/);
    if (!entry) fail(source, `can't read front matter line "${line}"`);
    const [, key, value] = entry;
    if (!AGENT_KEYS.includes(key)) fail(source, `front matter key "${key}" has no Copilot mapping`);
    listKey = value === undefined ? key : null;
    fields.set(key, value === undefined ? [] : value);
  }
  return fields;
}

function copilotTools(source, claudeTools) {
  const aliases = new Set(
    claudeTools.split(',').map((tool) => {
      const alias = TOOL_ALIASES.find(([claudeName]) => claudeName === tool.trim());
      if (!alias) fail(source, `tool "${tool.trim()}" has no Copilot alias`);
      return alias[1];
    }),
  );
  return COPILOT_TOOL_ORDER.filter((alias) => aliases.has(alias));
}

const flowList = (items) => `[${items.map((item) => `'${item}'`).join(', ')}]`;

// Copilot doesn't preload an agent's skills everywhere, so its body starts by naming them.
function agentCopy(source, fields, body) {
  const skills = fields.get('skills') ?? [];
  const front = [
    `name: ${fields.get('name')}`,
    `description: ${fields.get('description')}`,
    `tools: ${flowList(copilotTools(source, fields.get('tools') ?? ''))}`,
    `skills: ${flowList(skills)}`,
  ];
  const skillPaths = skills.map((skill) => `\`.github/skills/${skill}/SKILL.md\``).join(' and ');
  const readFirst = `Before anything else, read ${skillPaths} in full and apply them. They are the rules this role works by.`;
  return { front, body: `\n${readFirst}\n${body}` };
}

function substitute(body, substitutionHits) {
  let result = body;
  SUBSTITUTIONS.forEach(([from, to], index) => {
    const parts = result.split(from);
    substitutionHits[index] += parts.length - 1;
    result = parts.join(to);
  });
  return result;
}

function buildCopy(job, raw, substitutionHits) {
  const { frontLines, body } = splitFrontMatter(job.source, raw);
  const { kept, texts } = readFrontMatterMarks(job.source, frontLines);
  let copilotBody = substitute(dropClaudeBlocks(job.source, body), substitutionHits);
  copilotBody = insertCopilotTexts(job.source, copilotBody, texts);
  let front = kept;
  if (job.kind === 'agent') {
    ({ front, body: copilotBody } = agentCopy(job.source, readAgentFields(job.source, kept), copilotBody));
  }
  const header = `# Generated by yarn skills:build from ${job.source}. Edit that file, not this one.`;
  return ['---', header, ...front, '---', copilotBody].join('\n');
}

function jobs() {
  const skills = readdirSync(path.join(root, '.claude/skills'))
    .filter((name) => name.startsWith('kopiyka-') && existsSync(path.join(root, '.claude/skills', name, 'SKILL.md')))
    .map((name) => ({
      kind: 'skill',
      source: `.claude/skills/${name}/SKILL.md`,
      target: `.github/skills/${name}/SKILL.md`,
    }));
  const agents = readdirSync(path.join(root, '.claude/agents'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => ({
      kind: 'agent',
      source: `.claude/agents/${file}`,
      target: `.github/agents/${file.replace(/\.md$/, '.agent.md')}`,
    }));
  return [...skills, ...agents];
}

// Generated files whose source is gone.
function orphanCopies(allJobs) {
  const targets = new Set(allJobs.map((job) => job.target));
  const skillCopies = readdirSync(path.join(root, '.github/skills'))
    .filter((name) => name.startsWith('kopiyka-'))
    .map((name) => `.github/skills/${name}/SKILL.md`);
  const agentCopies = readdirSync(path.join(root, '.github/agents'))
    .filter((file) => file.endsWith('.agent.md'))
    .map((file) => `.github/agents/${file}`);
  return [...skillCopies, ...agentCopies].filter(
    (target) => existsSync(path.join(root, target)) && !targets.has(target),
  );
}

async function main() {
  const allJobs = jobs();
  const substitutionHits = SUBSTITUTIONS.map(() => 0);
  const outOfDate = [];
  for (const job of allJobs) {
    const raw = readFileSync(path.join(root, job.source), 'utf8');
    const targetPath = path.join(root, job.target);
    const options = { ...(await prettier.resolveConfig(targetPath)), filepath: targetPath };
    const copy = await prettier.format(buildCopy(job, raw, substitutionHits), options);
    const committed = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
    if (copy !== committed) {
      outOfDate.push(job.target);
      if (!checkOnly) {
        // A new kopiyka skill has no folder in .github/skills yet.
        mkdirSync(path.dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, copy);
      }
    }
  }
  SUBSTITUTIONS.forEach(([from], index) => {
    if (substitutionHits[index] === 0)
      fail('scripts/build-copilot-skills.mjs', `substitution "${from}" matches nothing`);
  });
  for (const orphan of orphanCopies(allJobs)) {
    outOfDate.push(orphan);
    if (!checkOnly) {
      const orphanPath = path.join(root, orphan);
      rmSync(orphanPath);
      // A removed skill's folder goes too, unless something else (a script, a reference) is left in it.
      if (readdirSync(path.dirname(orphanPath)).length === 0) rmSync(path.dirname(orphanPath), { recursive: true });
    }
  }

  if (checkOnly) {
    if (outOfDate.length === 0) {
      console.log('Copilot copies are up to date.');
      return;
    }
    console.error(['Out of date, run yarn skills:build:', ...outOfDate].join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`wrote ${outOfDate.length} files`);
}

main().catch((error) => {
  if (!(error instanceof SourceError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
});
