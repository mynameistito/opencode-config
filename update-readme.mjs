import { readFileSync, writeFileSync } from 'fs';
import { get } from 'https';

function stripJsonComments(content) {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    if (inString) {
      if (char === '\') { result += char + content[i + 1]; i += 2; continue; }
      if (char === '"') inString = false;
      result += char; i++;
    } else {
      if (char === '"') { inString = true; result += char; i++; }
      else if (char === '/' && content[i + 1] === '/') {
        while (i < content.length && content[i] !== '\n') i++;
      } else if (char === '/' && content[i + 1] === '*') {
        i += 2;
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
        i += 2;
      } else { result += char; i++; }
    }
  }
  return result;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { 'User-Agent': 'github-actions' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function normalizeGitUrl(url) {
  if (!url) return null;
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/');
}

async function main() {
  const content = readFileSync('opencode.jsonc', 'utf8');
  const plugins = JSON.parse(stripJsonComments(content)).plugin || [];

  const rows = [];
  for (const entry of plugins) {
    if (entry.startsWith('file://')) {
      const filename = entry.replace(/^file:\/\/.*\//, '');
      rows.push(`| ${filename} | Local plugin (\`plugins/${filename}\`) |`);
    } else {
      const pkgName = entry
        .replace(/(@[^/]+\/[^@]+)@.*$/, '$1')
        .replace(/^([^@][^@]*)@.*$/, '$1');
      try {
        const encoded = pkgName.replace('/', '%2F');
        const res = await httpsGet(`https://registry.npmjs.org/${encoded}`);
        if (res.status === 200) {
          const meta = JSON.parse(res.body);
          const repoUrl = normalizeGitUrl(meta.repository?.url || '');
          if (repoUrl && repoUrl.includes('github.com')) {
            rows.push(`| ${pkgName} | [${repoUrl}](${repoUrl}) |`);
          } else {
            rows.push(`| ${pkgName} | [https://www.npmjs.com/package/${pkgName}](https://www.npmjs.com/package/${pkgName}) |`);
          }
        } else {
          rows.push(`| ${pkgName} | [https://www.npmjs.com/package/${pkgName}](https://www.npmjs.com/package/${pkgName}) |`);
        }
      } catch (e) {
        rows.push(`| ${pkgName} | [https://www.npmjs.com/package/${pkgName}](https://www.npmjs.com/package/${pkgName}) |`);
      }
    }
  }

  const table = ['| Plugin | Source |', '|--------|--------|', ...rows].join('\n');

  const readme = readFileSync('README.md', 'utf8');
  const updated = readme.replace(/(## Plugins\n\n)[\s\S]*?(\n\n## )/, `$1${table}$2`);
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const final = updated.replace(/(## Last Synced\n\n).*/, `$1${now}`);

  writeFileSync('README.md', final);
  console.log('README updated.\nNew table:\n' + table);
}

main().catch(e => { console.error(e); process.exit(1); });
