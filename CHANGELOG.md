# CHANGELOG

<!-- CHANGELOG-ID: CHG-T01-SCAFFOLD-MIN-NAV -->
### [2026-10-12] - T01 项目脚手架 + 最小可演示导航 (#1)
- 新增零依赖 Node 服务：扫描 TOOLS_DIR 下 HTML（含子目录，一级子目录名作为 category 随 API 返回），提供 `/api/tools` 清单、`/tools/*` 文件托管与防目录穿越；托管静态导航页。
- 导航页拉取清单渲染卡片列表，点击新标签页打开工具；空目录与加载失败有提示。
- 新增 Dockerfile（node:20-alpine，TOOLS_DIR=/data/tools）与示例工具 `tools/字符统计.html`。基础镜像选 20-alpine：本机 Docker Hub 不可直连，仅 20-alpine 有本地缓存可离线构建。
- 自测：本地 `node server.js` 启动，`/api/tools` 返回示例工具；`/tools/字符统计.html` 200；`/tools/../server.js`、`/tools/%2e%2e/server.js`、`/tools/C:/windows/win.ini`、`/tools/..%5cserver.js` 均 404；新投放 HTML（含新子目录）刷新即出现在导航；浏览器验证卡片 `target=_blank` 且 href 正确。容器验证：`docker build` 成功，挂载宿主机 tools 目录后 `:3001/api/tools` 返回清单。
- 已知限制：docker-compose 一键部署与 README 完整部署文档由 #5 交付；分类分组/搜索 UI 由 #2 交付（服务端 category 数据本条已就绪）。
