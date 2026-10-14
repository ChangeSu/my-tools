# CHANGELOG

<!-- CHANGELOG-ID: CHG-T04-NAV-SIMPLIFY -->
### [2026-10-14] - 导航页按用户要求精简（去最近使用/排序/页面内预览）
- 导航页行为简化：移除"最近使用"记录（localStorage 的 my-tools-recent 不再读写）、移除排序下拉（固定按名称 localeCompare('zh') 排序、按分类分组）、移除 iframe 页面内预览浮层（含 hash 路由 #tool=、preview-overlay/打开/关闭按钮与 Esc 处理），点击卡片直接以 target=_blank + rel=noopener 在新标签页打开工具。
- 涉及文件：public/app.js 重写为"加载列表→按分类分组渲染→搜索过滤"三步；public/index.html 删除排序下拉与预览浮层 DOM；public/app.css 删除 .sort-label/#sort 与 .preview-* / #preview-* 样式；README.md 功能描述同步更新。
- 自测：`node server.js`（PORT=18088）实跑，/ 返回 200 且 DOM 无 sort/preview/recent 元素、app.js 无 recordOpen/localStorage 引用、卡片 a 标签含 target=_blank 与 rel=noopener；/api/tools 正常返回 7 个工具；搜索过滤与分组渲染正常。
- 已知限制：此前通过 #tool=xxx 分享的 hash 链接不再被识别，会直接显示导航页。

<!-- CHANGELOG-ID: CHG-T08-JSVC-MANAGER-UI-SIMPLIFY -->
### [2026-10-14] - 服务管理页按用户反馈精简
- 按用户要求：日志不再做在线查看，改为新增"日志文件"列直接展示 logFile 路径（hover title 显示全路径）；移除"打开"和"删除"按钮（URL 列保留可点击链接），行操作仅剩 停止/启动。服务端同步删除随之不再使用的 `GET /api/services/log` 与 `POST /api/services/action` 的 delete 分支。
- 自测：`docker compose up -d --build`（PORT=18087）重建后页面含"日志文件"列、无 日志/打开/删除 相关 DOM 与 `/api/services/log` 引用；`/api/services/log` 返回 404；`/api/services` 三条记录及 logFile 路径正确；healthcheck healthy。
- 已知限制：无。

<!-- CHANGELOG-ID: CHG-T08-JSVC-MANAGER-REMOTE -->
### [2026-10-14] - 服务管理支持 docker 部署（远程模式）
- docker 部署的 my-tools 更新至含服务管理的版本：server.js 新增 `JSVC_HEALTH_HOST` 远程模式——注册表挂载进容器但无法操作宿主机进程，判活改为对 `JSVC_HEALTH_HOST:port` 的 TCP 探测（替代 PID 检测）、健康检查将 URL 中 `localhost/127.0.0.1` 重写为该主机名；stop/start/delete 在远程模式下一律拒绝并返回明确提示；`tools/服务管理.html` 远程模式下禁用停止/启动/删除按钮并以 title 说明原因。
- docker-compose.yml 挂载 `${SVC_REGISTRY:-c:/Users/keda/.java-service-registry.yml}`（只读）到 `/data/java-service-registry.yml`，注入 `JSVC_REGISTRY_PATH` 与 `JSVC_HEALTH_HOST=host.docker.internal`。
- 自测：`docker compose up -d --build` 重建后 `/api/services` 返回 3 条记录、远程模式 TCP 判活与真实状态一致（全部停止）、宿主机在监听端口从容器内可达；action 被拒绝且提示明确；`/api/tools` 7 个工具、服务管理页 200；healthcheck 转 healthy；部署端口保持 18087（重建时需 `PORT=18087`，本次曾因漏带该变量短暂重建为 3000 后已纠正）。
- 已知限制：远程模式下日志查看不可用（logFile 为宿主机路径，容器内不存在，返回 404）；若注册表文件不存在，compose 的文件 bind 挂载会创建同名目录导致读取为空，需先保证文件存在。

