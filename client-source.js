// ============================================================
// 左侧文件浏览器 (fexp) — v1.2.0 (DSH 动态 Cordis 插件)
// 本文件是 cordis_define 的 code.client 参数原文(函数体)。
//
// Client 半区职责:
//   - 侧栏顶部「文件浏览」胶囊按钮 (shell.overlay, 宽栏时显示, 定位在
//     「工作区」标题行右侧/搜索图标左侧附近)
//   - 会话标题栏「打开目录」按钮 (conversation.session.header.actions)
//   - 左侧 320px 浏览面板 (shell.overlay): 面包屑导航、目录列表、文件预览
//   - 深色主题适配: 按钮用内联样式(不受样式表影响), SVG 矢量图标
//
// v1.2.0 新增:
//   - 预览区「添加到聊天」按钮(位于「关闭预览」左侧): 通过会话作用域插槽
//     conversation.input.dock 的隐藏桥组件捕获标准包 inputActions/useInput,
//     点击后把文件引用 [文件名](绝对路径) 追加到聊天输入框草稿(不覆盖已有
//     内容), 由用户编辑后发送, 方便告诉 AI 具体文件信息; 纯 Client 能力
//
// v1.1.0 新增:
//   - 工具栏「在系统资源管理器中打开」按钮: 调用 Client workspaces.openPath
//     (DSH 原生 host.openPath, Windows 走 Invoke-Item), 在系统资源管理器中
//     打开当前浏览的目录; 不新增 Host RPC, 不引入 spawn/网络能力
//
// v1.0.0 要点:
//   - 修复启动时序竞态: useStore 订阅后立即自愈同步当前状态(避免探针写入
//     早于订阅导致更新丢失); sidebarWide 默认 true(探针异常时按钮仍可见)
//   - 侧栏宽窄探针 (sidebar.footer.action 内隐藏 null 单元格) 报告 wide 状态
// ============================================================
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const workspaces = ctx.get('workspaces')

    styles.insert(`
      .fexp-panel {
        position: fixed; left: 0; top: 0; bottom: 0; width: 320px; z-index: 1000;
        display: flex; flex-direction: column;
        background: var(--dsw-specific-sidebar-fill, #171a1f);
        border-right: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        box-shadow: 10px 0 28px rgba(0,0,0,.22);
        color: var(--dsw-alias-label-primary, #e8e8e8);
        font-size: 13px; line-height: 1.45; pointer-events: auto;
      }
      .fexp-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; }
      .fexp-head-icon { display: flex; color: var(--dsw-alias-brand-primary, #4c8dff); }
      .fexp-head-title { flex: 1; font-weight: 600; font-size: 13px; }

      .fexp-tbtn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; padding: 0;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent; color: var(--dsw-alias-label-secondary, #9aa4b2);
        cursor: pointer;
      }
      .fexp-tbtn:hover:not(:disabled) {
        background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06));
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .fexp-tbtn:disabled { opacity: .35; cursor: default; }

      .fexp-toolbar { display: flex; align-items: center; gap: 2px; padding: 2px 10px 6px; }

      .fexp-crumbs {
        display: flex; align-items: center; gap: 2px; padding: 2px 10px 8px;
        overflow-x: auto; white-space: nowrap; scrollbar-width: thin;
      }
      .fexp-crumb {
        display: inline-flex; align-items: center; max-width: 140px;
        overflow: hidden; text-overflow: ellipsis;
        background: transparent; border: none; padding: 2px 4px; border-radius: 4px;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px; cursor: pointer;
      }
      .fexp-crumb:hover {
        background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06));
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .fexp-crumb-sep { color: var(--dsw-alias-label-secondary, #9aa4b2); opacity: .55; font-size: 12px; }

      .fexp-error {
        margin: 0 10px 8px; padding: 6px 8px;
        border: 1px solid var(--dsw-alias-state-error-primary, rgba(255,92,92,.5));
        border-radius: 6px; background: rgba(255,92,92,.08);
        color: var(--dsw-alias-state-error-primary, #ff5c5c); font-size: 12px;
      }

      .fexp-body { flex: 1; overflow-y: auto; padding: 0 6px 8px; }
      .fexp-list { display: flex; flex-direction: column; gap: 1px; }
      .fexp-empty {
        padding: 18px 10px; text-align: center;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px;
      }
      .fexp-row {
        display: flex; align-items: center; gap: 6px;
        padding: 5px 6px; border-radius: 6px; cursor: pointer; user-select: none;
      }
      .fexp-row:hover { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06)); }
      .fexp-row-icon { display: flex; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #9aa4b2); }
      .fexp-row-dir .fexp-row-icon { color: var(--dsw-alias-brand-primary, #4c8dff); }
      .fexp-row-name {
        flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;
      }
      .fexp-row-size { flex-shrink: 0; color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 11px; }

      .fexp-preview {
        display: flex; flex-direction: column; height: 40%; min-height: 140px;
        border-top: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        background: var(--dsw-alias-bg-base, #101318);
      }
      .fexp-preview-head {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
      }
      .fexp-preview-name {
        flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 12px; font-weight: 600;
      }
      .fexp-preview-size { color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 11px; }
      .fexp-preview-body {
        flex: 1; overflow: auto; margin: 0; padding: 8px 10px;
        font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 11.5px; white-space: pre; tab-size: 4;
      }
      .fexp-preview-empty {
        align-items: center; justify-content: center;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px;
      }

      .fexp-chat-btn {
        display: inline-flex; align-items: center; gap: 4px;
        height: 22px; padding: 0 8px; margin-left: 2px;
        border: 1px solid rgba(124,176,255,.45); border-radius: 5px;
        background: rgba(124,176,255,.12);
        color: var(--dsw-alias-brand-primary, #7cb0ff);
        font-size: 11.5px; white-space: nowrap; cursor: pointer;
      }
      .fexp-chat-btn:hover:not(:disabled) { background: rgba(124,176,255,.24); }
      .fexp-chat-btn:disabled { opacity: .45; cursor: default; }
    `)

    const listeners = new Set()
    let state = {
      open: false,
      sidebarWide: true,
      root: null,
      path: null,
      entries: null,
      loading: false,
      error: null,
      preview: null,
      previewLoading: false,
      opening: false,
      inputActions: null,
      chatDraft: '',
      chatAddedPath: null,
    }

    function setState(patch) {
      state = Object.assign({}, state, patch)
      listeners.forEach((fn) => { try { fn() } catch (e) { /* noop */ } })
    }

    function useStore(selector) {
      const [value, setValue] = React.useState(() => selector(state))
      React.useEffect(() => {
        const fn = () => setValue(selector(state))
        listeners.add(fn)
        // Self-heal: re-read the current state after subscribing so an update
        // that landed before this subscription (mount-order race) is not lost.
        setValue(selector(state))
        return () => listeners.delete(fn)
      }, [])
      return value
    }

    async function safeCall(method, args) {
      try {
        return await host.call(method, args)
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) }
      }
    }

    let dirSeq = 0

    async function loadDir(p) {
      const seq = ++dirSeq
      setState({ loading: true, error: null, preview: null })
      const res = await safeCall('list-dir', { path: p })
      if (seq !== dirSeq) return
      if (!res || !res.ok) {
        setState({ loading: false, error: (res && res.error) || '无法读取目录' })
        return
      }
      setState({ loading: false, path: res.path, entries: res.entries })
    }

    async function openRoot() {
      const seq = ++dirSeq
      setState({ loading: true, error: null })
      const res = await safeCall('default-root', {})
      if (seq !== dirSeq) return
      if (!res || !res.ok) {
        setState({ loading: false, error: (res && res.error) || '无法获取根目录' })
        return
      }
      setState({ root: res.path })
      await loadDir(res.path)
    }

    async function openFile(entry, dirPath) {
      const full = joinPath(dirPath, entry.name)
      setState({ previewLoading: true, preview: null, error: null })
      const res = await safeCall('read-file', { path: full })
      setState({ previewLoading: false })
      if (!res || !res.ok) {
        setState({ error: (res && res.error) || '无法打开文件' })
        return
      }
      setState({ preview: { path: (res.path || full), name: entry.name, content: res.content, bytes: res.bytes } })
    }

    function joinPath(dir, name) {
      return String(dir).replace(/[\\/]+$/, '') + '/' + name
    }

    function addToChat(fileInfo) {
      const actions = state.inputActions
      if (!actions || !fileInfo || !fileInfo.path) return
      const ref = '[' + fileInfo.name + '](' + fileInfo.path + ')'
      const base = (state.chatDraft || '').trim()
      const next = base ? base + '\n' + ref : ref
      actions.setDraft(next)
      setState({ chatAddedPath: fileInfo.path })
    }

    function InputBridge(props) {
      // 会话作用域隐藏桥: 捕获标准包 inputActions / useInput, 供面板使用。
      const useInput = props.useInput
      const actions = props.inputActions
      const draft = useInput ? useInput((s) => s.draft) : undefined
      React.useEffect(() => {
        setState({ inputActions: actions || null })
        return () => {
          if (actions && state.inputActions === actions) setState({ inputActions: null })
        }
      }, [actions])
      React.useEffect(() => {
        setState({ chatDraft: draft || '' })
      }, [draft])
      return null
    }

    async function openInExplorer(p) {
      if (!workspaces || !p || state.opening) return
      setState({ opening: true, error: null })
      try {
        await workspaces.openPath(p)
      } catch (err) {
        setState({ error: String((err && err.message) || err) })
      } finally {
        setState({ opening: false })
      }
    }

    function parentOf(p) {
      const str = String(p).replace(/[\\/]+$/, '')
      const idx = Math.max(str.lastIndexOf('/'), str.lastIndexOf('\\'))
      if (idx < 0) return null
      if (idx === 1 && str.charAt(1) === ':') return str.slice(0, 2) + '/'
      const par = str.slice(0, idx)
      return par === '' ? '/' : par
    }

    function crumbsOf(p) {
      const str = String(p)
      const isPosix = str.indexOf('/') === 0
      const parts = str.split(/[\\/]+/).filter(Boolean)
      const crumbs = []
      if (isPosix) crumbs.push({ name: '/', path: '/' })
      let acc = ''
      parts.forEach((part) => {
        acc = acc ? acc + '/' + part : (isPosix ? '/' + part : part)
        crumbs.push({ name: part, path: acc })
      })
      return crumbs
    }

    function fmtSize(n) {
      if (n == null) return ''
      if (n < 1024) return n + ' B'
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1048576).toFixed(1) + ' MB'
    }

    function svgIcon(size, children) {
      return React.createElement('svg', {
        width: size || 14, height: size || 14, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { flexShrink: 0 },
      }, children)
    }
    function IconFolder(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }))
    }
    function IconFile(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        React.createElement('polyline', { points: '14 2 14 8 20 8' }))
    }
    function IconHome(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M3 10.5 12 3l9 7.5' }),
        React.createElement('path', { d: 'M5 9.5V21h14V9.5' }))
    }
    function IconWorkspace(props) {
      return svgIcon(props && props.size,
        React.createElement('circle', { cx: '12', cy: '12', r: '7' }),
        React.createElement('circle', { cx: '12', cy: '12', r: '2' }))
    }
    function IconUp(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M12 19V5' }),
        React.createElement('path', { d: 'm5 12 7-7 7 7' }))
    }
    function IconRefresh(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        React.createElement('polyline', { points: '21 3 21 9 15 9' }))
    }
    function IconClose(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M18 6 6 18' }),
        React.createElement('path', { d: 'm6 6 12 12' }))
    }
    function IconExternal(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
        React.createElement('polyline', { points: '15 3 21 3 21 9' }),
        React.createElement('line', { x1: '10', y1: '14', x2: '21', y2: '3' }))
    }
    function IconChat(props) {
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }))
    }

    const btnBase = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      height: '28px',
      padding: '0 10px',
      border: '1px solid rgba(148,163,184,.5)',
      borderRadius: '7px',
      background: 'rgba(148,163,184,.14)',
      color: '#e8edf3',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      boxSizing: 'border-box',
      margin: '2px',
    }
    const btnActive = Object.assign({}, btnBase, {
      color: '#7cb0ff',
      borderColor: 'rgba(124,176,255,.8)',
    })

    function HeaderToggle(props) {
      const open = useStore((s) => s.open)
      const wsPath = props.useSessions
        ? props.useSessions((s) => (s.byId[s.current] ? s.byId[s.current].cwd : undefined))
        : undefined
      const onClick = () => {
        if (open) {
          setState({ open: false })
          return
        }
        setState({ open: true, root: wsPath || null })
        if (wsPath) loadDir(wsPath)
        else openRoot()
      }
      return React.createElement('button', {
        type: 'button',
        style: open ? btnActive : btnBase,
        title: '打开当前工作区目录',
        onClick: onClick,
      }, React.createElement(IconFolder, { size: 14 }),
        React.createElement('span', null, '打开目录'))
    }

    function SidebarWideProbe(props) {
      const wide = Boolean(props.wide)
      React.useEffect(() => { setState({ sidebarWide: wide }) }, [wide])
      return null
    }

    function TopToggle() {
      const open = useStore((s) => s.open)
      const wide = useStore((s) => s.sidebarWide)
      if (!wide) return null
      const style = Object.assign({}, open ? btnActive : btnBase, {
        position: 'fixed',
        top: '126px',
        left: '70px',
        zIndex: 10,
        pointerEvents: 'auto',
        padding: '0 9px',
      })
      return React.createElement('button', {
        type: 'button',
        style: style,
        title: '文件浏览',
        'aria-label': '文件浏览',
        onClick: () => setState({ open: !open }),
      }, React.createElement(IconFolder, { size: 14 }),
        React.createElement('span', null, '文件浏览'))
    }

    function ExplorerPanel(props) {
      const open = useStore((s) => s.open)
      const root = useStore((s) => s.root)
      const path = useStore((s) => s.path)
      const entries = useStore((s) => s.entries)
      const loading = useStore((s) => s.loading)
      const error = useStore((s) => s.error)
      const preview = useStore((s) => s.preview)
      const previewLoading = useStore((s) => s.previewLoading)
      const opening = useStore((s) => s.opening)
      const inputActions = useStore((s) => s.inputActions)
      const chatAddedPath = useStore((s) => s.chatAddedPath)

      const wsPath = props.useSessions
        ? props.useSessions((s) => (s.byId[s.current] ? s.byId[s.current].cwd : undefined))
        : undefined

      React.useEffect(() => {
        if (!open) return
        if (path === null && !loading) {
          if (wsPath) {
            setState({ root: wsPath })
            loadDir(wsPath)
          } else {
            openRoot()
          }
        }
      }, [open, wsPath])

      if (!open) return null

      const crumbs = path ? crumbsOf(path) : []
      const parent = path ? parentOf(path) : null
      const dirs = entries ? entries.filter((e) => e.type === 'directory') : []
      const files = entries ? entries.filter((e) => e.type !== 'directory') : []

      const rows = []
      dirs.forEach((entry) => {
        const full = joinPath(path, entry.name)
        rows.push(React.createElement('div', {
          key: 'd' + entry.name,
          className: 'fexp-row fexp-row-dir',
          title: full,
          onClick: () => loadDir(full),
        },
          React.createElement('span', { className: 'fexp-row-icon' }, React.createElement(IconFolder, null)),
          React.createElement('span', { className: 'fexp-row-name' }, entry.name)))
      })
      files.forEach((entry) => {
        const full = joinPath(path, entry.name)
        rows.push(React.createElement('div', {
          key: 'f' + entry.name,
          className: 'fexp-row fexp-row-file',
          title: full,
          onClick: () => openFile(entry, path),
        },
          React.createElement('span', { className: 'fexp-row-icon' }, React.createElement(IconFile, null)),
          React.createElement('span', { className: 'fexp-row-name' }, entry.name),
          entry.size != null ? React.createElement('span', { className: 'fexp-row-size' }, fmtSize(entry.size)) : null))
      })

      const crumbEls = []
      crumbs.forEach((c, i) => {
        if (i > 0) crumbEls.push(React.createElement('span', { key: 'sep' + i, className: 'fexp-crumb-sep' }, '/'))
        crumbEls.push(React.createElement('button', {
          key: c.path,
          type: 'button',
          className: 'fexp-crumb',
          title: c.path,
          onClick: () => loadDir(c.path),
        }, c.name))
      })

      let bodyEl
      if (entries === null) {
        bodyEl = React.createElement('div', { className: 'fexp-empty' }, loading ? '加载中…' : '正在准备…')
      } else if (rows.length) {
        bodyEl = React.createElement('div', { className: 'fexp-list' }, rows)
      } else {
        bodyEl = React.createElement('div', { className: 'fexp-empty' }, '（空目录）')
      }

      let previewEl = null
      if (previewLoading) {
        previewEl = React.createElement('div', { className: 'fexp-preview fexp-preview-empty' }, '正在读取文件…')
      } else if (preview) {
        const added = chatAddedPath === preview.path
        previewEl = React.createElement('div', { className: 'fexp-preview' },
          React.createElement('div', { className: 'fexp-preview-head' },
            React.createElement('span', { className: 'fexp-preview-name', title: preview.path }, preview.name),
            React.createElement('span', { className: 'fexp-preview-size' }, fmtSize(preview.bytes)),
            React.createElement('button', {
              type: 'button', className: 'fexp-chat-btn',
              title: inputActions ? '将文件信息添加到聊天输入框' : '当前没有可用的会话输入框',
              disabled: !inputActions || added,
              onClick: () => addToChat(preview),
            }, React.createElement(IconChat, { size: 12 }),
              React.createElement('span', null, added ? '已添加' : '添加到聊天')),
            React.createElement('button', {
              type: 'button', className: 'fexp-tbtn', title: '关闭预览',
              onClick: () => setState({ preview: null }),
            }, React.createElement(IconClose, null))),
          React.createElement('pre', { className: 'fexp-preview-body' }, preview.content))
      }

      const errorEl = error ? React.createElement('div', { className: 'fexp-error' }, error) : null

      return React.createElement('div', { className: 'fexp-panel' },
        React.createElement('div', { className: 'fexp-head' },
          React.createElement('span', { className: 'fexp-head-icon' }, React.createElement(IconFolder, { size: 15 })),
          React.createElement('span', { className: 'fexp-head-title' }, '文件浏览'),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '关闭面板',
            onClick: () => setState({ open: false }),
          }, React.createElement(IconClose, null))),
        React.createElement('div', { className: 'fexp-toolbar' },
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '当前工作区目录', disabled: !wsPath,
            onClick: () => { if (wsPath) { setState({ root: wsPath }); loadDir(wsPath) } },
          }, React.createElement(IconWorkspace, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '回到根目录', disabled: !root,
            onClick: () => { if (root) loadDir(root) },
          }, React.createElement(IconHome, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '上一级', disabled: !parent,
            onClick: () => { if (parent) loadDir(parent) },
          }, React.createElement(IconUp, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn', title: '刷新', disabled: !path,
            onClick: () => { if (path) loadDir(path) },
          }, React.createElement(IconRefresh, null)),
          React.createElement('button', {
            type: 'button', className: 'fexp-tbtn',
            title: workspaces ? '在系统资源管理器中打开当前目录' : '当前环境不支持在系统资源管理器中打开',
            disabled: !path || !workspaces || opening,
            onClick: () => openInExplorer(path),
          }, React.createElement(IconExternal, null))),
        React.createElement('div', { className: 'fexp-crumbs' },
          crumbEls.length ? crumbEls : React.createElement('span', { className: 'fexp-crumb' }, '…')),
        errorEl,
        React.createElement('div', { className: 'fexp-body' }, bodyEl),
        previewEl)
    }

    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'fexp-wide-probe', order: 6, label: '文件浏览' },
      (props) => React.createElement(SidebarWideProbe, { wide: Boolean(props && props.wide) }),
    ))

    slots.inject('conversation.session.header.actions', () => slots.register(
      { name: 'conversation.session.header.actions', id: 'fexp-header-toggle', order: 30, label: '打开目录' },
      (props) => React.createElement(HeaderToggle, { useSessions: props && props.useSessions }),
    ))

    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'fexp-input-bridge', order: 0, label: '文件浏览器输入桥' },
      (props) => React.createElement(InputBridge, {
        useInput: props && props.useInput,
        inputActions: props && props.inputActions,
      }),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fexp-top-toggle', order: 5 },
      () => React.createElement(TopToggle, null),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fexp-panel', order: 10 },
      (props) => React.createElement(ExplorerPanel, { useSessions: props && props.useSessions }),
    ))
  },
}
