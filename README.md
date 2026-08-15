# 左侧文件浏览器 (fexp)

DSH 动态 Cordis 插件 —— 在左侧工作区浏览和打开目录及文件。

## 功能

- **双入口**(均为 SVG 矢量图标; 颜色全部使用主题 CSS 变量, 浅色/深色及
  任意主题下文字与背景都保持对比, v1.2.3):
  - 侧栏顶部「工作区」标题行右侧的「文件浏览」胶囊按钮(宽栏时显示)
  - 会话标题栏「打开目录」按钮
- **浏览面板**(点击任意入口滑出, 320px, 覆盖左侧区域):
  - 自动定位到**当前工作区目录**(当前会话 cwd, 如 `dsh demo`); 切换工作区
    后面板自动重新定位到新工作区目录(v1.2.2), 同一工作区重开保留上次浏览位置
  - 目录在前、文件在后, 文件显示大小; 点击目录进入、点击文件预览
  - 面包屑任意层级跳转; 工具栏: 当前工作区 / 回到根目录 / 上一级 / 刷新 / **在系统资源管理器中打开**
  - 文件预览: 文本内容(默认 256KB 上限, 最大 1MB), 二进制/超限有明确提示
  - 预览头部: 文件名 / 大小 / **[添加到聊天]** / 关闭预览
- **在系统资源管理器中打开**(v1.1.0): 浏览面板工具栏最右侧按钮, 一键用系统
  资源管理器打开当前浏览的目录(DSH 原生 `host.openPath`, Windows 走 `Invoke-Item`)
- **添加到聊天**(v1.2.0): 预览文件时点击「添加到聊天」(位于「关闭预览」左侧),
  把文件引用 `[文件名](绝对路径)` 追加到聊天输入框草稿(不覆盖已有内容), 由
  用户补充说明后发送, 方便告诉 AI 具体文件信息; 可连续添加多个文件
  (v1.2.1 起按钮保持常显, 无「已添加」状态)

## 文件结构

| 文件 | 说明 |
| --- | --- |
| `host-source.js` | cordis_define 的 `code.host` 函数体原文(Host 半区 RPC) |
| `client-source.js` | cordis_define 的 `code.client` 函数体原文(Client 半区 UI) |
| `manifest.json` | 插件元数据 + 恢复定义参数(plugin/name/purpose) |

## 技术要点

- **Host 半区**: 通过 `harness.handle` 暴露三个 Package-private RPC:
  `default-root` / `list-dir` / `read-file`, 底层使用 DSH 的 `fs` 服务
  (resolve/listDir/stat/readText) 与 `sandboxPolicy.workspaceRoot`。
- **Client 半区**: 全部使用增量插槽(`shell.overlay`、
  `conversation.session.header.actions`、`sidebar.footer.action`), 不替换任何
  内置 UI; 纯 JS + `React.createElement`, 无 JSX/TS。
- **竞态修复(v1.0.0)**: `useStore` 订阅后立即自愈同步当前状态, 避免"探针写入
  早于订阅导致更新丢失"的启动时序竞态; `sidebarWide` 默认 `true`, 探针异常时
  顶部按钮仍可见。
- **打开资源管理器(v1.1.0)**: Client 直接调用 `ctx.get('workspaces').openPath(path)`
  (即 DSH 原生 `host.openPath`, Windows 走 `Invoke-Item`, 目录即用资源管理器
  打开); 不新增 Host RPC, 无 spawn/网络能力。
- **添加到聊天(v1.2.0)**: 利用 `sessions.provide` 标准包 —— 会话作用域插槽
  `conversation.input.dock` 内的隐藏桥组件捕获 `inputActions`(setDraft) 与
  `useInput`(草稿订阅), 面板「添加到聊天」调用 `setDraft(现有草稿 + 文件引用)`;
  这是内置 UI 写输入框的同一官方通道, 纯 Client 能力, 无新 Host RPC。
