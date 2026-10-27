// MD 文档查看器「导出 PDF」冒烟测试：启动本地服务 + headless Chrome(CDP) 验证打印样式与 PDF 生成
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 3211;
const CDP_PORT = 9300 + Math.floor(Math.random() * 500);
const PAGE_URL = `http://localhost:${PORT}/tools/${encodeURIComponent('MD文档查看器.html')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : '  -> ' + JSON.stringify(detail)}`);
  if (!ok) failures.push(name);
}

async function waitFor(fn, timeout = 20000, interval = 250) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await sleep(interval);
  }
  throw new Error('waitFor timeout');
}

function startServer() {
  const p = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore'
  });
  return p;
}

function startChrome(userDataDir) {
  const p = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });
  return p;
}

async function connectCdp() {
  const list = await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const arr = await res.json();
    return arr.find((t) => t.type === 'page');
  });
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.text + ' ' +
        (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || ''));
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
      (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
    return r.result.value;
  };
  return { ws, send, evaluate, exceptions };
}

const server = startServer();
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-chrome-'));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-out-'));
let chrome;
let cdp;

try {
  await waitFor(async () => (await fetch(`http://localhost:${PORT}/api/tools`)).ok);
  console.log('server ready');

  chrome = startChrome(userDataDir);
  cdp = await connectCdp();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);

  const base = await cdp.evaluate(`(() => ({
    title: document.title,
    btnLabel: document.getElementById('btnPdf').textContent.trim(),
    btnTitle: document.getElementById('btnPdf').title,
    mermaidLib: typeof mermaid
  }))()`);
  check('导出 PDF 按钮存在且文案正确', base.btnLabel === '导出 PDF', base.btnLabel);
  check('mermaid 本地库已加载', base.mermaidLib === 'object', base.mermaidLib);

  await cdp.evaluate(`(() => {
    const ed = document.getElementById('editor');
    ed.value = '# 导出 PDF 测试\\n\\n这是 **加粗** 与 \`行内代码\`。\\n\\n\`\`\`mermaid\\ngraph TD\\n  A[开始] --> B{判断}\\n  B -->|是| C[结束]\\n  B -->|否| A\\n\`\`\`\\n\\n\`\`\`js\\nconst x = 1;\\nconsole.log(x);\\n\`\`\`\\n\\n| 列1 | 列2 |\\n| --- | --- |\\n| 值1 | 值2 |\\n\\n> 引用块\\n\\n- 列表项1\\n- 列表项2\\n';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);

  const rendered = await waitFor(async () => await cdp.evaluate(`(() => {
    const pv = document.getElementById('preview');
    return !pv.hidden && !!pv.querySelector('.mermaid-block svg') && !!pv.querySelector('pre code') && !!pv.querySelector('table');
  })()`));
  check('预览已渲染（Mermaid/代码块/表格）', rendered === true);

  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(300);
  const printStyle = await cdp.evaluate(`(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    return {
      topbar: cs('.topbar').display,
      sidebar: cs('.sidebar').display,
      editorPane: cs('.editor-pane').display,
      emptyTip: cs('#emptyTip').display,
      toolbox: cs('.mermaid-tools').display,
      previewBorder: cs('#preview').borderTopWidth,
      previewMaxWidth: cs('#preview').maxWidth,
      bodyOverflow: cs('body').overflow,
      bodyHeight: cs('body').height,
      bodyDisplay: cs('body').display,
      preWhiteSpace: cs('#preview pre').whiteSpace,
      mermaidSvgMaxWidth: getComputedStyle(document.querySelector('.mermaid-block svg')).maxWidth
    };
  })()`);
  check('打印时隐藏顶栏/侧栏/编辑区/空提示/图表按钮',
    printStyle.topbar === 'none' && printStyle.sidebar === 'none' && printStyle.editorPane === 'none' &&
    printStyle.emptyTip === 'none' && printStyle.toolbox === 'none', printStyle);
  check('打印时预览取消卡片边框并放开滚动限制',
    printStyle.previewBorder === '0px' && printStyle.previewMaxWidth === 'none' &&
    printStyle.bodyOverflow === 'visible' && printStyle.bodyDisplay === 'block', printStyle);
  check('打印时代码块自动换行、图表宽度自适应',
    printStyle.preWhiteSpace === 'pre-wrap' && printStyle.mermaidSvgMaxWidth === '100%', printStyle);

  const pdf = await cdp.send('Page.printToPDF', { printBackground: false, preferCSSPageSize: true });
  const pdfBuf = Buffer.from(pdf.data, 'base64');
  const pdfPath = path.join(outputDir, 'smoke-output.pdf');
  fs.writeFileSync(pdfPath, pdfBuf);
  check('Page.printToPDF 生成有效 PDF（含 Mermaid/表格/代码/中文）',
    pdfBuf.subarray(0, 5).toString() === '%PDF-' && pdfBuf.length > 10000,
    { bytes: pdfBuf.length, file: pdfPath });

  await cdp.send('Emulation.setEmulatedMedia', { media: '' });

  const btnFlow = await cdp.evaluate(`(async () => {
    let called = 0;
    const origPrint = window.print;
    window.print = () => { called++; };
    const btn = document.getElementById('btnPdf');
    const originalTitle = document.title;
    document.getElementById('filename').textContent = 'docs/导出测试.md';
    btn.click();
    await new Promise((r) => setTimeout(r, 500));
    const duringTitle = document.title;
    window.dispatchEvent(new Event('afterprint'));
    const afterTitle = document.title;
    document.getElementById('filename').textContent = '未打开文件';
    window.print = origPrint;
    return { called, duringTitle, afterTitle, originalTitle };
  })()`, true);
  check('点击按钮触发打印且标题变为文档名（另存为 PDF 的默认文件名）',
    btnFlow.called === 1 && btnFlow.duringTitle === '导出测试', btnFlow);
  check('打印结束后标题恢复', btnFlow.afterTitle === btnFlow.originalTitle, btnFlow);

  check('无未捕获 JS 异常', cdp.exceptions.length === 0, cdp.exceptions);
} catch (e) {
  console.error('TEST ERROR:', e && e.stack || e);
  failures.push('runner: ' + (e && e.message || e));
} finally {
  try { if (cdp) cdp.ws.close(); } catch (e) {}
  try { if (chrome) chrome.kill(); } catch (e) {}
  try { if (server) server.kill(); } catch (e) {}
  await sleep(300);
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch (e) {}
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
