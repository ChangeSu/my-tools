const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execFile, spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const TOOLS_DIR = path.resolve(process.env.TOOLS_DIR || './tools');
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const REGISTRY_PATH = process.env.JSVC_REGISTRY_PATH
  ? path.resolve(process.env.JSVC_REGISTRY_PATH)
  : path.join(os.homedir(), '.java-service-registry.yml');
// 远程模式（如 docker 部署）：注册表挂载进容器，但无法操作宿主机进程，
// 判活/健康检查改走该主机名的 TCP/HTTP 探测，stop/start/delete 一律拒绝
const HEALTH_HOST = process.env.JSVC_HEALTH_HOST || '';
const JAVA_HOMES = {
  jdk8: 'C:\\develop\\jdk\\jdk1.8.0_281',
  jdk11: 'C:\\develop\\jdk\\jdk-11.0.9',
  jdk17: 'C:\\develop\\jdk\\amazon_corretto_17.0.17',
  jdk21: 'C:\\develop\\jdk\\jdk-21.0.11',
};

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

// ---- Java service registry (~/.java-service-registry.yml，与 jrun 技能共享) ----
// 行级块编辑：解析为“头部行 + 每服务一个行块”，更新字段只改对应行，
// 保证 extraArgs/warPath 等脚本未枚举的字段在写回时不会丢失。

function parseRegistry(text) {
  const header = [];
  const blocks = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*-\s+name:\s*/.test(line)) {
      cur = [line];
      blocks.push(cur);
    } else if (cur && /^\s+[A-Za-z_]\w*:\s/.test(line)) {
      cur.push(line);
    } else if (!cur) {
      header.push(line);
    }
  }
  return { header, blocks };
}

function readRegistry() {
  let text = '';
  try {
    text = fs.readFileSync(REGISTRY_PATH, 'utf8');
  } catch (err) {
    return { header: ['services:'], blocks: [] };
  }
  return parseRegistry(text);
}

function writeRegistry(reg) {
  const parts = [...reg.header, ...reg.blocks.map(b => b.join('\n'))];
  const text = parts.join('\n');
  fs.writeFileSync(REGISTRY_PATH, text.endsWith('\n') ? text : text + '\n', 'utf8');
}

function blockFields(block) {
  const obj = {};
  for (const line of block) {
    const m = line.match(/^\s*-\s*([A-Za-z_]\w*):\s*(.*)$/) || line.match(/^\s+([A-Za-z_]\w*):\s*(.*)$/);
    if (m) obj[m[1]] = m[2].trim();
  }
  return obj;
}

function findBlock(blocks, name) {
  return blocks.find(b => blockFields(b).name === name);
}

function setBlockField(block, key, value) {
  const re = new RegExp('^(\\s*-\\s*|\\s+)' + key + ':\\s*(.*)$');
  const idx = block.findIndex(l => re.test(l));
  if (idx >= 0) block[idx] = block[idx].replace(re, (m, prefix) => prefix + key + ': ' + value);
  else block.push('    ' + key + ': ' + value);
}

function removeBlockField(block, key) {
  const idx = block.findIndex(l => new RegExp('^\\s*(?:-\\s*)?' + key + ':').test(l));
  if (idx >= 0) block.splice(idx, 1);
}

function localNow() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function pidAlive(pid) {
  const n = Number(pid);
  if (!n) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function tcpAlive(port) {
  return new Promise(resolve => {
    const sock = net.connect({ host: HEALTH_HOST, port: Number(port), timeout: 1500 });
    sock.on('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('timeout', () => {
      sock.destroy();
      resolve(false);
    });
    sock.on('error', () => resolve(false));
  });
}

function remoteUrl(url) {
  if (!HEALTH_HOST || !url) return url;
  return url.replace('//localhost:', '//' + HEALTH_HOST + ':').replace('//127.0.0.1:', '//' + HEALTH_HOST + ':');
}