- **工作区绑定(v1.2.2)**: 面板加载 effect 原以 `path === null` 为守卫, 之前浏览过
  后关闭再打开(或切换工作区)不会重新加载, 导致「文件浏览」展示上一个工作区的
  旧目录; 新增 `boundWs` 绑定状态, 打开面板/工作区切换时若 `boundWs !== 当前
  wsPath` 即重新绑定并加载当前工作区目录, 同一工作区重开保留上次浏览位置;
  双入口统一走 `openPanelFor`, 工具栏「当前工作区目录」走 `bindWorkspace`。
- **主题对比度(v1.2.3)**: 入口按钮(「文件浏览」/「打开目录」)原用内联硬编码颜色
  (文字 `#e8edf3` 近白), 浅色主题下看不清; 改为 CSS 类 `.fexp-entry-btn` /
  `.fexp-entry-btn-active`, 颜色全部走主题 CSS 变量(`label-primary` 文字、
  `bg-layer-1/2` 背景、`border-l2` 边框、`brand-primary` 激活态), 深浅色及
  任意主题自动适配, 附 hover 反馈。
- **安全审查**: WARN 级(33/300), 仅涉及已声明的 fs 文件系统访问与常规 RPC,
  无网络/spawn; v1.1.0/v1.2.0/v1.2.3 审查结果与 v1.0.0 持平。

## 恢复 / 重建步骤(DSH 重启后)

动态 Cordis 插件不跨 DSH 进程存续, 重启后按以下步骤一键重建:

1. 让助手(或你自己)读取本目录的 `host-source.js` 与 `client-source.js` 内容;
2. 调用 `cordis_define`, 参数为:
   - `plugin`: `{ "kind": "new", "idPrefix": "fexp" }`
   - `name`: `左侧文件浏览器`
   - `purpose`: manifest.json 中的 `purpose` 字段
   - `code.host`: host-source.js 的完整内容(函数体)
   - `code.client`: client-source.js 的完整内容(函数体)
3. 调用 `cordis_run` 激活返回的 `pluginId`/`packageId`(首次需要批准)。

一句话提示词: 「按 `fexp-file-explorer` 目录重建文件浏览器插件」。

## 版本历史

| 版本 | 说明 |
| --- | --- |
| v1.2.3 | 修复「文件浏览」「打开目录」按钮浅色主题下文字看不清: 入口按钮改为 CSS 类并全部使用主题 CSS 变量(`label-primary` 文字 / `bg-layer-1/2` 背景 / `brand-primary` 激活态), 深浅色及任意主题自动适配保证对比, 补充 hover 反馈; Host 无改动 |
| v1.2.2 | 修复「文件浏览」打开面板定位到上一个工作区目录: 面板加载 effect 的 `path===null` 守卫导致切换工作区后不重载; 新增 `boundWs` 工作区绑定, 打开面板/切换工作区时自动重定位到当前工作区目录, 双入口统一走 `openPanelFor`; Host 无改动 |
| v1.2.1 | 修复「已添加」状态不合理: 按钮保持「添加到聊天」常显可用, 支持连续多次添加文件 |
| v1.2.0 | 新增预览区「添加到聊天」按钮: 经 `conversation.input.dock` 隐藏桥捕获标准包 `inputActions/useInput`, 把文件引用追加到输入框草稿, 用户编辑后发送; 纯 Client 能力, 安全审查持平 WARN(33/300) |
| v1.1.0 | 新增「在系统资源管理器中打开」工具栏按钮: Client 走 DSH 原生 `host.openPath`(Windows `Invoke-Item`) 打开当前浏览目录; 无新增 Host RPC/能力, 安全审查持平 WARN(33/300) |
| v1.0.0 | 最终形态: 顶部「文件浏览」+ 标题栏「打开目录」双入口; 内联样式深色适配; 启动竞态修复(订阅自愈 + 默认宽栏) |
| (pkg-1~pkg-7) | 演进过程: 侧栏底部按钮 → 顶部浮层 → 标签胶囊 → 内联样式可见性修复 → 移除底部按钮与诊断条 |
