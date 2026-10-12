const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const TOOLS_DIR = path.resolve(process.env.TOOLS_DIR || './tools');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}

function notFound(res) {
  send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
}

function scanTools(dir, baseCategory, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const category = baseCategory === null ? entry.name : baseCategory + '/' + entry.name;
      scanTools(full, category, acc);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.html') {
      const rel = path.relative(TOOLS_DIR, full).split(path.sep).join('/');
      const mtimeMs = fs.statSync(full).mtimeMs;
      acc.push({
        path: rel,
        name: path.basename(entry.name, path.extname(entry.name)),
        category: baseCategory === null ? '未分类' : baseCategory,
        mtime: new Date(mtimeMs).toISOString(),
      });
    }
  }
  return acc;
}

function listTools() {
  return scanTools(TOOLS_DIR, null, []).sort(
    (a, b) => a.category.localeCompare(b.category, 'zh') || a.name.localeCompare(b.name, 'zh')
  );
}

// Resolve a URL path inside baseDir, rejecting traversal. Returns null when unsafe.
function safeJoin(baseDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (err) {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const segments = decoded.split('/');
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..' || seg.includes('\\')) return null;
  }
  const base = path.resolve(baseDir);
  const winRoots = new Set(path.parse(base).root.split(/[\\/]/).filter(Boolean).map(s => s.toUpperCase()));
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (winRoots.has(seg.toUpperCase())) return null;
  }
  return path.join(base, ...segments.filter(s => s !== '' && s !== '.'));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0].split('#')[0];

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (urlPath === '/') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  if (urlPath === '/api/tools') return sendJson(res, 200, { tools: listTools() });

  if (urlPath.startsWith('/tools/')) {
    const filePath = safeJoin(TOOLS_DIR, urlPath.slice('/tools/'.length));
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return notFound(res);
    return serveFile(res, filePath);
  }

  const publicPath = safeJoin(PUBLIC_DIR, urlPath);
  if (publicPath && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
    return serveFile(res, publicPath);
  }
  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`my-tools nav server listening on http://localhost:${PORT}`);
  console.log(`scanning tools dir: ${TOOLS_DIR}`);
});
