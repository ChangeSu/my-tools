# CHANGELOG

<!-- CHANGELOG-ID: CHG-T05-DOCKER-DELIVERY -->
### [2026-10-12] - T05 Docker 部署交付 (#5)
- 新增 docker-compose.yml：build 当前目录、`${PORT:-3000}` 宿主端口、`${TOOLS_DIR:-./tools}` 绑定挂载到 /data/tools、`restart: unless-stopped`、基于 node -e 的 healthcheck。相对挂载路径存在 compose 解析歧义，README 建议绝对路径。
- README 补齐部署三步说明（部署 / 挂载自定义（TOOLS_DIR、PORT 环境变量覆盖） / 添加新工具免重启）。
- 自测：`docker compose up -d --build` 后浏览器导航页正常渲染中文分类与工具、中文搜索过滤命中；运行中向挂载目录投放 `文本处理/端到端验证.html` 免重启即出现在 API 与页面并可打开（200）；`docker restart` 后服务自动恢复、healthcheck 转 healthy；验证后清理临时容器与探针文件。
- 已知限制：`docker compose down && up` 重建路径未单独重复验证（与 restart 等价于镜像不变、挂载不变场景）。

<!-- CHANGELOG-ID: CHG-T02-CATEGORY-SEARCH -->
### [2026-10-12] - T02 目录分类分组 + 搜索过滤 (#2)
- 导航页新增搜索框，按工具名/分类即时过滤（大小写不敏感、支持中文）；过滤后无可见卡片的分类整组隐藏，全部无匹配时显示"没有匹配的工具"提示，清空恢复全量分组。
- 分类数据（一级子目录=分类、根目录=未分类）由 #1 的服务端扫描与 API 提供，本条交付分组渲染与过滤交互。
- 自测：浏览器脚本断言五种输入（中文名称/英文大写/分类名/无匹配/清空）的分组与卡片显隐及提示均符合预期；移走分类内唯一文件后 API 即不再返回该分类、页面刷新后该组消失，恢复后重现。
- 已知限制：无。

<!-- CHANGELOG-ID: CHG-T01-SCAFFOLD-MIN-NAV -->
### [2026-10-12] - T01 项目脚手架 + 最小可演示导航 (#1)
- 新增零依赖 Node 服务：扫描 TOOLS_DIR 下 HTML（含子目录，一级子目录名作为 category 随 API 返回），提供 `/api/tools` 清单、`/tools/*` 文件托管与防目录穿越；托管静态导航页。
- 导航页拉取清单渲染卡片列表，点击新标签页打开工具；空目录与加载失败有提示。
- 新增 Dockerfile（node:20-alpine，TOOLS_DIR=/data/tools）与示例工具 `tools/字符统计.html`。基础镜像选 20-alpine：本机 Docker Hub 不可直连，仅 20-alpine 有本地缓存可离线构建。
- 自测：本地 `node server.js` 启动，`/api/tools` 返回示例工具；`/tools/字符统计.html` 200；`/tools/../server.js`、`/tools/%2e%2e/server.js`、`/tools/C:/windows/win.ini`、`/tools/..%5cserver.js` 均 404；新投放 HTML（含新子目录）刷新即出现在导航；浏览器验证卡片 `target=_blank` 且 href 正确。容器验证：`docker build` 成功，挂载宿主机 tools 目录后 `:3001/api/tools` 返回清单。
- 已知限制：docker-compose 一键部署与 README 完整部署文档由 #5 交付；分类分组/搜索 UI 由 #2 交付（服务端 category 数据本条已就绪）。
