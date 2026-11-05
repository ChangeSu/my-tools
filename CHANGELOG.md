# CHANGELOG

<!-- CHANGELOG-ID: CHG-MD-AUTO-REFRESH -->
### [2026-11-05] - MD 文档查看器文件变化自动刷新 (MD-AUTO-REFRESH)

- 行为变更：打开/拖拽的 md 文件在页面重新获得焦点（窗口聚焦或标签页切回）时自动检测磁盘内容变化，变化则刷新预览并弹出 toast 提示；顶栏展示文件最后修改时间。
- 检测机制：优先走 File System Access API（showOpenFilePicker / showDirectoryPicker / 拖拽 getAsFileSystemHandle），每次通过 handle.getFile() 取全新 File 读取；不支持时回退 file input / webkitGetAsEntry 逻辑（外部替换后无法跟踪，提示重新打开）。
- 读取失败处理：写文件间隙/持锁期间自动重试（1.5 秒一次），持续失败超过 15 秒提示文件已丢失，点击文件名可重新打开；用户在编辑器中手动编辑过时不清除内容，改为提示"已更新，点击重新加载"。
- 已知限制：页面保持焦点期间（未失焦再聚焦）不会触发检测；旧浏览器回退路径下文件被外部替换后只能手动重新打开。
- 测试证据：Node 语法校验通过；手动验证单文件/文件夹模式下外部修改自动刷新、编辑保护、丢失提示（无自动化 UI 测试）。