<!-- CHANGELOG-ID: CHG-T08-JSVC-MANAGER -->
### [2026-10-14] - 新增 Java 服务管理工具
- 新增单文件零依赖工具 `tools/服务管理.html`（出现在导航"未分类"分组），管理 jrun 技能写入的 `~/.java-service-registry.yml`：表格展示全部服务记录，状态列为 PID 存活检测（process.kill(pid,0)）+ 运行中服务的 URL 健康探测（GET 1.5s 超时，<500 视为健康）；每行支持日志查看（服务端读取 logFile 末尾 128KB、返回末 400 行）、打开 URL、停止（taskkill /T /F）、启动（java -jar + `--server.port`/合法 profile 名/extraArgs，JDK 四选一 jdk8/11/17/21，10s 自动刷新期间选择持久化 localStorage）、删除记录（运行中禁止删除/启动）。10s 自动刷新可关。
- server.js 新增 API：`GET /api/services`（清单+存活+健康）、`GET /api/services/log?name=`（仅允许注册表内记录的 logFile，防任意路径读取）、`POST /api/services/action`（stop/start/delete）；注册表解析采用"头部行+每服务行块"结构，字段更新为行级编辑并写回，`site`/`warPath`/`extraArgs` 等未枚举字段不会丢失；注册表路径可用 `JSVC_REGISTRY_PATH` 环境变量覆盖。
- 自测：临时注册表+测试 jar 端到端实跑——start 后 PID 存活、健康检查对无 HTTP 服务正确返回 false；运行中删除/重复启动均被拒绝；stop 后 stopTime 落盘、删除后条目消失；日志接口返回内容正确；`/api/tools` 列出"服务管理.html"、页面 200 `text/html; charset=utf-8`；全程验证真实注册表未被测试写入、无残留 java 进程。
- 已知限制：启动仅支持 jarPath 为文件的可执行 jar/war（exploded war 等形态仍需通过 jrun 技能）；profile 字段仅当形如 `dev/test/prod` 等合法名时透传，注册表中的自由描述文本会被跳过；日志查看按 400 行截断、UTF-8 解码（GBK 日志可能乱码）。

<!-- CHANGELOG-ID: CHG-T07-TIMESTAMP-CONVERT -->
### [2026-10-13] - 新增时间戳转换工具
- 新增单文件零依赖工具 `tools/格式转换/时间戳转换.html`，双向换算：时间戳 → 本地/UTC 日期时间、ISO 8601、秒/毫秒戳、相对现在；日期时间 → 秒/毫秒戳、UTC/本地时间。支持自动识别秒级/毫秒级（`|v| < 1e11` 视为秒）、可选按本地时区或 UTC 解析、回车触发转换、可识别 `YYYY-MM-DD`/`YYYY/MM/DD`/`YYYY-MM-DD HH:mm[:ss]`/ISO 写法；顶部实时显示当前秒级/毫秒级戳（1s 轮询），各结果字段带单独复制按钮；样式沿用导航站浅色扁平规范（#f7f7f8 底 / #fff 面 / #e5e5e5 边 / 黑底白字主按钮）。
- 自测：Node 侧以最小 DOM stub 加载页面内联脚本，13 条断言全绿——本地/UTC 解析四种写法与三组非法输入（乱文本、13 月、25 时）拒绝、`formatLocal`/`formatUtc` 补零正确、相对时间“2 小时前 / 3 天后 / 刚刚”；导航服务实跑（PORT=3199）确认 `/api/tools` 返回 `{path:"格式转换/时间戳转换.html",category:"格式转换"}`、`/tools/格式转换/时间戳转换.html` 返回 200 且 `text/html; charset=utf-8`、title 正确。
- 已知限制：`Date.parse` 兜底分支未覆盖带时区偏移（如 `+08:00`）写法之外的模糊格式；毫秒精度超出 JS Date 范围（±8.64e15）时报“超出可表示范围”。

<!-- CHANGELOG-ID: CHG-OPS-COMPOSE-MEM-LIMIT -->
### [2026-10-12] - compose 内存上限 (#5 后续运维加固)
- docker-compose.yml 增加 `mem_limit: 128m` 与 `memswap_limit: 128m`（非 swarm 部署生效，超限由内核 OOM 杀容器、由 restart 策略拉起）；README Docker 部署节补充说明。
- 自测：`docker compose up -d` 重建后 inspect 确认 Memory=134217728、MemorySwap=134217728；`/api/tools` 200；`docker stats` 实测 8.7MiB/128MiB（6.81%）。
- 已知限制：无。

<!-- CHANGELOG-ID: CHG-STY-NAV-LIGHT-FLAT-ADMIN -->
### [2026-10-12] - 导航站改版为浅色扁平企业后台风（纯样式，用户提供配色规范）
- app.css 按规范全量重写：页面底 #f7f7f8、顶栏/分组/卡片面 #ffffff、主文本 #222、次要文本 #666、弱化文本 #999、边框/分割线 #e5e5e5、卡片 hover 浅灰 #f5f5f6（仿表格行）；主操作按钮（关闭）黑底白字，次要按钮（新标签页打开）白底灰边黑字；紧凑控件（7px 内边距、6px 圆角、13px 字号）、搜索+排序横向排列；无渐变无阴影，保留 sticky 头部、focus-visible、<640px 堆叠。
- index.html 仅 favicon data URI 由蓝色改为 #222 配色；结构、app.js、服务端零改动。
- 自测：浏览器计算样式断言 bodyBg=rgb(247,247,248)、header=#fff、关闭按钮 #222 底/#fff 字、打开链接 #fff 底/#e5e5e5 边/#222 字、路径文本 #666；功能回归（过滤、iframe 预览开关、ESC、最近使用区、无重复渲染）全绿。
- 已知限制：内嵌浏览器视图隐藏导致截图不可用，视觉以计算样式断言为准；配色规范中的状态标签绿 #27a243 已入变量但导航页当前无状态标签场景。

