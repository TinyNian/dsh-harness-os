# dsh-harness-os

DeepSeek Harness 主界面皮肤「Harness OS」。沿用 [dsh-startup-screen](../dsh-startup-screen) 开机动画的技术档案版式，
开机动画揭幕时原地接住常驻件，其余部件按同一节奏装配。纯客户端插件，不改 DSH 源码、不注册工具或服务。

安装、截图和兼容性说明见[仓库首页](../../README.md)。

## 工作方式

| 层 | 做什么 |
|---|---|
| 主题变量 | 在 `body[data-hos]` 上覆盖 `--dsw-alias-*`，暗色走 `body[data-hos][data-ds-dark-theme]` |
| 组件样式 | 用 `data-slot` 和 CSS Modules 语义类名定位（`C('newSession')` 同时兼容 `hash_name` 与 `_name_hash` 两种格式） |
| 覆盖层 `#hos-chrome` | 不接收点击的 fixed 层：机框、品牌块、开机读数、页脚，坐标与开机动画终幕一致 |
| 注入件 | 侧栏底部状态、空会话页英文副标与准星、信号轨迹、右栏引导页罗盘；节流的 MutationObserver 缺了就补 |

衔接的三个阶段写在 `body[data-hos-phase]`：`boot`（开机动画在场）→ `assemble`（收到 `dsh-startup:handoff`，
上游版本退回观察 `dsu-handoff`）→ `docked`（约 1.5 秒后）。没有开机动画时直接 `docked`。

## 设置

设置页「Harness OS」一节，数据存在 localStorage `dsh-harness-os:settings`：

```json
{ "enabled": true, "accent": "orange", "chassis": true, "reduceMotion": false }
```

`accent` 可选 `orange` / `red` / `blue`。关掉 `enabled` 立即还原 DSH 原生界面。

## 测试

```bash
node test/smoke.mjs
```
