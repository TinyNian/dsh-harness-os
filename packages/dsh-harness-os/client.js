/**
 * dsh-harness-os — 浏览器半边（手写 ModuleLoader bundle，无需构建）
 * ----------------------------------------------------------------------------
 * 把 DeepSeek Harness 的 Web GUI 换成「Harness OS」：沿用 dsh-startup-screen
 * 开机动画的技术档案版式——暖白 / 暗色底板、发丝机框、等宽读数、准星罗盘。
 *
 * 四层：
 *   1) 主题变量：在 body[data-hos] 上整体覆盖 DSH 的 --dsw-alias-* 别名 token，
 *      暗色走 body[data-hos][data-ds-dark-theme]。大部分组件只靠这一层就换色。
 *   2) 组件样式：DSH 的 class 是 CSS Modules 哈希（`AbC12x_newSession` 或
 *      `_newSession_38b9q_1`），语义名跨构建稳定。C('newSession') 生成同时
 *      兼容两种格式的属性选择器，并一律限定在 data-slot 区域里。
 *   3) 机框覆盖层 #hos-chrome：不接收点击的 fixed 层，放机框、品牌块、开机读数、
 *      页脚。坐标与启动动画终幕一致，揭幕时原地不动。
 *   4) 注入件：侧栏底部状态、hero 英文副标与准星、信号轨迹、右栏引导页罗盘。
 *      只往 React 管辖之外追加节点，由节流的 MutationObserver「缺了就补」，
 *      不改任何 React 文本节点。
 *
 * 与开机动画的衔接（dsh-startup-screen，含本仓库的 fork）：
 *   boot      #dsh-startup-root 在场：只露常驻件，其余部件透明；
 *   assemble  揭幕那一刻（fork 派发 dsh-startup:handoff；上游版本退回观察
 *             dsu-handoff class）：部件按启动页的节奏装配，准星从启动页尺寸收进 hero；
 *   docked    约 1.5 秒后：开机读数退场，品牌块缩成 logo。没有开机动画时直接 docked。
 *
 * 设置：设置页「Harness OS」一节；数据在 localStorage `dsh-harness-os:settings`。
 */
