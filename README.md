# my-tools

个人小工具导航站：自动扫描指定目录下的 HTML 小工具并提供导航页，支持分类分组、搜索过滤、iframe 内嵌预览、最近使用排序，可通过 Docker 部署。

## 快速开始

本地运行（需要 Node.js）：

```bash
node server.js
# 访问 http://localhost:3000
```

添加工具：把任意 `.html` 文件放入 `tools/` 目录（可用一级子目录作为分类），刷新导航页即可看到。

环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口 |
| `TOOLS_DIR` | `./tools` | 工具扫描目录 |

## Docker 部署

一键部署（默认挂载当前目录的 `tools/`、暴露 3000 端口）：

```bash
docker compose up -d --build
# 浏览器访问 http://localhost:3000
```

### 自定义挂载目录与端口

通过环境变量覆盖（bash 示例，PowerShell 用 `$env:PORT="3001"`）：

```bash
TOOLS_DIR=/d/my-html-tools PORT=3001 docker compose up -d
```

- `TOOLS_DIR`：宿主机上的工具目录（绝对路径最稳妥），容器内挂载到 `/data/tools`
- `PORT`：宿主机暴露端口，容器内部固定 3000

### 添加新工具

无需重启或重建：

1. 把任意 `.html` 文件放入挂载的工具目录，刷新导航页即出现；
2. 想要分类的话，在目录下一层建子目录（如 `文本处理/xxx.html`，子目录名即分类名）；
3. 文件名/分类支持中文；更深一层的子目录也会扫描，分类仍取第一层目录名。

## 文档

- [2026-10-12_01_工具导航站方案与工单.md](docs/2026-10-12_01_工具导航站方案与工单.md)

## 工单

实现工作拆分见 GitHub Issues（按依赖顺序编号，阻塞关系已在 issue 中声明）。