<!-- CHANGELOG-ID: CHG-STY-NAV-DARK-THEME -->
### [2026-10-12] - 导航站深色现代风改版（纯样式）
- app.css 全量重写：深色主题（#16181d 底、#6c8cff 强调色、CSS 变量统一管理）、sticky 头部、胶囊搜索框带 focus 光圈、分组卡片化容器、卡片 hover 上浮微交互、focus-visible 可达性、<640px 响应式堆叠；全局 `[hidden]{display:none!important}` 保障过滤显隐语义。
- index.html 仅新增装饰：内联 SVG Logo/放大镜/关闭叉号、data URI favicon；app.js 与服务端零改动。
- 自测：干净页面单次断言全绿——3 工具 3 分组渲染、base64 过滤命中 1 卡片 1 分组、无匹配提示、清空恢复、iframe 预览打开/ESC 关闭/hash 复原、打开后"最近使用"区出现、无横向滚动、深色背景生效；grep 确认无 http(s) 外链资源。
- 已知限制：tools/ 下各工具页仍为各自浅色样式（本次改版范围为导航站外壳）。

<!-- CHANGELOG-ID: CHG-T04-RECENT-SORT -->
### [2026-10-12] - T04 最近使用与排序 (#4)
- 导航页重构为状态化 render()：打开工具（含新标签链接点击）时写入浏览器 localStorage 最近记录（按 path 去重、时间戳排序、置顶"最近使用"区最多 8 条）；新增排序下拉：按名称（默认，分类分组）/按最近使用/按最新（文件 mtime 倒序），选择持久化本地。
- 排序与 #2 搜索过滤正交：任一模式下过滤行为、空组隐藏与无匹配提示保持一致。
- 自测：浏览器断言 seeded 两条记录置顶顺序正确、打开"字符统计"后其升至首位且记录仍去重为 2 个 key；newest 模式 touch 后 JSON格式化 居首；recent 模式无历史回退名称序；切换后刷新排序选择保持（localStorage 值 newest）；清除记录后"最近使用"区消失、回退默认 name 分组；过滤 base64 在 recent 模式命中正确。
- 已知限制：最近记录上限 8 条为展示截断、存储不设上限（个人使用规模可控）。

<!-- CHANGELOG-ID: CHG-T03-IFRAME-PREVIEW -->
### [2026-10-12] - T03 iframe 内嵌预览 (#3)
- 导航页点击工具卡片改为站内全屏 iframe 浮层打开：顶栏含工具名、"新标签页打开"链接与关闭按钮；ESC/关闭按钮收起浮层，列表层保持原位不丢滚动；预览状态写入 URL hash（`#tool=<path>`），刷新或分享链接可恢复。
- hash 路径校验：仅允许非空段相对路径且以 .html/.htm 结尾，拒绝 `//host`（协议相对）、`..`、反斜杠构造（CHG-T03 缝合点：currentToolPath）。
- 自测：浏览器断言 带 hash 刷新恢复浮层(iframe 内页 title 可读、同源)、点击卡片开/ESC 关/关闭按钮关、scrollY 保持、恶意 hash 三种构造均不设置 iframe src；工具页在新标签链接指向正确 URL。
- 已知限制：浏览器后退回到"已关闭"历史条目时按 URL 状态重建浮层（hash 即状态的固有语义）；iframe 内部交互未单独脚本断言（同源且独立页已实测可用）。

<!-- CHANGELOG-ID: CHG-T06-SAMPLE-TOOLS -->
### [2026-10-12] - T06 补充示例工具 (#6)
- 新增单文件零依赖示例工具：`tools/格式转换/JSON格式化.html`（格式化/压缩/缩进选择/复制，非法输入报错）、`tools/编码加密/Base64编解码.html`（UTF-8 中英文编解码往返，非法 Base64 报错）。
- 自测：API 返回 编码加密/格式转换/未分类 三个分类；浏览器内 JSON 工具格式化输出缩进正确、`{bad json!!` 触发解析错误提示、压缩去空白正确；Base64 工具 "你好 hello" 编码为 `5L2g5aW9IGhlbGxv` 且解码往返一致、非法输入显示错误。
- 已知限制：无。

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
