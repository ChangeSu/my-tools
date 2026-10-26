# CHANGELOG

<!-- CHANGELOG-ID: CHG-API-DOC-VIEWER-CURL-FIX -->
### [2026-10-26] - 修复 Swagger 可视化工具 multipart 接口报错 `media is not defined`
- 修复 `buildCurl` 中 `media` 变量声明在 `if (content.length)` 块内、却在后续 `multipart/form-data` 分支引用的作用域错误：改为函数级 `bodyMedia`，含文件上传（multipart）的接口不再导致整份文档解析失败。
- 自测：用 614KB、269 个接口、31 个分组的真实 Swagger 2.0 文档实测——解析 43ms，UI 导入约 0.5s；2 个 multipart 接口正常生成 `-F 'file=@<file>'` cURL；中文接口名路由（`#/ep/查询告警总数`）与搜索正常；导出 JSON/Markdown（877KB）/ZIP（270 项，UTF-8 文件名标志）均可生成，ZIP 经 `unzip -t` 校验；文档 JSON 可完整重导入（269 个接口 ID 一致）；localStorage 缓存约 1MB，未超上限；无控制台错误。
- 已知限制：无新增。

<!-- CHANGELOG-ID: CHG-API-DOC-VIEWER -->
### [2026-10-23] - 新增 Swagger 可视化文档工具
- 新增单文件零依赖工具 `tools/API文档/Swagger可视化.html`（导航自动收录为"API文档"分类）：粘贴/拖入 Swagger 2.0 或 OpenAPI 3.x JSON（≤20MB，纯本地解析），展开全部 `$ref`、合并 `allOf`、保留 `oneOf/anyOf`，循环引用自动截断并标注，外部引用给出提示；接口与参数、响应结构、示例、cURL 全部内联展示，无需跳转。
- 导出能力：整份文档导出自定义 `my-tools.api-doc` JSON（可再导入还原）、完整单文件 Markdown（含目录/锚点/参数表/字段树/示例）、分接口 ZIP 包（README 索引 + 每接口一个 .md，自实现 store-only ZIP：CRC32 + central directory，UTF-8 文件名），单个接口可单独复制/下载 Markdown 或 JSON。
- 界面：hash 路由（`#/overview`、`#/ep/<id>`、`#/import`）、localStorage 自动恢复上次文档（3.5M 字符上限）、侧栏搜索高亮与 `/` 快捷键、内容类型 Tab 切换（键盘可操作）、字段树折叠/全部展开、打印时自动展开全部折叠块、移动端抽屉导航与响应式布局（390px 无横向溢出）、全部文档内容经 HTML 转义防注入。
- 自测：Node 直测解析/导出/roundtrip（own-format 重导入端点数一致）；`PORT=3199 node server.js` + Chrome headless CDP 实测——示例文档总览/接口页渲染、搜索匹配与无结果态、字段树收起/展开、5 种导出（文件名与内容正确）、`unzip -t` 校验 ZIP 无错误、Swagger 2.0 + 外部引用告警、oneOf 组合块、3 内容类型 Tab 切换、YAML 输入友好报错、刷新恢复、移动端抽屉与溢出检查，无控制台错误。
- 已知限制：不支持 YAML 输入与外部 `$ref`（跳过并提示）；circular 引用仅展示引用名不展开；大文档（>3.5M 字符）不写 localStorage 缓存。