window.__ModuleLoader__.load({
  id: 'dsh-harness-os',
  factory: function (require) {
    'use strict'
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = null
    try { react = require('react') } catch (e) { /* 设置分节可选 */ }

    var NS = 'dsh-harness-os'
    var KEY = NS + ':settings'
    var DEFAULTS = { enabled: true, accent: 'orange', chassis: true, reduceMotion: false }
    /* [强调色, 浅色下的深一档, 暗色下的亮一档] */
    var ACCENTS = {
      orange: ['#ff7500', '#b84f00', '#ff9a45', '橙'],
      red: ['#ff3b30', '#c2271d', '#ff6b61', '信号红'],
      blue: ['#2971b8', '#1f5a94', '#6aa8e8', '冰蓝']
    }

    function readSettings() {
      var out = {}
      for (var k in DEFAULTS) out[k] = DEFAULTS[k]
      try {
        var raw = JSON.parse(window.localStorage.getItem(KEY) || '{}')
        for (var k2 in DEFAULTS) if (raw && raw[k2] !== undefined) out[k2] = raw[k2]
      } catch (e) { /* 隐私模式或坏 JSON：走默认 */ }
      if (!ACCENTS[out.accent]) out.accent = DEFAULTS.accent
      return out
    }
    function writeSettings(next) {
      try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch (e) { /* noop */ }
    }
    var S = readSettings()

    /* ── 选择器工具 ─────────────────────────────────────────────────────── */
    /** CSS Modules 语义名 → 兼容两种哈希格式的选择器 */
    function C(name) {
      return ':is([class$="_' + name + '"],[class*="_' + name + ' "],[class^="_' + name + '_"],[class*=" _' + name + '_"])'
    }
    function q(sel, root) { return (root || document).querySelector(sel) }

    var B = 'body[data-hos]'
    var D = 'body[data-hos][data-ds-dark-theme]'
    var EASE = 'cubic-bezier(0.16, 0.84, 0.24, 1)'
    var FOLD_MS = 400, FOLD_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
    var BRUSH = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.82 0.014' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='0.10' intercept='0.45'/><feFuncG type='linear' slope='0.10' intercept='0.45'/><feFuncB type='linear' slope='0.10' intercept='0.45'/><feFuncA type='linear' slope='0' intercept='1'/></feComponentTransfer></filter><rect width='420' height='420' filter='url(%23b)'/></svg>\")"

    /* ── 1. 主题变量 ───────────────────────────────────────────────────── */
    var TOKENS = [
      /* 同时挂在暗色选择器上：DSH 暗色主题在 body[data-ds-dark-theme] 上重设了同一批 --dsw-alias-*，
         和 body[data-hos] 同优先级、又排在后面，只挂 B 时暗色下全被原生色盖掉（提示框灰、徽标蓝、状态绿、实色底）。
         挂上 D 后优先级更高；明暗不同的值由紧随其后的 D 块再覆盖 */
      B + ',' + D + '{',
      '--hos-bg:#dedbd4;--hos-bg-2:#f2efe8;--hos-bg-3:#f8f6f1;--hos-ink:#0b0c0d;--hos-ink-soft:#34383a;--hos-muted:#6c6f6c;',
      '--hos-hair:rgba(20,25,28,.18);--hos-hair-soft:rgba(20,25,28,.07);--hos-hair-strong:rgba(20,25,28,.3);',
      '--hos-accent-2:#2c7a8a;--hos-red:#ff3b30;--hos-glass:rgba(255,252,246,.58);--hos-glass-hi:rgba(255,255,255,.72);',
      '--hos-box-bg:var(--hos-ink);--hos-box-ink:#f6f4ef;--hos-shadow:0 24px 60px rgba(56,46,34,.14);--hos-halo:var(--hos-bg-2);',
      '--hos-din:"Bahnschrift","DIN Alternate","DIN Condensed","Archivo","Oswald","Arial Narrow","Roboto Condensed","HarmonyOS Sans SC","Microsoft YaHei","PingFang SC",sans-serif;',
      '--hos-mono:"Cascadia Mono","SFMono-Regular","Consolas","Menlo","DejaVu Sans Mono",ui-monospace,monospace;',
      '--hos-inset:26px;',
      '--dsw-alias-bg-base:var(--hos-bg);--dsw-alias-bg-layer-1:var(--hos-bg-2);--dsw-alias-bg-layer-2:var(--hos-bg-3);--dsw-alias-bg-layer-3:#fcfbf8;',
      '--dsw-alias-bg-module-platform:transparent;--dsw-alias-bg-overlay:color-mix(in srgb,var(--hos-ink) 6%,var(--hos-bg-2));',
      '--dsw-alias-bg-multi-select:var(--hos-hair-soft);--dsw-alias-bg-skeleton:var(--hos-hair-soft);--dsw-alias-bg-document-preview:var(--hos-bg-2);',
      '--dsw-alias-bg-mask-1:rgba(222,219,212,.55);--dsw-alias-bg-mask-2:rgba(222,219,212,.32);--dsw-alias-bg-mask-3:rgba(11,12,13,.5);--dsw-alias-bg-mask-drop:rgba(242,239,232,.72);',
      '--dsw-alias-border-l1:var(--hos-hair-soft);--dsw-alias-border-l2:var(--hos-hair);--dsw-alias-border-l2-darkmode-thin:var(--hos-hair);--dsw-alias-border-l3:var(--hos-hair);--dsw-alias-border-l4:var(--hos-hair-strong);',
      '--dsw-alias-brand-primary:var(--hos-ink);--dsw-alias-brand-text:var(--hos-ink);--dsw-alias-brand-primary-invert:var(--hos-ink);',
      '--dsw-alias-button-primary-fill:var(--hos-ink);--dsw-alias-button-primary-hover:#2a2d2f;--dsw-alias-button-primary-dimmed:var(--hos-hair-soft);',
      '--dsw-alias-button-elevated-fill:var(--hos-bg-2);--dsw-alias-button-floating-fill:var(--hos-bg-2);--dsw-alias-button-floating-hover:color-mix(in srgb,var(--hos-ink) 6%,var(--hos-bg-2));',
      '--dsw-alias-button-ghost-active-fill:var(--hos-hair-soft);--dsw-alias-button-ghost-active-hover:rgba(20,25,28,.1);--dsw-alias-button-ghost-active-border:var(--hos-hair);',
      '--dsw-alias-button-contrast-fill:var(--hos-ink-soft);--dsw-alias-button-info-fill:var(--hos-accent-2);--dsw-alias-button-info-hover:color-mix(in srgb,var(--hos-accent-2) 80%,white);',
      '--dsw-alias-interactive-bg-hover:var(--hos-hair-soft);--dsw-alias-interactive-bg-active:rgba(20,25,28,.1);--dsw-alias-interactive-bg-hover-solid:color-mix(in srgb,var(--hos-ink) 6%,var(--hos-bg-2));--dsw-alias-interactive-bg-hover-accent:rgba(20,25,28,.12);',
      '--dsw-alias-label-primary:var(--hos-ink);--dsw-alias-label-primary-dimmed:var(--hos-ink);--dsw-alias-label-secondary:var(--hos-ink-soft);--dsw-alias-label-tertiary:var(--hos-muted);--dsw-alias-label-caption:#9b9a95;',
      '--dsw-alias-label-primary-inverted:var(--hos-box-ink);--dsw-alias-label-primary-foreground:var(--hos-box-ink);--dsw-alias-label-dimmed:var(--hos-hair);--dsw-alias-label-primary-bluish:var(--hos-ink);',
      '--dsw-alias-label-deep-diving:var(--hos-accent-2);--dsw-alias-label-deep-diving-shimmer:color-mix(in srgb,var(--hos-accent-2) 35%,var(--hos-ink));',
      '--dsw-alias-link:var(--hos-accent-2);--dsw-alias-state-business-primary:var(--hos-ink);--dsw-alias-state-business-tertiary:var(--hos-hair-soft);',
      '--dsw-alias-state-success-primary:var(--hos-accent-2);--dsw-alias-state-success-secondary:var(--hos-accent-2);--dsw-alias-state-success-tertiary:color-mix(in srgb,var(--hos-accent-2) 12%,transparent);',
      '--dsw-alias-state-error-primary:var(--hos-red);--dsw-alias-state-error-secondary:var(--hos-red);',
      '--dsw-alias-markdown-code-block:color-mix(in srgb,var(--hos-ink) 4%,var(--hos-bg-2));--dsw-alias-markdown-code-block-banner:color-mix(in srgb,var(--hos-ink) 4%,var(--hos-bg-2));',
      '--dsw-alias-markdown-inline-code:var(--hos-hair-soft);--dsw-alias-markdown-tag:var(--hos-hair-soft);--dsw-alias-markdown-citation:var(--hos-hair-soft);--dsw-alias-markdown-placeholder:var(--hos-hair-soft);',
      '--dsw-alias-markdown-code-segment-selected:var(--hos-bg-3);--dsw-alias-markdown-code-segment-unselected:var(--hos-hair-soft);',
      '--dsw-alias-menu-group-header-fill:var(--hos-bg-2);--dsw-alias-menu-icon:var(--hos-ink-soft);',
      '--dsw-alias-scrollbar-bg-l1:var(--hos-hair);--dsw-alias-scrollbar-bg-l2:var(--hos-hair);--dsw-alias-scrollbar-hover-l1:var(--hos-hair-strong);--dsw-alias-scrollbar-hover-l2:var(--hos-hair-strong);',
      '--dsw-alias-settings-card-fill:var(--hos-glass);--dsw-alias-settings-card-stroke:var(--hos-hair);--dsw-alias-switch-thumb:var(--hos-bg-2);',
      '--dsw-alias-toast-bg:var(--hos-box-bg);--dsw-alias-toast-label:var(--hos-box-ink);',
      /* 提示框和悬停卡的字是原生写死的白色，底色两套主题都得是深色：浅色用墨色，暗色用比底板亮一级的深青灰 */
      '--hos-tip:var(--hos-ink);--dsw-alias-tooltip-bg:var(--hos-tip);--dsw-alias-tooltip-key-bg:color-mix(in srgb,var(--hos-tip),white 16%);',
      /* 原生蓝强调色换成皮肤的青色；其余漏网的原生色一并接管 */
      '--dsw-alias-brand-primary-new-colorprimary-new-color:var(--hos-accent-2);--dsw-alias-bg-document-selection:color-mix(in srgb,var(--hos-accent-2) 22%,transparent);',
      '--dsw-alias-label-shimmer:var(--hos-muted);--dsw-alias-label-document-preview:var(--hos-ink-soft);--dsw-alias-state-idle-primary:var(--hos-muted);',
      '--dsw-alias-button-tool-bar-fill:var(--hos-hair-soft);--dsw-alias-button-tool-bar-fill-invisible:transparent;--dsw-alias-button-tool-bar-hover:var(--hos-hair);',
      '--dsw-alias-turn-trigger-bg:transparent;--dsw-alias-turn-trigger-bg-hover:var(--hos-hair-soft);',
      '--dsw-alias-file-diff-added-bg:color-mix(in srgb,var(--hos-accent-2) 12%,transparent);--dsw-alias-file-diff-added-gutter:color-mix(in srgb,var(--hos-accent-2) 8%,transparent);--dsw-alias-file-diff-added-marker:var(--hos-accent-2);',
      '--dsw-alias-file-diff-deleted-bg:color-mix(in srgb,var(--hos-red) 11%,transparent);--dsw-alias-file-diff-deleted-gutter:color-mix(in srgb,var(--hos-red) 7%,transparent);--dsw-alias-file-diff-deleted-marker:var(--hos-red);',
      '--dsw-alias-code-diff-added:color-mix(in srgb,var(--hos-accent-2) 10%,transparent);--dsw-alias-code-diff-deleted:color-mix(in srgb,var(--hos-red) 9%,transparent);',
      '--dsw-alias-onboarding-accent:var(--hos-accent);',
      '}',
      D + '{',
      '--hos-bg:#070a0e;--hos-bg-2:#0d131a;--hos-bg-3:#121a22;--hos-ink:#eef2f4;--hos-ink-soft:#b8c3ca;--hos-muted:#7d8c96;',
      '--hos-hair:rgba(180,210,225,.16);--hos-hair-soft:rgba(180,210,225,.055);--hos-hair-strong:rgba(180,210,225,.3);',
      '--hos-accent-2:#6fd3e8;--hos-glass:rgba(8,15,20,.56);--hos-glass-hi:rgba(255,255,255,.055);',
      '--hos-box-ink:#070a0e;--hos-shadow:0 30px 80px rgba(0,0,0,.34);',
      '--dsw-alias-bg-layer-3:#16202a;--dsw-alias-button-primary-hover:#cfd6da;',
      '--dsw-alias-bg-mask-1:rgba(7,10,14,.6);--dsw-alias-bg-mask-2:rgba(7,10,14,.35);--dsw-alias-bg-mask-3:rgba(0,0,0,.6);--dsw-alias-bg-mask-drop:rgba(13,19,26,.72);',
      '--dsw-alias-interactive-bg-active:rgba(180,210,225,.12);--dsw-alias-interactive-bg-hover-accent:rgba(180,210,225,.14);--dsw-alias-button-ghost-active-hover:rgba(180,210,225,.12);',
      '--dsw-alias-label-caption:#5f6d77;',
      '--hos-tip:#17222b;',
      '}'
    ]

    /* ── 2. 底板、机框、全局形状 ─────────────────────────────────────────── */
    /* 切角发丝斜线：clip-path 切掉的角不会自己画边。用原点在 border-box 的渐变补一道 1px 斜线，
       整条落在保留一侧（压在裁切线上会被切掉一半），颜色跟边框共用 --hos-cl，两端才和直边接得上；
       斜线抗锯齿后看着比直边淡，宽度给 1.2px 补回来 */
    function cutTR(px) { return 'linear-gradient(to top right,transparent calc(50% - 1.2px),var(--hos-cl) calc(50% - 1.2px),var(--hos-cl) 50%,transparent 50%) top right/' + px + 'px ' + px + 'px no-repeat border-box' }
    function cutBL(px) { return 'linear-gradient(to top right,transparent 50%,var(--hos-cl) 50%,var(--hos-cl) calc(50% + 1.2px),transparent calc(50% + 1.2px)) bottom left/' + px + 'px ' + px + 'px no-repeat border-box' }
    var NOT_ROUND = ':not(#dsh-startup-root,#dsh-startup-root *,svg *,[role=progressbar],[class*="pinner"],[class*="avatar"],[class*="Avatar"])'
    var BASE = [
      'html:has(body[data-hos]){background:var(--hos-bg,#dedbd4)}',
      /* macOS 桌面端 DSH 用 html[data-platform=darwin] body{background:transparent} 透出原生毛玻璃，
         优先级比 body[data-hos] 高；底板要压过它，否则整页只剩 html 的纯色，和输入框座位的底板对不上 */
      B + ',html[data-platform] ' + B + '{background:' + BRUSH + ',radial-gradient(120% 90% at 78% 12%,rgba(255,255,255,.85) 0%,rgba(255,255,255,0) 55%),linear-gradient(168deg,var(--hos-bg-2) 0%,var(--hos-bg) 42%,var(--hos-bg) 100%);background-size:420px 420px,100vw 100vh,100vw 100vh;background-repeat:repeat,no-repeat,no-repeat;background-attachment:fixed;background-blend-mode:overlay,normal,normal;color:var(--hos-ink)}',
      D + ',html[data-platform] ' + D + '{background:' + BRUSH + ',radial-gradient(90% 70% at 50% 46%,rgba(40,70,86,.32) 0%,rgba(0,0,0,0) 62%),linear-gradient(168deg,var(--hos-bg-2) 0%,var(--hos-bg) 46%,#05070a 100%);background-size:420px 420px,100vw 100vh,100vw 100vh;background-repeat:repeat,no-repeat,no-repeat;background-attachment:fixed}',
      /* 档案风格只有直角：全局去掉圆角（启动动画、svg 内部、进度与头像除外） */
      B + ' *' + NOT_ROUND + '{border-radius:0!important}',
      B + ' ::selection{background:color-mix(in srgb,var(--hos-accent) 28%,transparent)}',
      /* 机框：外框内缩 26px，与启动动画终幕的 .dsu-frame 同坐标 */
      B + '[data-hos-chassis] [data-slot=root]>' + C('frame') + '{box-sizing:border-box;padding:var(--hos-inset);background:transparent}',
      B + ' [data-slot=root]>' + C('frame') + '{background:transparent}',
      /* 右侧栏拖动柄：DSH 按「整框宽 − 右栏宽」定位，没算机框左右两侧的内边距，柄比分界线偏右 2 × inset */
      B + '[data-hos-chassis] [data-slot=root]>' + C('frame') + '>' + C('handle') + '[data-side=rightbar]{translate:calc(-2 * var(--hos-inset)) 0}',
      B + ' ' + C('sidebarCol') + ',' + B + ' ' + C('centerCol') + ',' + B + ' ' + C('rightbarCol') + '{background:transparent}',
      /* mac 桌面端 DSH 还给主区画了一道 .5px 左边线，和侧栏右边线贴在一起显粗，只留侧栏这一条 */
      B + ' ' + C('centerCol') + '{border-left:0}',
      B + ' ' + C('sidebarCol') + '{border-right:1px solid var(--hos-hair);background:linear-gradient(180deg,color-mix(in srgb,var(--hos-glass) 70%,transparent),color-mix(in srgb,var(--hos-glass) 30%,transparent))}',
      B + ' [data-slot=sidebar],' + B + ' [data-slot=sidebar] ' + C('root') + '{background:transparent}',
      /* 覆盖层：要压过输入框座位（sticky, z-index 7）的底板，否则机框底线被盖住；低于拖动柄（11）与浮层 */
      '#hos-chrome{position:fixed;inset:0;z-index:8;pointer-events:none;color:var(--hos-ink);font-family:var(--hos-din)}',
      '#hos-chrome[hidden]{display:none}',
      '#hos-chrome .hos-line{position:absolute;inset:var(--hos-inset);border:1px solid var(--hos-hair);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 1px 0 rgba(0,0,0,.3)}',
      'body:not([data-hos-chassis]) #hos-chrome .hos-line,body:not([data-hos-chassis]) #hos-chrome .hos-c{display:none}',
      /* macOS 桌面端：红绿灯压在机框左上角，顶线和左线在那一段留缺口，左上定位角隐藏 */
      'html[data-platform=darwin] #hos-chrome .hos-line{clip-path:polygon(64px 0,100% 0,100% 100%,0 100%,0 20px,64px 20px)}',
      'html[data-platform=darwin] #hos-chrome .hos-c.tl{visibility:hidden}',
      /* 侧栏收起时 DSH 把「展开侧栏 / 新会话」放到红绿灯旁边：顶线缺口加长到它们之后 */
      'html[data-platform=darwin] body:has([data-slot=root] > [data-sidebar-collapsed=true]) #hos-chrome .hos-line{clip-path:polygon(var(--hos-cut,130px) 0,100% 0,100% 100%,0 100%,0 20px,var(--hos-cut,130px) 20px)}',
      /* 有机框时顶栏已经在左上角控件下方，DSH 给顶栏加的让位缩进不需要 */
      B + '[data-hos-chassis] [data-slot="main.conversation"]{--dsh-frame-leading-clearance:0px}',
      /* 顶部拖动带：机框内缩出来的 26px 原本不是拖动区，把它补成窗口拖动区 */
      '#hos-chrome .hos-drag{position:absolute;left:0;right:0;top:0;height:var(--hos-inset);pointer-events:auto;-webkit-app-region:drag;app-region:drag}',
      /* macOS：左上角是红绿灯和收起侧栏后的两个按钮，拖动区从它们右侧开始，否则按钮点不动 */
      'html[data-platform=darwin] #hos-chrome .hos-drag{left:240px}',
      'body:not([data-hos-chassis]) #hos-chrome .hos-drag{display:none}',
      '#hos-chrome .hos-c{position:absolute;width:26px;height:26px}',
      '#hos-chrome .hos-c::before,#hos-chrome .hos-c::after{content:"";position:absolute;background:var(--hos-ink);opacity:.62}',
      '#hos-chrome .hos-c::before{width:100%;height:1px}#hos-chrome .hos-c::after{width:1px;height:100%}',
      '#hos-chrome .tl{left:var(--hos-inset);top:var(--hos-inset)}#hos-chrome .tl::before,#hos-chrome .tl::after{left:0;top:0}',
      '#hos-chrome .tr{right:var(--hos-inset);top:var(--hos-inset)}#hos-chrome .tr::before,#hos-chrome .tr::after{right:0;top:0}',
      '#hos-chrome .bl{left:var(--hos-inset);bottom:var(--hos-inset)}#hos-chrome .bl::before,#hos-chrome .bl::after{left:0;bottom:0}',
      '#hos-chrome .br{right:var(--hos-inset);bottom:var(--hos-inset)}#hos-chrome .br::before,#hos-chrome .br::after{right:0;bottom:0}',
      /* 品牌块：与启动动画 .dsu-brand 同位（视口 46/44），收起后缩成 logo */
      '#hos-chrome .hos-brand{position:absolute;left:46px;top:44px;line-height:1;transform-origin:0 0;transition:transform 720ms ' + EASE + ',opacity 300ms ease}',
      '#hos-chrome .hos-brand .b1{font-size:33px;font-weight:700;letter-spacing:.012em;line-height:.98}',
      '#hos-chrome .hos-brand .b2{font-size:15px;font-weight:700;letter-spacing:.012em;margin-top:3px}',
      '#hos-chrome .hos-brand .b3{font-size:30px;font-weight:400;line-height:1.06;letter-spacing:.012em;display:flex;gap:9px;align-items:baseline}',
      '#hos-chrome .hos-brand .b3 b{font-weight:700}',
      'body[data-hos-phase=docked] #hos-chrome .hos-brand{transform:scale(.56)}',
      /* 侧栏收起 / 展开：logo 算侧栏的一部分，随折叠动画被侧栏右边缘裁掉或露出（--hos-brand-clip 由脚本逐帧算）；
         收起后的稳态靠 opacity 藏住，等折叠播完再切，避免最后一帧闪一下 */
      '#hos-chrome .hos-brand{clip-path:inset(0 var(--hos-brand-clip,0px) 0 0)}',
      /* macOS 桌面端收起后侧栏列宽为 0，DSH 的窄栏（rail）只会在折叠途中从幕布边缘闪出来，直接藏掉 */
      /* 只在顶栏确实给出了「展开侧栏」按钮时才藏，免得窄窗口下窄栏和按钮两头都没有 */
      'html[data-platform=darwin] body:has([data-slot="shell.leading"] button) [data-slot=root] > [data-sidebar-collapsed=true] > ' + C('sidebarCol') + ' ' + C('collapsed') + '{visibility:hidden}',
      'body:has([data-slot=root] > [data-sidebar-collapsed=true]) #hos-chrome .hos-brand{opacity:0;transition:transform 720ms ' + EASE + ',opacity 0s linear ' + FOLD_MS + 'ms}',
      'body[data-hos-phase=docked]:not(:has([data-slot=root] > [data-sidebar-collapsed=true])) #hos-chrome .hos-brand{transition:transform 720ms ' + EASE + ',opacity 0s}',
      'body:not([data-hos-chassis]) #hos-chrome .hos-brand{left:20px;top:18px}',
      /* 开机读数：只在揭幕时接住启动页，随后退场 */
      '#hos-chrome .hos-meta{position:absolute;left:46px;top:170px;display:flex;gap:10px;white-space:nowrap;font-family:var(--hos-mono);font-size:10px;letter-spacing:.16em;color:var(--hos-muted)}',
      '#hos-chrome .hos-meta .clk{color:var(--hos-accent);font-variant-numeric:tabular-nums}',
      '#hos-chrome .hos-slats{position:absolute;left:46px;top:196px;display:flex;gap:5px}',
      '#hos-chrome .hos-slats i{width:20px;height:2px;background:var(--hos-ink);opacity:.3}',
      '#hos-chrome .hos-slats i.on{width:34px;background:var(--hos-accent);opacity:1}',
      '#hos-chrome .hos-boot{transition:opacity 360ms ease,transform 420ms ' + EASE + '}',
      'body[data-hos-phase=docked] #hos-chrome .hos-boot{opacity:0;transform:translateX(-14px)}',
      /* 页脚：与启动动画 .dsu-foot 同位，只在空会话页显示 */
      '#hos-chrome .hos-foot{position:absolute;right:46px;bottom:52px;display:flex;align-items:center;gap:10px;font-family:var(--hos-mono);font-size:11px;letter-spacing:.2em;opacity:0;transition:opacity 300ms ease}',
      '#hos-chrome .hos-foot i{width:26px;height:7px;background:var(--hos-ink)}',
      'body:has([data-phase=hero]):not(:has([data-sidebar-right-open=true])) #hos-chrome .hos-foot,body[data-hos-phase=boot] #hos-chrome .hos-foot,body[data-hos-phase=assemble] #hos-chrome .hos-foot{opacity:1}',
      '#hos-chrome .hos-scan{position:absolute;left:0;right:0;top:-14%;height:96px;opacity:0;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.035) 58%,rgba(0,0,0,.08) 86%,rgba(0,0,0,.12) 97%,rgba(0,0,0,0) 100%)}',
      D + ' #hos-chrome .hos-scan{background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.04) 58%,rgba(255,255,255,.09) 86%,rgba(255,255,255,.14) 97%,rgba(255,255,255,0) 100%)}',
      '#hos-chrome .hos-scan.go{animation:hos-scan 2200ms cubic-bezier(.42,0,.58,1) 1}',
      '@keyframes hos-scan{0%{top:-14%;opacity:0}10%{opacity:1}86%{opacity:1}100%{top:102%;opacity:0}}'
    ]

    /* ── 3. 侧栏 ─────────────────────────────────────────────────────────── */
    var SB = B + ' [data-slot=sidebar]'
    var SIDEBAR = [
      /* 原生 logo 让位给覆盖层的品牌块；按钮本身保留（点它仍是新建会话） */
      SB + ' ' + C('logoRow') + '{box-sizing:border-box;min-height:var(--hos-logo-h,74px);height:auto;align-items:flex-start;padding-top:var(--hos-logo-pad,6px)!important}',
      SB + ' ' + C('brandIdentity') + '{opacity:0}',
      SB + ' ' + C('brand') + '{min-width:118px;min-height:50px}',
        /* 揭幕时 logo 行下方撑开 118px 给开机读数让位（收起按钮留在顶部），收起后回到原位 */
      SB + ' ' + C('logoRow') + '{transition:margin-bottom 680ms ' + EASE + '}',
      'body[data-hos-phase=boot] [data-slot=sidebar] ' + C('logoRow') + ',body[data-hos-phase=assemble] [data-slot=sidebar] ' + C('logoRow') + '{margin-bottom:118px}',
      /* 新会话：启动页 .dsu-btn 的擦入按钮 */
      SB + ' ' + C('newSession') + '{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--hos-ink) 72%,transparent)!important;background:color-mix(in srgb,var(--hos-bg) 18%,transparent)!important;box-shadow:none!important;color:var(--hos-ink);transition:color 220ms ease}',
      SB + ' ' + C('newSession') + '::before{content:"";position:absolute;inset:0;background:var(--hos-ink);transform:translateX(-101%);transition:transform 300ms cubic-bezier(.2,.9,.2,1)}',
      SB + ' ' + C('newSession') + ':is(:hover,:focus-visible){color:var(--hos-box-ink)}',
      SB + ' ' + C('newSession') + ':is(:hover,:focus-visible)::before{transform:none}',
      SB + ' ' + C('newSession') + ' > *{position:relative;z-index:1}',
      SB + ' ' + C('newSessionLabel') + '{letter-spacing:.08em;font-weight:500}',
      SB + ' ' + C('newSessionShortcut') + ' kbd{font-family:var(--hos-mono);background:none!important;border:0!important;color:inherit;opacity:.6}',
      SB + ' ' + C('sectionLabel') + '{font-size:12px;letter-spacing:.12em;color:var(--hos-muted)}',
      SB + ' ' + C('sectionHeader') + '{border-top:1px solid var(--hos-hair);padding-top:10px;margin-top:6px}',
      SB + ' ' + C('panelList') + '{margin-top:4px}',
      /* 当前会话：终幕「DEEPSEEK HARNESS」那块黑底白字 */
      SB + ' ' + C('sessionRow') + C('selected') + '{background:var(--hos-box-bg)!important;color:var(--hos-box-ink)!important}',
      SB + ' ' + C('sessionRow') + C('selected') + ' *{color:inherit!important}',
      SB + ' ' + C('footArea') + '{border-top:1px solid var(--hos-hair)}',
      /* 底部伪代码状态 */
      '.hos-sys{margin:10px 10px 4px;padding-top:2px;font-family:var(--hos-mono);font-size:10px;line-height:1.75;letter-spacing:.04em;color:var(--hos-muted);white-space:nowrap;overflow:hidden;pointer-events:none}',
      '.hos-sys .r{display:flex;gap:8px}',
      '.hos-sys .k{color:var(--hos-accent-ink)}',
      '.hos-sys .clk{margin-left:auto;color:var(--hos-accent);font-variant-numeric:tabular-nums}',
      '.hos-sys .v{color:var(--hos-ink-soft);overflow:hidden;text-overflow:ellipsis}',
      '.hos-sys .dot{display:inline-block;width:5px;height:5px;margin-right:6px;vertical-align:1px;background:var(--hos-accent-2)}',
      '.hos-sys.busy .dot{background:var(--hos-accent);animation:hos-blink 1.1s steps(2) infinite}',
      '@keyframes hos-blink{50%{opacity:.25}}',
      SB + ':has([data-collapsed=true]) .hos-sys{display:none}'
    ]

    /* ── 4. 空会话页（hero）与输入卡 ──────────────────────────────────── */
    var CV = B + ' [data-slot="main.conversation"]'
    var HERO = [
      CV + ' ' + C('composerHero') + ' ' + C('headline') + '{position:relative;flex-direction:column;align-items:center;gap:0;padding:56px 0 40px}',
      CV + ' ' + C('composerHero') + ' ' + C('fishHitbox') + '{display:none}',
      CV + ' ' + C('composerHero') + ' ' + C('titleGroup') + '{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:10px}',
      CV + ' ' + C('composerHero') + ' ' + C('titleGroup') + ' > span:first-child{font-size:clamp(30px,4.4vh,46px);font-weight:500;letter-spacing:.3em;text-indent:.3em;color:var(--hos-ink);text-shadow:0 0 14px var(--hos-halo),0 0 5px var(--hos-halo);white-space:nowrap}',
      CV + ' > ' + C('root') + '[data-phase]{background:transparent!important}',
      CV + ' ' + C('previewBadge') + '{position:static!important;transform:none!important;align-self:center;order:3;margin-top:8px;padding:1px 6px;background:none!important;border:1px solid var(--hos-hair);font-family:var(--hos-mono);font-size:9.5px;letter-spacing:.22em;color:var(--hos-muted)!important}',
      '.hos-hero-en{position:relative;z-index:1;margin-top:6px;font-family:var(--hos-mono);font-size:11px;letter-spacing:.5em;text-indent:.5em;color:var(--hos-ink-soft);text-shadow:0 0 10px var(--hos-halo);white-space:nowrap}',
      /* 矮窗口里准星缩小，英文副标题收字距，两端不压外圈 */
      '@media (max-height:860px){.hos-hero-en{letter-spacing:.34em;text-indent:.34em}}',
      '.hos-hero-rule{position:relative;z-index:1;width:min(520px,80%);height:1px;margin-top:10px;background:linear-gradient(90deg,transparent,var(--hos-hair) 18%,var(--hos-hair) 82%,transparent)}',
      '.hos-reticle{position:absolute;left:50%;top:50%;width:clamp(340px,46vh,400px);aspect-ratio:1;transform:translate(-50%,-50%);color:var(--hos-ink);pointer-events:none;z-index:0}',
      '.hos-reticle.docking{transition:transform 1150ms cubic-bezier(.22,.8,.2,1),opacity 900ms ease}',
      '.hos-reticle svg{width:100%;height:100%;overflow:visible}',
      '.hos-r-a{fill:none;stroke:currentColor;stroke-width:1.6;opacity:.62}.hos-r-b{fill:none;stroke:currentColor;stroke-width:1;opacity:.3}',
      '.hos-r-k{fill:none;stroke:currentColor;stroke-width:1.2;opacity:.55}.hos-r-t{stroke:currentColor;stroke-width:1;opacity:.22}.hos-r-t.m{opacity:.42;stroke-width:1.4}',
      '.hos-r-d{stroke:var(--hos-accent-2);stroke-width:1.4;opacity:.25}.hos-r-d.lit{opacity:.85}.hos-r-dot{fill:currentColor}.hos-r-o{fill:var(--hos-accent)}',
      '.hos-r-c{fill:none;stroke:var(--hos-accent-2);stroke-width:2.2;stroke-linecap:round;opacity:.7;transform-origin:200px 200px;animation:hos-spin 7.5s linear infinite}',
      '.hos-r-ra{transform-origin:200px 200px;animation:hos-spin 90s linear infinite}.hos-r-rb{transform-origin:200px 200px;animation:hos-spin 60s linear infinite reverse}',
      '@keyframes hos-spin{to{transform:rotate(360deg)}}',
      /* 工作区 / 模式胶囊 */
      CV + ' ' + C('heroWorkspaceRow') + ' :is(' + C('workspace') + ',' + C('seat') + '),' + CV + ' [data-slot="conversation.input.permission"] ' + C('trigger') + '{border:1px solid var(--hos-hair-soft)!important;background:var(--hos-hair-soft)!important;color:var(--hos-ink-soft)}',
      CV + ' ' + C('heroWorkspaceRow') + ' :is(' + C('workspace') + ',' + C('seat') + '):hover,' + CV + ' [data-slot="conversation.input.permission"] ' + C('trigger') + ':hover{border-color:var(--hos-hair)!important;color:var(--hos-ink)}',
      /* 输入卡：切角 + 磨砂 */
      CV + ' [data-composer-card=true]{border:1px solid var(--hos-hair)!important;background:linear-gradient(180deg,var(--hos-glass-hi),transparent 48%),var(--hos-glass)!important;-webkit-backdrop-filter:blur(15px) saturate(1.18);backdrop-filter:blur(15px) saturate(1.18);box-shadow:none!important;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}',
      CV + ' [data-composer-card=true]{--hos-cl:color-mix(in srgb,var(--hos-ink) 20%,transparent);background:' + cutTR(16) + ',' + cutBL(16) + ',var(--hos-glass)!important;border-color:var(--hos-cl)!important}',
      CV + ' [data-composer-card=true] [data-composer-input]{min-height:44px}',
      /* 加号：去掉原生的底块（input.right 槽留给第三方插件，不动） */
      CV + ' [data-composer-card=true] ' + C('add') + '{background:transparent!important;border:1px solid transparent!important;box-shadow:none!important;color:var(--hos-ink-soft)}',
      CV + ' [data-composer-card=true] ' + C('add') + ':hover{background:var(--hos-hair-soft)!important}',
      CV + ' [data-slot="conversation.input.model"] ' + C('trigger') + '{background:transparent!important;border:0!important;box-shadow:none!important}',
      CV + ' [data-slot="conversation.input.model"] ' + C('trigger') + ':hover{background:var(--hos-hair-soft)!important}',
      CV + ' [data-slot="conversation.input.model"] ' + C('triggerEffort') + '{font-family:var(--hos-mono);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--hos-accent-ink)!important}',
      /* 输入框下方的轮次 / 速度 / 用量：等宽读数 */
      CV + ' [data-composer-dock=true]{font-family:var(--hos-mono);font-size:10px;letter-spacing:.12em;color:var(--hos-muted)}',
      CV + ' [data-composer-dock=true] *{font-family:inherit!important;font-size:inherit!important;letter-spacing:inherit}',
      /* 待办 / 目标 / 队列：贴在输入框上方的切角卡 */
      CV + ' [data-slot="conversation.input.dock"] :is([data-testid=todo-panel],[data-goal-bar],[data-queue-dock]){--hos-cl:var(--hos-hair);border:1px solid var(--hos-cl)!important;border-bottom:0!important;background:' + cutTR(10) + ',linear-gradient(180deg,var(--hos-glass-hi),transparent 70%),var(--hos-glass)!important;box-shadow:none!important;-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px);clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}',
      /* 第三方 dsh-input-traffic 用自己的排队栏（[data-steer-dock]）替换官方那条：原生是 bg-layer-1 米色底 + 四边圆角框，
         同样做成贴在输入卡上方的玻璃切角卡（只认属性和结构，不认它带哈希的类名） */
      B + ' [data-steer-dock] > div{--hos-cl:var(--hos-hair);border:1px solid var(--hos-cl)!important;border-bottom:0!important;border-radius:0!important;background:' + cutTR(10) + ',linear-gradient(180deg,var(--hos-glass-hi),transparent 70%),var(--hos-glass)!important;box-shadow:none!important;-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px);clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}',
      B + ' [data-steer-dock] > div > :first-child{border-bottom-color:var(--hos-hair-soft)!important}',
      /* 输入框座位的淡出渐变：原生在暗色下渐变到写死的中性灰，改成渐变到底板色 */
      CV + ' ' + C('composerSeat') + '{background:none!important;isolation:isolate}',
      CV + ' [data-content-phase=active] ' + C('composerSeat') + '::before{content:"";position:absolute;left:0;right:0;top:-24px;bottom:0;z-index:-1;pointer-events:none;background:' + BRUSH + ',radial-gradient(120% 90% at 78% 12%,rgba(255,255,255,.85) 0%,rgba(255,255,255,0) 55%),linear-gradient(168deg,var(--hos-bg-2) 0%,var(--hos-bg) 42%,var(--hos-bg) 100%);background-size:420px 420px,100vw 100vh,100vw 100vh;background-repeat:repeat,no-repeat,no-repeat;background-attachment:scroll;background-position:var(--hos-seat-x,0) var(--hos-seat-y,0);background-blend-mode:overlay,normal,normal;-webkit-mask-image:linear-gradient(transparent,#000 30px);mask-image:linear-gradient(transparent,#000 30px)}',
      D + ' [data-slot="main.conversation"] [data-content-phase=active] ' + C('composerSeat') + '::before{background:' + BRUSH + ',radial-gradient(90% 70% at 50% 46%,rgba(40,70,86,.32) 0%,rgba(0,0,0,0) 62%),linear-gradient(168deg,var(--hos-bg-2) 0%,var(--hos-bg) 46%,#05070a 100%);background-size:420px 420px,100vw 100vh,100vw 100vh;background-repeat:repeat,no-repeat,no-repeat;background-attachment:scroll;background-position:var(--hos-seat-x,0) var(--hos-seat-y,0)}',
      /* 信号轨迹只属于空会话页 */
      CV + ' > [data-phase=active] .hos-trace{display:none}',
      CV + ' [data-composer-card=true]:focus-within{--hos-cl:color-mix(in srgb,var(--hos-ink) 45%,transparent)}',
      CV + ' [data-composer-card=true] ' + C('primary') + '{background:var(--hos-ink)!important;color:var(--hos-box-ink)!important;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%);transition:background-color 200ms}',
      CV + ' [data-composer-card=true] ' + C('primary') + ':not(:disabled):hover{background:var(--hos-accent)!important;color:#fff!important}',
      CV + ' [data-slot="conversation.input.model"] ' + C('triggerLabel') + '{font-family:var(--hos-din);letter-spacing:.04em}',
      /* 信号轨迹（hero 下方） */
      '.hos-trace{width:min(520px,70%);height:38px;margin:18px auto 0;opacity:.74;pointer-events:none}',
      '.hos-trace svg{width:100%;height:100%;overflow:visible}',
      '.hos-t-b,.hos-t-k{stroke:var(--hos-hair);stroke-width:1}.hos-t-k{opacity:.7}',
      '.hos-t-l{fill:none;stroke:var(--hos-accent-2);stroke-width:1.25;stroke-linejoin:round;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--hos-accent-2) 50%,transparent))}',
      '.hos-t-c{stroke:var(--hos-accent);stroke-width:1;animation:hos-tscan 4.6s linear infinite}',
      '@keyframes hos-tscan{from{transform:translateX(0)}to{transform:translateX(520px)}}'
    ]

    /* ── 5. 对话流 ───────────────────────────────────────────────────────── */
    var FLOW = [
      CV + ' [data-slot="conversation.header"] ' + C('crumbCurrent') + '{font-weight:600;letter-spacing:.04em}',
      CV + ' [data-conversation-tabs] ' + C('tab') + '{font-size:12.5px;padding:3px 10px;border:1px solid transparent}',
      CV + ' [data-conversation-tabs] ' + C('tabActive') + '{background:var(--hos-box-bg)!important;color:var(--hos-box-ink)!important}',
      /* 原生选中标签底下的强调色指示条和反色块重复，暗色下还露出一截蓝 */
      CV + ' [data-conversation-tabs] ' + C('tab') + '::after{display:none}',
      /* 提问卡：原生底色写死（浅色纯白、暗色 #2C2C2E），改成和输入卡同一套玻璃切角卡 */
      CV + ' [data-question-key] ' + C('card') + '{--hos-cl:color-mix(in srgb,var(--hos-ink) 20%,transparent);border:1px solid var(--hos-cl);background:' + cutTR(16) + ',var(--hos-glass)!important;-webkit-backdrop-filter:blur(15px) saturate(1.18);backdrop-filter:blur(15px) saturate(1.18);box-shadow:none!important;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}',
      CV + ' [data-question-key] ' + C('badge') + '{background:transparent!important;border:1px solid var(--hos-hair);color:var(--hos-accent-ink)!important;font-family:var(--hos-mono);font-size:10px;letter-spacing:.12em}',
      CV + ' [data-chat-flow-kind=user] ' + C('bubble') + '{--hos-cl:var(--hos-hair);border:1px solid var(--hos-cl)!important;background:' + cutTR(12) + ',var(--hos-glass)!important;box-shadow:inset 0 1px 0 var(--hos-glass-hi);clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}',
      CV + ' :is(' + C('timeStart') + ',' + C('timeEnd') + ',' + C('endInfo') + '){font-family:var(--hos-mono);font-size:10px;letter-spacing:.14em}',
      CV + ' [data-turn-process]{font-family:var(--hos-mono);font-size:10.5px;letter-spacing:.14em;color:var(--hos-muted)}',
      /* 思考 / 工具调用行：标题改成等宽小字，像启动页的状态行 */
      CV + ' [data-disclosure-row] ' + C('title') + '{font-family:var(--hos-mono);font-size:10px;letter-spacing:.22em;color:var(--hos-muted)!important}',
      CV + ' [data-disclosure-row] :is(' + C('summary') + ',' + C('summaryText') + '){color:var(--hos-ink-soft)}',
      CV + ' [data-state=running] [data-disclosure-row] ' + C('title') + '{color:var(--hos-accent-ink)!important}',
      CV + ' [data-chat-flow-kind=tool-call] [data-disclosure-row]{border-bottom:1px solid var(--hos-hair-soft)}',
      CV + ' [data-chat-flow-kind=tool-call] [data-disclosure-row]:hover{background:var(--hos-hair-soft)}',
      CV + ' pre,' + CV + ' code{font-family:var(--hos-mono)}',
      CV + ' :is(pre,[class*="codeBlock"]){border:1px solid var(--hos-hair)}',
      /* 代码卡片：外框包住语言栏和代码区，代码区只留和语言栏之间的分隔线 */
      CV + ' .md-code-block{border:1px solid var(--hos-hair)}',
      CV + ' .md-code-block pre{border:0;border-top:1px solid var(--hos-hair-soft)}',
      /* 改动文件卡片 / 交付卡片：同一套切角 */
      CV + ' :is([class*="_changes"],[class*="deliver"],[class*="Deliver"]) :is(button,a){border-radius:0}'
    ]

    /* ── 5b. 轨迹页：表格 + 时间轴，换成档案的读法 ─────────────────── */
    var TRAJ = [
      /* 轨迹页根节点和分栏用 bg-layer-1 铺满，盖住底板成一整块实色 */
      CV + ' ' + C('split') + ',' + CV + ' :has(> ' + C('split') + '){background:transparent!important}',
      CV + ' ' + C('tablePane') + ',' + CV + ' ' + C('table') + '{background:transparent!important;--trajectory-turn-accent:var(--hos-hair)}',
      CV + ' ' + C('table') + ' th{background:color-mix(in srgb,var(--hos-bg-2) 92%,transparent)!important;font-family:var(--hos-mono)!important;font-size:9.5px!important;letter-spacing:.22em;font-weight:400!important;color:var(--hos-muted)!important;border-bottom:1px solid var(--hos-hair)!important}',
      CV + ' ' + C('table') + ' td{border-bottom:1px solid var(--hos-hair-soft)!important}',
      CV + ' ' + C('table') + ' tbody tr[data-selected=true]{background:color-mix(in srgb,var(--hos-ink) 8%,transparent)!important}',
      CV + ' ' + C('table') + ' tbody tr[data-turn-start=true]:not(:first-child) td::before{background:var(--hos-hair)!important;height:1px!important}',
      CV + ' ' + C('turnRail') + '{background:var(--hos-hair-soft)!important}',
      CV + ' ' + C('selectionRail') + '{background:var(--hos-accent)!important}',
      /* 角色标签：去掉彩色底，改成描边等宽小字 */
      CV + ' ' + C('kindTag') + '{background:transparent!important;border:1px solid currentColor!important;font-family:var(--hos-mono);font-size:10px;letter-spacing:.14em;height:18px}',
      CV + ' ' + C('kindTag') + C('user') + '{color:var(--hos-ink)!important;background:var(--hos-hair-soft)!important}',
      CV + ' ' + C('kindTag') + C('assistantVioletBright') + '{color:var(--hos-accent-2)!important}',
      CV + ' ' + C('kindTag') + C('toolAmber') + '{color:var(--hos-accent-ink)!important}',
      CV + ' ' + C('kindTag') + C('subtoolAmber') + '{color:color-mix(in srgb,var(--hos-accent-ink) 65%,var(--hos-muted))!important}',
      CV + ' ' + C('kindTag') + C('contextGreen') + '{color:color-mix(in srgb,var(--hos-accent-2) 55%,var(--hos-muted))!important}',
      CV + ' ' + C('kindTag') + C('systemNeutral') + '{color:var(--hos-muted)!important}',
      /* 时间轴：直角色块，同一套配色 */
      CV + ' ' + C('span') + '[data-timeline-span]{border-radius:0!important;height:6px!important;margin-top:1px}',
      CV + ' ' + C('span') + '[data-timeline-span=message]{--trajectory-assistant-decoding-color:var(--hos-accent-2)!important;--trajectory-assistant-ttft-color:color-mix(in srgb,var(--hos-accent-2) 40%,transparent)!important}',
      CV + ' ' + C('span') + '[data-timeline-span=tool],' + CV + ' ' + C('span') + '[data-timeline-span=subtool]{background:var(--hos-accent)!important}',
      CV + ' ' + C('span') + '[data-timeline-span=user]{background:var(--hos-ink)!important}',
      CV + ' ' + C('span') + '[data-timeline-span=context]{background:color-mix(in srgb,var(--hos-accent-2) 45%,var(--hos-muted))!important}',
      CV + ' ' + C('span') + '[data-current=true]{box-shadow:0 0 0 1px var(--hos-bg),0 0 0 2px var(--hos-ink)!important}',
      CV + ' ' + C('labels') + '{font-family:var(--hos-mono)!important;letter-spacing:.14em;color:var(--hos-muted)!important;border-right:1px solid var(--hos-hair)!important}',
      CV + ' ' + C('turnBoundary') + '{background:var(--hos-hair)!important}',
      /* 工具栏：时长 / 轮次 / 调用切换与搜索 */
      CV + ' ' + C('toggle') + '{font-family:var(--hos-mono);font-size:10.5px;letter-spacing:.12em}',
      CV + ' ' + C('search') + '{background:transparent!important;border:0!important;border-bottom:1px solid var(--hos-hair)!important;box-shadow:none!important}',
      /* 详情面板 */
      CV + ' ' + C('details') + '{background:linear-gradient(180deg,color-mix(in srgb,var(--hos-glass) 70%,transparent),color-mix(in srgb,var(--hos-glass) 30%,transparent))!important;border-left:1px solid var(--hos-hair)!important}',
      CV + ' ' + C('detailsTitle') + '{font-weight:600;letter-spacing:.04em}',
      CV + ' ' + C('detailTabActive') + '{background:var(--hos-box-bg)!important;color:var(--hos-box-ink)!important}',
      CV + ' :is(' + C('jsonPayload') + ',' + C('programSource') + ',' + C('programOutput') + ',' + C('sourceBlock') + '){border:1px solid var(--hos-hair)!important;font-family:var(--hos-mono)}'
    ]

    /* ── 5c. 全局面板：插件页、插件市场等（含第三方插件页） ─────────── */
    /* 层级底色压到接近底板，吸顶区和卡片不再在底板上浮成亮块 */
    var PANELS = [
      B + ' [data-slot=main] > :not([data-slot="main.conversation"]){--dsw-alias-bg-layer-1:transparent;--dsw-alias-bg-layer-2:color-mix(in srgb,var(--hos-glass) 70%,transparent);--dsw-alias-bg-layer-3:color-mix(in srgb,var(--hos-glass) 85%,transparent);--dsw-alias-bg-base:transparent}',
      B + ' [data-slot=main] > :not([data-slot="main.conversation"]) :is(input[type=search],input[type=text],input:not([type])){background:transparent!important;box-shadow:none!important}'
    ]

    /* ── 6. 右侧栏（停靠列） ─────────────────────────────────────────── */
    var RB = B + ' [data-slot=rightbar]'
    var DOCK = [
      /* 终端屏幕：原生用 bg-base 实色铺底，浅色下是一整块灰；透明后落在面板玻璃上 */
      RB + ' ' + C('screen') + ',' + RB + ' :is(.xterm-viewport,.xterm-scrollable-element){background:transparent!important}',
      /* 面板左边线由皮肤画，停靠区第一列自带的左边线会和它并成一条粗线 */
      RB + ' ' + C('tabHost') + '[data-dockkit-column="0"]{border-left:0}',
      /* dockkit 的停靠标签页宿主用 bg-base 实色铺底，会盖住面板玻璃（桌面端底板生效后尤其显眼）；浮动窗保留自己的层级底色 */
      B + ' ' + C('tabHost') + ':not(' + C('float') + '),' + B + ' ' + C('emptyTabHost') + '{background:transparent}',
      RB + ' ' + C('panel') + '[data-sidebar-right-open=true]{border-left:1px solid var(--hos-hair);background:linear-gradient(180deg,color-mix(in srgb,var(--hos-glass) 55%,transparent),color-mix(in srgb,var(--hos-glass) 22%,transparent))!important;box-shadow:none!important}',
      RB + ' [data-dockkit-strip]{border-bottom:1px solid var(--hos-hair)}',
      RB + ' [data-dockkit-tab]{border:1px solid var(--hos-hair-soft);font-size:12.5px}',
      RB + ' [data-dockkit-tab][aria-selected=true]{background:var(--hos-box-bg)!important;color:var(--hos-box-ink)!important;border-color:var(--hos-box-bg)}',
      RB + ' [data-dockkit-tab][aria-selected=true] *{color:inherit!important}',
      /* 引导页：罗盘换成启动页的准星 */
      RB + ' [data-sidebar-right-guide] ' + C('hero') + ' > svg:not(.hos-guide-ret){display:none}',
      RB + ' [data-sidebar-right-guide] ' + C('hero') + '{width:132px;height:132px;opacity:.55;color:var(--hos-ink)}',
      RB + ' [data-sidebar-right-guide] ' + C('hero') + ' .hos-guide-ret{width:100%;height:100%}',
      RB + ' [data-sidebar-right-guide-entry]{--hos-cl:var(--hos-hair);position:relative;overflow:hidden;border:1px solid var(--hos-cl)!important;background:' + cutTR(10) + ',color-mix(in srgb,var(--hos-glass) 70%,transparent)!important;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%);transition:color 220ms ease,border-color 220ms}',
      RB + ' button[data-sidebar-right-guide-entry]::before{content:"";position:absolute;inset:0;background:var(--hos-ink);transform:translateX(-101%);transition:transform 300ms cubic-bezier(.2,.9,.2,1);z-index:0}',
      RB + ' button[data-sidebar-right-guide-entry]:is(:hover,:focus-visible){--hos-cl:var(--hos-ink);color:var(--hos-box-ink)}',
      RB + ' button[data-sidebar-right-guide-entry]:is(:hover,:focus-visible)::before{transform:none}',
      RB + ' button[data-sidebar-right-guide-entry]:is(:hover,:focus-visible) *{color:inherit!important}',
      RB + ' button[data-sidebar-right-guide-entry] > *{position:relative;z-index:1}'
    ]

    /* ── 7. 浮层：菜单、提示、设置页 ─────────────────────────────────── */
    var POP = [
      B + ' [data-radix-popper-content-wrapper]{filter:drop-shadow(0 18px 40px rgba(20,16,10,.16))}',
      /* 会话悬停卡：原生在组件上写死 --dsw-hovercard-bg: #2C2C2E，换成和提示框同一块深色切角卡 */
      B + ' > ' + C('card') + '{--dsw-hovercard-bg:var(--hos-tip);--hos-cl:color-mix(in srgb,white 14%,transparent);border:1px solid var(--hos-cl);background:' + cutTR(10) + ',var(--hos-tip)!important;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}',
      D + ' [data-radix-popper-content-wrapper]{filter:drop-shadow(0 22px 48px rgba(0,0,0,.5))}',
      /* mac 桌面端 DSH 在菜单下面垫了一层不跟着切角走的实色底（_backing），切角处会露出一块 */
      B + ' ' + C('backing') + '{display:none}',
      B + ' [data-menu-material]{--hos-cl:var(--hos-hair);border:1px solid var(--hos-cl)!important;box-shadow:none!important;clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,0 100%)}',
      /* 菜单的底色画在里层 material 上，斜线只能叠在最上面 */
      B + ' [data-menu-material]::after{content:"";position:absolute;inset:-1px;pointer-events:none;z-index:2;background:' + cutTR(11) + '}',
      B + ' [data-menu-material] > ' + C('material') + '{background:linear-gradient(180deg,var(--hos-glass-hi),transparent 60%),color-mix(in srgb,var(--hos-bg-2) 96%,transparent)!important;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}',
      B + ' [data-menu-material] ' + C('item') + '{font-size:13px}',
      B + ' [data-menu-material] ' + C('item') + C('selected') + '{color:var(--hos-ink)}',
      B + ' [data-menu-material] ' + C('item') + C('selected') + ' > svg:last-child{color:var(--hos-accent-ink)}',
      B + ' [data-menu-material] :is(kbd,' + C('shortcut') + '){font-family:var(--hos-mono);font-size:10px;background:none!important;border:0!important;color:var(--hos-muted)}',
      B + ' [role=menu][aria-label] ' + C('groups') + '{border:1px solid var(--hos-hair)}',
      /* 设置页：第二块机箱面板，四角压定位角 */
      B + ' [data-shortcut-modal=settings]{position:relative;border:1px solid var(--hos-hair)!important;background:' + BRUSH + ',linear-gradient(168deg,var(--hos-bg-2) 0%,var(--hos-bg) 60%)!important;background-size:420px 420px,auto!important;background-blend-mode:overlay,normal!important;box-shadow:0 40px 120px rgba(30,24,16,.22)!important}',
      D + ' [data-shortcut-modal=settings]{box-shadow:0 40px 120px rgba(0,0,0,.6)!important}',
      B + ' [data-shortcut-modal=settings]::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:5;background:' +
        'linear-gradient(var(--hos-ink),var(--hos-ink)) 0 0/26px 1px no-repeat,linear-gradient(var(--hos-ink),var(--hos-ink)) 0 0/1px 26px no-repeat,' +
        'linear-gradient(var(--hos-ink),var(--hos-ink)) 100% 0/26px 1px no-repeat,linear-gradient(var(--hos-ink),var(--hos-ink)) 100% 0/1px 26px no-repeat,' +
        'linear-gradient(var(--hos-ink),var(--hos-ink)) 0 100%/26px 1px no-repeat,linear-gradient(var(--hos-ink),var(--hos-ink)) 0 100%/1px 26px no-repeat,' +
        'linear-gradient(var(--hos-ink),var(--hos-ink)) 100% 100%/26px 1px no-repeat,linear-gradient(var(--hos-ink),var(--hos-ink)) 100% 100%/1px 26px no-repeat;opacity:.62}',
      B + ' [data-shortcut-modal=settings] ' + C('nav') + '{background:transparent!important;border-right:1px solid var(--hos-hair)}',
      B + ' [data-shortcut-modal=settings] ' + C('navTitle') + '{letter-spacing:.14em;font-weight:600}',
      B + ' [data-shortcut-modal=settings] ' + C('navTitle') + '::after{content:"SETTINGS";display:block;margin-top:4px;font-family:var(--hos-mono);font-size:9.5px;font-weight:400;letter-spacing:.4em;color:var(--hos-muted)}',
      B + ' [data-shortcut-modal=settings] ' + C('navCell') + C('active') + '{background:var(--hos-box-bg)!important;color:var(--hos-box-ink)!important}',
      B + ' [data-shortcut-modal=settings] ' + C('navCell') + C('active') + ' *{color:inherit!important}',
      B + ' [data-shortcut-modal=settings] ' + C('content') + '{background:transparent!important}',
      B + ' [data-shortcut-modal=settings] :is(' + C('row') + ',' + C('setting') + '){border-bottom:1px solid var(--hos-hair-soft)}',
      B + ' [data-shortcut-modal=settings] :is(' + C('desc') + ',' + C('description') + ',' + C('settingDescription') + '){color:var(--hos-muted)}',
      B + ' [data-shortcut-modal=settings] ' + C('selector') + '{border:1px solid var(--hos-hair)!important;background:transparent!important}',
      /* 「编辑快捷键」和字号步进器原生没有边框（暗色下又是实心块），和同页的下拉框统一成发丝框 */
      B + ' [data-shortcut-modal=settings] ' + C('setting') + ' > ' + C('button') + ',' + B + ' [data-shortcut-modal=settings] ' + C('stepper') + '{border:1px solid var(--hos-hair)!important;background:transparent!important}',
      B + ' [data-shortcut-modal=settings] ' + C('setting') + ' > ' + C('button') + '{padding:5px 12px}',
      B + ' [data-shortcut-modal=settings] ' + C('setting') + ' > ' + C('button') + ':hover{background:var(--hos-hair-soft)!important}',
      /* 设置页里的原生滑块 / 复选框（开机动画那一节）不用浏览器默认蓝 */
      B + ' [data-shortcut-modal=settings] input:is([type=range],[type=checkbox],[type=radio]){accent-color:var(--hos-ink)}',
      B + ' [data-shortcut-modal=settings] ' + C('themeCube') + '{border:1px solid var(--hos-hair)!important}',
      B + ' [data-shortcut-modal=settings] ' + C('themeCube') + C('selected') + '{border-color:var(--hos-ink)!important}',
      /* 开关：方槽方钮，开启时槽填墨、钮点强调色 */
      B + ' [role=switch]' + C('switch') + '{border:1px solid color-mix(in srgb,var(--hos-ink) 45%,transparent)!important;background:transparent!important}',
      B + ' [role=switch]' + C('switch') + '[aria-checked=true]{background:var(--hos-ink)!important;border-color:var(--hos-ink)!important}',
      B + ' [role=switch]' + C('switch') + ' ' + C('thumb') + '{background:color-mix(in srgb,var(--hos-ink) 55%,transparent)!important;box-shadow:none!important}',
      B + ' [role=switch]' + C('switch') + '[aria-checked=true] ' + C('thumb') + '{background:var(--hos-accent)!important}',
      /* 本插件自己的设置分节 */
      '.hos-set{display:flex;flex-direction:column;gap:2px;max-width:640px;font-size:13px;color:var(--hos-ink)}',
      '.hos-set .k{padding:16px 0 7px;border-bottom:1px solid var(--hos-hair);font-family:var(--hos-mono);font-size:9.5px;letter-spacing:.24em;color:var(--hos-muted)}',
      '.hos-set .row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;padding:13px 0;border-bottom:1px solid var(--hos-hair-soft)}',
      '.hos-set .row b{display:block;font-weight:500;font-size:13.5px}.hos-set .row small{display:block;margin-top:3px;font-size:12px;line-height:1.65;color:var(--hos-muted)}',
      '.hos-set .sw{position:relative;width:34px;height:18px;padding:0;border:1px solid color-mix(in srgb,var(--hos-ink) 45%,transparent);background:transparent;cursor:pointer}',
      '.hos-set .sw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;background:color-mix(in srgb,var(--hos-ink) 55%,transparent);transition:transform 220ms ' + EASE + '}',
      '.hos-set .sw[aria-checked=true]{background:var(--hos-ink);border-color:var(--hos-ink)}.hos-set .sw[aria-checked=true]::after{transform:translateX(16px);background:var(--hos-accent)}',
      '.hos-set .sws{display:flex;gap:6px}.hos-set .sws button{width:24px;height:24px;padding:0;border:1px solid var(--hos-hair);background:transparent;display:grid;place-items:center;cursor:pointer}',
      '.hos-set .sws button i{width:12px;height:12px}.hos-set .sws button[aria-checked=true]{border-color:var(--hos-ink)}',
      '.hos-set .note{margin-top:14px;font-size:12px;line-height:1.7;color:var(--hos-muted)}'
    ]

    /* ── 8. 装配动画（揭幕） ─────────────────────────────────────────── */
    var IN_L = [SB + ' ' + C('newSession'), SB + ' ' + C('panelList'), SB + ' [data-slot="sidebar.workspaces"]', SB + ' ' + C('footArea')]
    var IN_U = [CV + ' ' + C('heroWorkspaceRow'), CV + ' [data-slot="conversation.composer.bar"]', '.hos-trace']
    var IN_F = [CV + ' ' + C('titleGroup'), '.hos-hero-en', '.hos-hero-rule', CV + ' [data-slot="conversation.header"]']
    var MOTION = [
      'body[data-hos-phase=boot] :is(' + IN_L.concat(IN_U, IN_F).join(',') + '){opacity:0}',
      'body[data-hos-phase=boot] .hos-reticle{opacity:0}',
      IN_L.map(function (s, i) { return 'body[data-hos-phase=assemble] ' + s.replace(B + ' ', '') + '{animation:hos-in-l 560ms ' + EASE + ' both;animation-delay:' + (60 + i * 60) + 'ms}' }).join(''),
      IN_U.map(function (s, i) { return 'body[data-hos-phase=assemble] ' + s.replace(B + ' ', '') + '{animation:hos-in-u 560ms ' + EASE + ' both;animation-delay:' + (360 + i * 60) + 'ms}' }).join(''),
      IN_F.map(function (s, i) { return 'body[data-hos-phase=assemble] ' + s.replace(B + ' ', '') + '{animation:hos-in-f 620ms ease both;animation-delay:' + (240 + i * 60) + 'ms}' }).join(''),
      '@keyframes hos-in-l{from{opacity:0;transform:translateX(-22px)}}',
      '@keyframes hos-in-u{from{opacity:0;transform:translateY(14px)}}',
      '@keyframes hos-in-f{from{opacity:0}}',
      'body[data-hos-motion=low] *,body[data-hos-motion=low] *::before,body[data-hos-motion=low] *::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important;transition-delay:0ms!important}',
      '@media (prefers-reduced-motion: reduce){' + B + ' *,' + B + ' *::before,' + B + ' *::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important;transition-delay:0ms!important}}',
      /* 窄窗：机框收窄，开机读数不显示 */
      '@media (max-width: 760px){' + B + '{--hos-inset:10px}#hos-chrome .hos-boot,#hos-chrome .hos-foot{display:none}}'
    ]

    var CSS_ID = NS + '/main.css'
    function cssText() {
      var a = ACCENTS[S.accent] || ACCENTS.orange
      var acc = B + '{--hos-accent:' + a[0] + ';--hos-accent-ink:' + a[1] + '}' + D + '{--hos-accent-ink:' + a[2] + '}'
      return [].concat(TOKENS, [acc], BASE, SIDEBAR, HERO, FLOW, TRAJ, PANELS, DOCK, POP, MOTION).join('\n')
    }
    var styleTag = null
    function injectCss() {
      styleTag = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]')
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.dataset.plugin = NS
        styleTag.dataset.pluginCss = CSS_ID
        document.head.appendChild(styleTag)
      }
      styleTag.textContent = cssText()
    }

    /* ── 准星与信号轨迹（与启动页同一套几何） ─────────────────────── */
    var SVGNS = 'http://www.w3.org/2000/svg'
    function svgEl(tag, attrs) { var n = document.createElementNS(SVGNS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n }
    function makeReticle() {
      var svg = svgEl('svg', { viewBox: '0 0 400 400', 'aria-hidden': 'true' })
      function arc(r, a0, a1, cls) {
        var rad = function (d) { return (d - 90) * Math.PI / 180 }
        var x0 = 200 + r * Math.cos(rad(a0)), y0 = 200 + r * Math.sin(rad(a0))
        var x1 = 200 + r * Math.cos(rad(a1)), y1 = 200 + r * Math.sin(rad(a1))
        var p = svgEl('path', { d: 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2), 'class': cls, 'stroke-linecap': 'round' })
        return { node: p, x: x1, y: y1, x0: x0, y0: y0 }
      }
      var gA = svgEl('g', { 'class': 'hos-r-ra' }), a = arc(150, 215, 505, 'hos-r-a'); gA.appendChild(a.node)
      gA.appendChild(svgEl('circle', { 'class': 'hos-r-dot', cx: a.x.toFixed(2), cy: a.y.toFixed(2), r: 6 })); svg.appendChild(gA)
      var gB = svgEl('g', { 'class': 'hos-r-rb' }), b = arc(104, 200, 490, 'hos-r-b'); gB.appendChild(b.node)
      gB.appendChild(svgEl('circle', { 'class': 'hos-r-dot', cx: b.x0.toFixed(2), cy: b.y0.toFixed(2), r: 3.5, opacity: 0.6 })); svg.appendChild(gB)
      svg.appendChild(arc(62, 118, 242, 'hos-r-k').node); svg.appendChild(arc(62, 298, 422, 'hos-r-k').node)
      ;[[152, 132], [252, 268], [278, 150]].forEach(function (p) { svg.appendChild(svgEl('circle', { 'class': 'hos-r-o', cx: p[0], cy: p[1], r: 2.8 })) })
      for (var t = 0; t < 48; t++) {
        var rd = ((t / 48) * 360 - 90) * Math.PI / 180, lg = t % 4 === 0, r1 = lg ? 143 : 138
        svg.appendChild(svgEl('line', { 'class': 'hos-r-t' + (lg ? ' m' : ''), x1: (200 + 133 * Math.cos(rd)).toFixed(2), y1: (200 + 133 * Math.sin(rd)).toFixed(2), x2: (200 + r1 * Math.cos(rd)).toFixed(2), y2: (200 + r1 * Math.sin(rd)).toFixed(2) }))
      }
      for (var d = 0; d < 40; d++) {
        var rr = ((d / 40) * 360 - 90) * Math.PI / 180, lit = d < 12
        svg.appendChild(svgEl('line', { 'class': 'hos-r-d' + (lit ? ' lit' : ''), x1: (200 + 112 * Math.cos(rr)).toFixed(2), y1: (200 + 112 * Math.sin(rr)).toFixed(2), x2: (200 + (lit ? 120 : 116) * Math.cos(rr)).toFixed(2), y2: (200 + (lit ? 120 : 116) * Math.sin(rr)).toFixed(2) }))
      }
      svg.appendChild(svgEl('circle', { 'class': 'hos-r-c', cx: 200, cy: 200, r: 150, pathLength: 100, 'stroke-dasharray': '8 92' }))
      return svg
    }
    var tracePaths = []
    function makeTrace() {
      var svg = svgEl('svg', { viewBox: '0 0 520 46', preserveAspectRatio: 'none', 'aria-hidden': 'true' })
      svg.appendChild(svgEl('line', { x1: 0, y1: 23, x2: 520, y2: 23, 'class': 'hos-t-b' }))
      for (var i = 0; i <= 20; i++) svg.appendChild(svgEl('line', { x1: i * 26, y1: 19, x2: i * 26, y2: 27, 'class': 'hos-t-k' }))
      var path = svgEl('path', { 'class': 'hos-t-l' }); svg.appendChild(path)
      svg.appendChild(svgEl('line', { x1: 0, y1: 2, x2: 0, y2: 44, 'class': 'hos-t-c' }))
      tracePaths.push(path); drawTrace()
      return svg
    }
    function drawTrace() {
      if (!tracePaths.length) return
      var drift = Date.now() * 0.00034, phase = 2.31, dd = 'M0 23'
      for (var x = 0; x <= 520; x += 8) {
        var env = Math.sin((x / 520) * Math.PI)
        var amp = (Math.sin(x * 0.035 + phase + drift) * 5 + Math.sin(x * 0.011 + phase * 1.7 - drift * 0.62) * 3) * env
        dd += ' L' + x + ' ' + (23 + amp).toFixed(1)
      }
      tracePaths = tracePaths.filter(function (p) { return p.isConnected })
      tracePaths.forEach(function (p) { p.setAttribute('d', dd) })
    }

    /* ── 覆盖层 ─────────────────────────────────────────────────────────── */
    var chrome = null
    function buildChrome() {
      chrome = document.getElementById('hos-chrome')
      if (chrome) return
      chrome = document.createElement('div')
      chrome.id = 'hos-chrome'
      chrome.setAttribute('aria-hidden', 'true')
      chrome.innerHTML =
        '<div class="hos-drag" data-window-drag="true"></div><div class="hos-line"></div><i class="hos-c tl"></i><i class="hos-c tr"></i><i class="hos-c bl"></i><i class="hos-c br"></i>' +
        '<div class="hos-scan"></div>' +
        '<div class="hos-brand"><div class="b1">DEEPSEEK</div><div class="b2">SYNTHESIZE INTELLIGENCE</div><div class="b3"><b>HARNESS</b><span>OS</span></div></div>' +
        '<div class="hos-boot"><div class="hos-meta"><span class="rev"></span><span class="clk">--:--:--</span></div><div class="hos-slats"><i></i><i></i><i></i><i></i><i></i><i class="on"></i></div></div>' +
        '<div class="hos-foot"><span>POWERED BY DEEPSEEK</span><i></i></div>'
      document.body.appendChild(chrome)
      chrome.querySelector('.rev').textContent = revText()
    }
    function facts() { var c = window.__DSH_STARTUP__; return (c && c.facts && typeof c.facts === 'object') ? c.facts : {} }
    function profileName() {
      var f = facts()
      if (f.profile) return String(f.profile).toUpperCase()
      return document.documentElement.getAttribute('data-platform') ? 'DESKTOP' : 'WEB'
    }
    /* 与启动页 .dsu-meta-1 同一行文字：「REV <版本> · <PROFILE> PROFILE」 */
    function revText() { var f = facts(); return 'REV ' + (f.version ? String(f.version) : '—') + ' · ' + profileName() + ' PROFILE' }

    /* ── 注入件：缺了就补 ───────────────────────────────────────────────── */
    var PERM_SYS = { '仅可查看': 'read-only', '工作区内修改': 'workspace-write', '完全权限': 'full-access', '自动审查': 'auto-review' }
    function ensureSys() {
      var foot = q('[data-slot=sidebar] ' + C('footArea'))
      if (!foot) return
      var sys = foot.querySelector(':scope > .hos-sys')
      if (!sys) {
        sys = document.createElement('div')
        sys.className = 'hos-sys'
        sys.setAttribute('aria-hidden', 'true')
        sys.innerHTML = '<div class="r"><span class="k">$</span><span>harness status</span><span class="clk"></span></div><div class="r"><span class="v cfg"></span></div><div class="r"><span class="v st"><i class="dot"></i><span></span></span></div>'
        foot.insertBefore(sys, foot.firstChild)
      }
    }
    function ensureHero() {
      var head = q('[data-slot="main.conversation"] ' + C('composerHero') + ' ' + C('headline'))
      if (!head) return
      var tg = head.querySelector(C('titleGroup'))
      if (tg && !tg.querySelector('.hos-hero-en')) {
        var en = document.createElement('span'); en.className = 'hos-hero-en'; en.setAttribute('aria-hidden', 'true'); en.textContent = 'EXPLORE THE UNCHARTED'
        var rule = document.createElement('span'); rule.className = 'hos-hero-rule'; rule.setAttribute('aria-hidden', 'true')
        tg.appendChild(en); tg.appendChild(rule)
      }
      if (!head.querySelector(':scope > .hos-reticle')) {
        var ret = document.createElement('div'); ret.className = 'hos-reticle'; ret.appendChild(makeReticle())
        head.insertBefore(ret, head.firstChild)
        if (phase === 'assemble') dockReticle(ret)
      }
      var hero = head.closest(C('composerHero'))
      if (hero && !hero.querySelector(':scope > .hos-trace')) {
        var tr = document.createElement('div'); tr.className = 'hos-trace'; tr.appendChild(makeTrace())
        hero.appendChild(tr)
      }
    }
    function ensureGuide() {
      document.querySelectorAll('[data-slot=rightbar] [data-sidebar-right-guide] ' + C('hero')).forEach(function (h) {
        if (h.querySelector('.hos-guide-ret')) return
        var s = makeReticle(); s.setAttribute('class', 'hos-guide-ret'); h.appendChild(s)
      })
    }
    var raf = 0
    function ensure() {
      raf = 0
      if (!document.body.hasAttribute('data-hos')) return
      ensureSys(); ensureHero(); ensureGuide(); watchSplash(); watchFrame(); syncSide()
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(ensure) }

    /* ── 每秒刷新：时钟、底部状态、侧栏收起 ─────────────────────────── */
    function pad(n) { return (n < 10 ? '0' : '') + n }
    var runningSince = 0
    function tick() {
      var d = new Date(), clk = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
      if (chrome) { var c = chrome.querySelector('.hos-meta .clk'); if (c) c.textContent = clk }
      var sys = q('.hos-sys')
      if (sys) {
        sys.querySelector('.clk').textContent = clk
        var perm = q('[data-slot="conversation.input.permission"] ' + C('triggerLabel'))
        var model = q('[data-slot="conversation.input.model"] ' + C('triggerLabel'))
        var p = perm ? (PERM_SYS[perm.textContent.trim()] || perm.textContent.trim()) : '—'
        var m = model ? model.textContent.trim() : ''
        sys.querySelector('.cfg').textContent = profileName().toLowerCase() + ' · ' + p + (m && m !== '请选择模型' ? ' · ' + m : '')
        var busy = !!q('[data-chat-running]:not([data-chat-running=false])')
        if (busy && !runningSince) runningSince = Date.now()
        if (!busy) runningSince = 0
        sys.classList.toggle('busy', busy)
        sys.querySelector('.st > span').textContent = busy ? 'running · ' + Math.round((Date.now() - runningSince) / 1000) + 's' : 'ready'
      }
      drawTrace()
      syncSide()
    }
    /* 侧栏收起时品牌块要让位（macOS 收起会整列隐藏、DSH 把收起按钮放进顶栏）。
       侧栏节点会被替换，所以不用 ResizeObserver，每次 ensure / tick / resize 都量一次。 */
    function syncSide() {
      if (!chrome) return
      /* 量侧栏那一列：[data-slot] 槽位节点是 display: contents，量不出尺寸 */
      var col = q('[data-slot=root] ' + C('sidebarCol'))
      var r = col && col.getBoundingClientRect()
      var off = !r || r.width < 160 || r.height < 100 || getComputedStyle(col).visibility === 'hidden'
      chrome.classList.toggle('side-off', off)
      var bs = document.body.style
      /* logo 收成后中心在视口 y=67（顶 44 + 高 46 的一半）：收起按钮（28px）中心对上它，新会话在 logo 下方 18px */
      var row = q('[data-slot=sidebar] ' + C('logoRow'))
      if (row && !off) {
        var top = row.getBoundingClientRect().top
        bs.setProperty('--hos-logo-pad', Math.max(0, Math.round(67 - 14 - top)) + 'px')
        bs.setProperty('--hos-logo-h', Math.max(40, Math.round(44 + 46 + 18 - top)) + 'px')
      }
      /* 折叠后左上角是「展开侧栏 / 新会话」两个按钮：机框顶线从它们右边 10px 开始 */
      var lead = document.querySelectorAll('[data-slot="shell.leading"] button')
      var right = 0
      for (var i = 0; i < lead.length; i++) right = Math.max(right, lead[i].getBoundingClientRect().right)
      if (right) bs.setProperty('--hos-cut', Math.round(right + 10 - 26) + 'px')
      /* 输入框座位的底板按它在视口里的位置反向偏移，和整页底板逐像素对上 */
      var seat = q('[data-slot="main.conversation"] [data-content-phase=active] ' + C('composerSeat'))
      if (seat) {
        var sr = seat.getBoundingClientRect()
        bs.setProperty('--hos-seat-x', Math.round(-sr.left) + 'px')
        bs.setProperty('--hos-seat-y', Math.round(-(sr.top - 24)) + 'px')
      }
      if (frameEl && !frameAnim) frameCols = getComputedStyle(frameEl).gridTemplateColumns
    }

    /* ── 左右侧栏折叠动画 ───────────────────────────────────────────────
       DSH 收起 / 展开时直接改外框的 grid-template-columns（原生那条 0.3s 过渡没起作用，列宽是跳过去的）。
       这里在同一帧里接住新旧列宽，用 Web Animations 补一段过渡；拖动改宽不算收起，不动画。 */
    var frameEl = null, frameMO = null, frameAnim = null, frameCols = '', frameKey = '', toggleAt = -1e9
    function frameState(f) { return f.getAttribute('data-sidebar-collapsed') + '|' + f.getAttribute('data-rightbar-collapsed') }
    function lowMotion() { return S.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches }
    function watchFrame() {
      var f = q('[data-slot=root] > ' + C('frame'))
      if (!f || f === frameEl) return
      if (frameMO) frameMO.disconnect()
      frameEl = f; frameAnim = null
      frameCols = getComputedStyle(f).gridTemplateColumns; frameKey = frameState(f)
      frameMO = new MutationObserver(onFrameMutate)
      frameMO.observe(f, { attributes: true, attributeFilter: ['style', 'data-sidebar-collapsed', 'data-rightbar-collapsed'] })
    }
    /* logo 在覆盖层里，不在侧栏列里：折叠期间逐帧按侧栏右边缘算出要裁掉的宽度（换算回缩放前的本地坐标） */
    var brandRaf = 0
    function clipBrand() {
      cancelAnimationFrame(brandRaf); brandRaf = 0
      var brand = chrome && chrome.querySelector('.hos-brand'), col = q('[data-slot=root] ' + C('sidebarCol'))
      if (!brand || !col) return
      var r = brand.getBoundingClientRect(), w = brand.offsetWidth, edge = col.getBoundingClientRect().right
      var cut = r.width ? Math.min(w, Math.max(0, (r.right - edge) * w / r.width)) : 0
      document.body.style.setProperty('--hos-brand-clip', cut.toFixed(1) + 'px')
      if (frameAnim) brandRaf = requestAnimationFrame(clipBrand)
    }
    function onFrameMutate() {
      var f = frameEl, key = frameState(f)
      if (key !== frameKey) { frameKey = key; toggleAt = performance.now() }
      /* 上一段还在播时，起点取当下的动画值 */
      var from = frameAnim ? getComputedStyle(f).gridTemplateColumns : frameCols
      if (frameAnim) { frameAnim.onfinish = null; frameAnim.cancel(); frameAnim = null }
      var to = getComputedStyle(f).gridTemplateColumns
      frameCols = to
      if (to === from || performance.now() - toggleAt > 300 || lowMotion()) return
      var a = frameAnim = f.animate([{ gridTemplateColumns: from }, { gridTemplateColumns: to }], { duration: FOLD_MS, easing: FOLD_EASE })
      clipBrand()
      a.onfinish = function () {
        if (frameAnim !== a) return
        frameAnim = null
        clipBrand()
        /* DSH 等这条过渡结束才撤掉 data-animating */
        f.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'grid-template-columns' }))
      }
    }

    /* ── 与开机动画衔接 ─────────────────────────────────────────────────── */
    var phase = 'docked', dockTimer = 0, splashRoot = null, splashMO = null
    function setPhase(p) {
      phase = p
      document.body.setAttribute('data-hos-phase', p)
    }
    function dockReticle(el) {
      el = el || q('.hos-reticle')
      if (!el) return
      var r = el.getBoundingClientRect()
      if (!r.width) return
      /* 起点是启动页准星：视口 (50%, 45%)，边长 min(66vw, 94vh, 1180) */
      var big = Math.min(innerWidth * 0.66, innerHeight * 0.94, 1180)
      var dx = innerWidth * 0.5 - (r.left + r.width / 2), dy = innerHeight * 0.45 - (r.top + r.height / 2)
      el.classList.remove('docking')
      el.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(' + (big / r.width).toFixed(3) + ')'
      el.style.opacity = '0'
      void el.offsetWidth
      el.classList.add('docking')
      el.style.transform = ''
      el.style.opacity = ''
    }
    function assemble() {
      if (phase !== 'boot') return
      setPhase('assemble')
      ensure(); dockReticle()
      if (chrome) { var sc = chrome.querySelector('.hos-scan'); sc.classList.remove('go'); void sc.offsetWidth; sc.classList.add('go') }
      clearTimeout(dockTimer)
      dockTimer = setTimeout(function () { setPhase('docked') }, 1500)
    }
    function onSplashMutate() {
      if (!splashRoot) return
      if (!splashRoot.isConnected || /\bdsu-(handoff|gone)\b/.test(splashRoot.className)) assemble()
    }
    /* 启动页根节点可能在本插件之后才出现（桌面端由浏览器半侧自举），所以每次 ensure 都看一眼 */
    function watchSplash() {
      var r = document.getElementById('dsh-startup-root')
      if (!r || r === splashRoot) return
      if (window.__DSH_STARTUP_SKIP__ === true) return
      splashRoot = r
      if (phase === 'docked') setPhase('boot')
      if (splashMO) splashMO.disconnect()
      splashMO = new MutationObserver(onSplashMutate)
      splashMO.observe(r, { attributes: true, attributeFilter: ['class'] })
      if (chrome) chrome.querySelector('.rev').textContent = revText()
    }
    function onHandoff() { assemble() }
    function onDone() { if (phase === 'boot') assemble() }

    /* ── 启停 ───────────────────────────────────────────────────────────── */
    var bodyMO = null, timer = 0, started = false
    function applyAttrs() {
      var b = document.body
      b.setAttribute('data-hos', '')
      if (S.chassis) b.setAttribute('data-hos-chassis', ''); else b.removeAttribute('data-hos-chassis')
      if (S.reduceMotion) b.setAttribute('data-hos-motion', 'low'); else b.removeAttribute('data-hos-motion')
    }
    function start() {
      if (started || !S.enabled) return
      started = true
      injectCss()
      applyAttrs()
      buildChrome()
      setPhase('docked')
      watchSplash()
      ensure()
      window.addEventListener('resize', syncSide)
      bodyMO = new MutationObserver(schedule)
      bodyMO.observe(document.body, { childList: true, subtree: true })
      window.addEventListener('dsh-startup:handoff', onHandoff)
      window.addEventListener('dsh-startup:done', onDone)
      timer = setInterval(tick, 1000); tick()
    }
    function stop() {
      if (!started) return
      started = false
      clearInterval(timer); clearTimeout(dockTimer)
      if (raf) cancelAnimationFrame(raf); raf = 0
      if (bodyMO) bodyMO.disconnect(); bodyMO = null
      if (splashMO) splashMO.disconnect(); splashMO = null; splashRoot = null
      if (frameMO) frameMO.disconnect(); frameMO = null; frameEl = null
      if (frameAnim) frameAnim.cancel(); frameAnim = null
      cancelAnimationFrame(brandRaf); brandRaf = 0
      window.removeEventListener('resize', syncSide)
      window.removeEventListener('dsh-startup:handoff', onHandoff)
      window.removeEventListener('dsh-startup:done', onDone)
      if (styleTag) styleTag.remove(); styleTag = null
      if (chrome) chrome.remove(); chrome = null
      document.querySelectorAll('.hos-sys,.hos-hero-en,.hos-hero-rule,.hos-reticle,.hos-trace,.hos-guide-ret').forEach(function (n) { n.remove() })
      tracePaths = []
      ;['data-hos', 'data-hos-chassis', 'data-hos-motion', 'data-hos-phase'].forEach(function (a) { document.body.removeAttribute(a) })
      ;['--hos-logo-pad', '--hos-logo-h', '--hos-cut', '--hos-seat-x', '--hos-seat-y', '--hos-brand-clip'].forEach(function (v) { document.body.style.removeProperty(v) })
    }
    function update(next) {
      S = next
      writeSettings(S)
      if (!S.enabled) { stop(); return }
      if (!started) { start(); return }
      injectCss(); applyAttrs()
    }

    /* ── 设置分节「Harness OS」 ────────────────────────────────────────── */
    function Panel() {
      var h = react.createElement
      var st = react.useState(readSettings())
      var cur = st[0], setCur = st[1]
      function set(k, v) { var n = {}; for (var x in cur) n[x] = cur[x]; n[k] = v; setCur(n); update(n) }
      function sw(k, label) {
        return h('button', { type: 'button', className: 'sw', role: 'switch', 'aria-checked': String(!!cur[k]), 'aria-label': label, onClick: function () { set(k, !cur[k]) } })
      }
      function row(title, desc, ctrl) { return h('div', { className: 'row' }, h('div', null, h('b', null, title), desc ? h('small', null, desc) : null), ctrl) }
      return h('div', { className: 'hos-set' },
        h('div', { className: 'k' }, '皮肤 / SKIN'),
        row('启用 Harness OS', '关掉后回到 DSH 原生界面，不需要重启。', sw('enabled', '启用 Harness OS')),
        row('强调色', '阶段条、准星、运行状态只用这一种颜色。', h('div', { className: 'sws', role: 'radiogroup', 'aria-label': '强调色' },
          Object.keys(ACCENTS).map(function (k) {
            return h('button', { key: k, type: 'button', role: 'radio', 'aria-checked': String(cur.accent === k), 'aria-label': ACCENTS[k][3], title: ACCENTS[k][3], onClick: function () { set('accent', k) } }, h('i', { style: { background: ACCENTS[k][0] } }))
          }))),
        h('div', { className: 'k' }, '机框 / CHASSIS'),
        row('显示机框', '四周内缩 26px 的发丝框和定位角，与开机动画终幕同坐标。关掉后界面铺满窗口。', sw('chassis', '显示机框')),
        row('减弱动效', '关掉揭幕装配、准星旋转和信号轨迹的动画。系统开启「减少动态效果」时自动减弱。', sw('reduceMotion', '减弱动效')),
        h('div', { className: 'note' }, '配色跟随 DSH 的「外观」设置（浅色 / 深色 / 跟随系统）。开机动画由 dsh-startup-screen 插件提供，在「启动动画」一节设置。')
      )
    }

    /* ── 插件 ───────────────────────────────────────────────────────────── */
    exports.inject = ['slots']
    exports.apply = function (ctx) {
      if (document.body) start()
      else document.addEventListener('DOMContentLoaded', start, { once: true })
      if (ctx && typeof ctx.effect === 'function') ctx.effect(function () { return stop }, NS + ': cleanup')
      if (react && ctx && ctx.slots && typeof ctx.slots.inject === 'function') {
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register(
            { name: 'settings.section', id: 'harness-os', order: 25, label: 'Harness OS' },
            function () { return react.createElement(Panel, {}) }
          )
        })
      }
    }
    return module.exports
  }
})
