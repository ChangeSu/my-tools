(async function () {
  const statusEl = document.getElementById('status');
  const groupsEl = document.getElementById('groups');

  let tools = [];
  try {
    const resp = await fetch('/api/tools');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    tools = (await resp.json()).tools;
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = '加载失败：' + err.message;
    return;
  }

  if (tools.length === 0) {
    statusEl.hidden = false;
    statusEl.textContent = '暂无工具，请将 HTML 文件放入 tools/ 目录。';
    return;
  }

  const byCategory = new Map();
  for (const tool of tools) {
    if (!byCategory.has(tool.category)) byCategory.set(tool.category, []);
    byCategory.get(tool.category).push(tool);
  }

  for (const [category, items] of byCategory) {
    const group = document.createElement('section');
    group.className = 'group';
    const title = document.createElement('h2');
    title.className = 'group-title';
    title.textContent = category;
    group.appendChild(title);
    const list = document.createElement('div');
    list.className = 'tool-list';
    for (const tool of items) {
      const a = document.createElement('a');
      a.className = 'tool-card';
      a.href = '/tools/' + tool.path.split('/').map(encodeURIComponent).join('/');
      a.target = '_blank';
      a.dataset.name = tool.name.toLowerCase();
      a.dataset.category = tool.category.toLowerCase();
      const name = document.createElement('div');
      name.className = 'tool-name';
      name.textContent = tool.name;
      const pathEl = document.createElement('div');
      pathEl.className = 'tool-path';
      pathEl.textContent = tool.path;
      a.appendChild(name);
      a.appendChild(pathEl);
      list.appendChild(a);
    }
    group.appendChild(list);
    groupsEl.appendChild(group);
  }
  const toolbar = document.getElementById('toolbar');
  toolbar.hidden = false;
  const search = document.getElementById('search');
  const emptyHint = document.getElementById('empty');

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let visibleTotal = 0;
    for (const group of groupsEl.querySelectorAll('.group')) {
      let visible = 0;
      for (const card of group.querySelectorAll('.tool-card')) {
        const hit = !q || card.dataset.name.includes(q) || card.dataset.category.includes(q);
        card.hidden = !hit;
        if (hit) visible++;
      }
      group.hidden = visible === 0;
      visibleTotal += visible;
    }
    emptyHint.hidden = visibleTotal !== 0;
  }

  search.addEventListener('input', applyFilter);
})();