<!-- CHANGELOG-ID: CHG-IMG-BASE64-TOOL -->
### [2026-10-20] - 新增图片 Base64 互转工具
- 新增单文件零依赖工具 `tools/格式转换/图片Base64互转.html`（导航自动收录为"格式转换"分类）：图片 → Base64 支持点击选择、拖拽、页面粘贴，可去掉 `data:image/…;base64,` 头部（选择持久化到 localStorage `imgB64NoHeader`）、复制、下载 `base64.txt`，并展示预览与文件体积/Base64 长度；Base64 → 图片支持自动识别 data URL 头部、从剪贴板粘贴、预览及按 MIME 下载。
- 大字符串处理：textarea 展示上限 200000 字符，超出部分仅在内存保留（复制/解码仍使用完整内容）；解码通过 `fetch(data:...)` 交由浏览器原生处理，避免 JS 循环阻塞；非法 Base64 明确报错并禁用下载。全部处理在本地完成，无外链资源。
- 自测：本地 `PORT=3199 node server.js` 浏览器实测——1×1 PNG 编码输出带 data URL 头、预览加载成功（naturalWidth=1）；去头开关生效且 localStorage 记录；纯 Base64 解码为 blob 预览、meta 显示 `image/png　70 B`、下载按钮启用；非法输入提示错误且下载禁用；`/api/tools` 已收录该工具；除非法输入测试触发的预期 data URL 请求失败外无控制台错误。
- 已知限制：复制/读取剪贴板依赖浏览器权限与安全上下文（localhost/https）；手动编辑截断显示的输入框会丢弃内存中的完整内容；图片不做压缩或格式转换，输出为原始文件编码。

<!-- CHANGELOG-ID: CHG-MD-VIEWER-FOLDER-BROWSE -->
### [2026-10-20] - MD 文档查看器支持按文件夹浏览
- 新增"打开文件夹"（`<input webkitdirectory>`）与拖拽整个文件夹（`webkitGetAsEntry` 递归读取、`readEntries` 分批循环）；读取后在左侧 240px 目录侧栏按层级展示 `.md/.markdown/.txt`，目录可折叠，点击文件切换预览。
- 每个文件的编辑内容按相对路径缓存在内存中，切换文件不丢失修改；当前文件以深色高亮，顶栏展示相对路径。
- 相对路径图片支持：按当前文档所在目录解析 `![](...)`（含 `./`、`../`、URL 编码、大小写不敏感回退），文件夹内图片转 blob URL 惰性加载；找不到时保留原占位文本。切换文件夹时回收旧 blob URL。
- 导出 HTML 时将 blob 图片转 data URL 内嵌，目录模式下导出文件名取 basename，避免相对路径进入下载文件名。
- 自测：本地 `PORT=3199 node server.js`，浏览器合成 File/目录 Entry 实测——文件夹选择与拖拽目录均正确构建树（嵌套目录、中文名、折叠/展开）、点击切换与编辑缓存保留、相对图片 blob 加载成功（naturalWidth=1）、缺失图片占位、导出含 data URL 且无 blob URL、单文件拖拽与打开文件行为不回退、无控制台错误。内嵌浏览器无可见视口，截图不可用，改用计算样式断言（侧栏 240px、active 行 #222 底/白字）。
- 已知限制：Markdown 内的相对 `.md` 链接不会在查看器内跳转；文件编辑缓存仅存于内存，刷新页面后丢失；目录读取范围受浏览器所选文件夹限制。

<!-- CHANGELOG-ID: CHG-T09-MD-MERMAID-TOOLS -->
### [2026-10-14] - 新增 MD 文档查看器与 Mermaid 转图片工具
- 新增 `tools/MD文档查看器.html`：Markdown 编辑/预览双栏，内置 markdown 渲染（标题/列表/表格/代码块/引用）、Mermaid 图表渲染（依赖同目录 `tools/mermaid.min.js` 本地库，零外网依赖）、暗色图表主题、编辑实时刷新。
- 新增 `tools/格式转换/mermaid2pic.html`：Mermaid 代码转 SVG/PNG 图片，左侧编辑右侧实时预览，可直接下载导出。
- 自测：两个工具页面由本地服务正常加载，Mermaid 本地渲染不依赖外部 CDN（文件级检查无 http(s) 外链脚本）。
- 已知限制：mermaid.min.js 为内置第三方库，升级需手动替换。

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
