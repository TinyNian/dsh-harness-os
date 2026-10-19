# Fork 说明

这个目录是 [QIFANAI/dsh-startup-screen](https://github.com/QIFANAI/dsh-startup-screen) 的 fork，
随 [dsh-harness-os](../../README.md) 一起维护，让开机动画和 Harness OS 主界面无缝衔接。

| 项 | 值 |
|---|---|
| 上游仓库 | https://github.com/QIFANAI/dsh-startup-screen |
| fork 基线 | `8499f9df21c6cb27bef8ed7bb1ba29da654fc795`（v1.6.0，2026-10-17） |
| 原始作者 | 沈宏宏（dsh-startup-screen 1.1.0，MIT） |
| 上游维护 | dsh-startup-screen contributors |
| 本 fork 版本 | `1.6.0-hos.1` |
| 许可 | MIT，原版权声明原样保留，见 [LICENSE](LICENSE) |

上游 `package/` 目录原样搬进这里；上游根目录的 `CHANGELOG.md`、`THIRD-PARTY-NOTICES.md`
和 `docs/` 下的工程记录一并带上。包名仍是 `dsh-startup-screen`，装上会替换上游同名插件。

## 相对上游的改动

| 文件 | 改动 | 原因 |
|---|---|---|
| `lib/splash.js` | 揭幕（`dsu-handoff`）那一刻派发 `window` 事件 `dsh-startup:handoff` | 上游只在完全淡出后派发 `dsh-startup:done`，晚了约 900ms；主界面要在镜头后撤的同一刻开始装配 |
| `package.json` | 版本号、仓库地址、contributors | 标明 fork 来源 |
| `lib/client.js` | 兜底版本常量 `FALLBACK_VERSION` 改成 `1.6.0-hos.1` | 与 package.json 保持一致（上游有测试防两处漂移） |
| `FORK.md` | 新增 | 本文件 |

其余文件与上游一致。上游的 352 项冒烟测试在本 fork 上全部通过（`npm test`）。

## 素材

和上游一样，不附带原片台词、原片音效与商业 BGM，只保留上游作者自录的终幕欢迎语 `lib/assets/line-6.mp3`。
版权边界见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