function checkHealth(url) {
  return new Promise(resolve => {
    try {
      const req = http.get(url, { timeout: 1500 }, r => {
        r.resume();
        resolve(r.statusCode < 500);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
    } catch (err) {
      resolve(false);
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 10240) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleListServices(res) {
  const reg = readRegistry();
  const services = reg.blocks.map(blockFields);
  await Promise.all(
    services.map(async s => {
      if (HEALTH_HOST) {
        s.alive = s.port ? await tcpAlive(s.port) : false;
        s.remoteMode = true;
      } else {
        s.alive = pidAlive(s.pid);
      }
      s.healthy = s.alive && s.url ? await checkHealth(remoteUrl(s.url)) : null;
    })
  );
  sendJson(res, 200, { services, registryPath: REGISTRY_PATH });
}

async function handleServiceAction(res, raw) {
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch (err) {
    return sendJson(res, 400, { error: '请求体不是合法 JSON' });
  }
  const { name, action } = body;
  if (!name || typeof name !== 'string') return sendJson(res, 400, { error: '缺少 name 参数' });
  const reg = readRegistry();
  const block = findBlock(reg.blocks, name);
  if (!block) return sendJson(res, 404, { error: '注册表中未找到服务: ' + name });
  if (HEALTH_HOST) {
    return sendJson(res, 400, {
      error: '当前工具站为 docker/远程部署，无法操作宿主机进程；停止/启动/删除请在本机运行的工具站使用',
    });
  }
  const svc = blockFields(block);

  if (action === 'stop') {
    if (svc.pid && pidAlive(svc.pid)) {
      await new Promise(resolve => {
        execFile('taskkill', ['/PID', String(svc.pid), '/T', '/F'], { windowsHide: true }, () => resolve());
      });
      await new Promise(r => setTimeout(r, 1000));
    }
    setBlockField(block, 'status', 'stopped');
    setBlockField(block, 'stopTime', localNow());
    writeRegistry(reg);
    return sendJson(res, 200, { ok: true, message: `${name} 已停止` });
  }

  if (action === 'start') {
    if (svc.pid && pidAlive(svc.pid)) {
      return sendJson(res, 400, { error: `${name} 进程仍在运行 (PID ${svc.pid})，请先停止` });
    }
    const jarPath = svc.jarPath || '';
    const jarOk = jarPath && fs.existsSync(jarPath) && fs.statSync(jarPath).isFile();
    if (!jarOk) {
      return sendJson(res, 400, {
        error: `${name} 的 jarPath 不是可执行文件（exploded war 等形态请通过 jrun 技能启动）: ${jarPath || '(空)'}`,
      });
    }
    const javaKey = JAVA_HOMES[body.javaHome] ? body.javaHome : 'jdk8';
    const javaExe = path.join(JAVA_HOMES[javaKey], 'bin', 'java.exe');
    if (!fs.existsSync(javaExe)) return sendJson(res, 500, { error: '找不到 java: ' + javaExe });

    const args = ['--server.port=' + (svc.port || 8080)];
    // profile 仅在像 Spring profile 名时透传，注册表里也有自由描述文本（如 "offline(spring) + ..."）
    if (svc.profile && /^[A-Za-z0-9,_-]+$/.test(svc.profile)) {
      args.push('--spring.profiles.active=' + svc.profile);
    }
    if (svc.extraArgs) args.push(...String(svc.extraArgs).trim().split(/\s+/));

    const logFile = svc.logFile || path.join(path.dirname(jarPath), 'logs', name + '-out.log');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const out = fs.openSync(logFile, 'a');
    const child = spawn(javaExe, ['-jar', jarPath, ...args], {
      cwd: path.dirname(jarPath),
      detached: true,
      windowsHide: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
    fs.closeSync(out);

    await new Promise(r => setTimeout(r, 1500));
    if (!pidAlive(child.pid)) {
      return sendJson(res, 500, { error: `${name} 进程启动后很快退出，请查看日志: ${logFile}` });
    }
    setBlockField(block, 'pid', String(child.pid));
    setBlockField(block, 'startTime', localNow());
    removeBlockField(block, 'stopTime');
    setBlockField(block, 'status', 'running');
    writeRegistry(reg);
    return sendJson(res, 200, { ok: true, message: `${name} 已启动 (PID ${child.pid})`, pid: child.pid });
  }

  return sendJson(res, 400, { error: '未知 action: ' + action });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0].split('#')[0];

  if (req.method === 'POST') {
    if (urlPath === '/api/services/action') {
      try {
        return await handleServiceAction(res, await readBody(req));
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (urlPath === '/') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  if (urlPath === '/api/tools') return sendJson(res, 200, { tools: listTools() });
  if (urlPath === '/api/services') return handleListServices(res);

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
  console.log(`java service registry: ${REGISTRY_PATH}`);
});
