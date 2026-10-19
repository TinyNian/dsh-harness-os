// 冒烟测试：按 ModuleLoader 的方式加载 client.js，确认能注册、导出 apply / inject，
// 并在最小 DOM 桩上跑一遍 apply → effect 清理，不抛错、能还原。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m) } else { fail++; console.log('  FAIL', m) } }

/* 最小 DOM 桩：只实现插件会碰到的那几样 */
function el(tag) {
  const node = {
    tagName: tag.toUpperCase(), children: [], attrs: {}, style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    isConnected: true, className: '', textContent: '',
    appendChild(c) { this.children.push(c); c.parentNode = this; return c },
    insertBefore(c) { this.children.unshift(c); c.parentNode = this; return c },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this) },
    setAttribute(k, v) { this.attrs[k] = String(v) }, getAttribute(k) { return this.attrs[k] ?? null },
    hasAttribute(k) { return k in this.attrs }, removeAttribute(k) { delete this.attrs[k] },
    querySelector(sel) { return sel === '.rev' || sel === '.hos-meta .clk' || sel === '.hos-scan' ? el('span') : null },
    querySelectorAll() { return [] }, addEventListener() {}, getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }),
    set innerHTML(v) { this._html = v }, get innerHTML() { return this._html || '' }
  }
  return node
}
const head = el('head'), body = el('body'), html = el('html')
globalThis.document = {
  head, body, documentElement: html, readyState: 'complete',
  createElement: el, createElementNS: (_, t) => el(t),
  querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}
}
globalThis.MutationObserver = class { observe() {} disconnect() {} }
globalThis.requestAnimationFrame = () => 1
globalThis.cancelAnimationFrame = () => {}
globalThis.localStorage = { getItem: () => null, setItem() {} }
globalThis.innerWidth = 1440; globalThis.innerHeight = 900

let mod = null
globalThis.window = globalThis
window.addEventListener = () => {}
window.removeEventListener = () => {}
window.__ModuleLoader__ = { load(def) { ok(def.id === 'dsh-harness-os', 'loader id 等于包名'); mod = def.factory(name => { if (name === 'react') return { createElement() {}, useState: v => [v, () => {}] }; throw new Error(name) }) } }
new Function(src)()
ok(mod && typeof mod.apply === 'function', '导出 apply')
ok(mod && Array.isArray(mod.inject) && mod.inject.includes('slots'), 'inject 包含 slots')

let cleanup = null, section = null
mod.apply({ effect: fn => { cleanup = fn() }, slots: { inject: (n, fn) => { section = n; fn() }, register: () => () => {} } })
ok(body.hasAttribute('data-hos'), 'apply 后 body 带 data-hos')
ok(body.getAttribute('data-hos-phase') === 'docked', '没有开机动画时直接 docked')
ok(head.children.some(c => c.dataset.pluginCss === 'dsh-harness-os/main.css' && c.textContent.length > 5000), '注入了样式表')
ok(section === 'settings.section', '注册设置分节')
const css = head.children.find(c => c.dataset.pluginCss === 'dsh-harness-os/main.css').textContent
let depth = 0, bad = false
for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) bad = true } }
ok(!bad && depth === 0, '样式表花括号配平')
ok(css.includes('--dsw-alias-bg-base') && css.includes('[data-ds-dark-theme]'), '覆盖主题变量（含暗色）')
cleanup && cleanup()
ok(!body.hasAttribute('data-hos') && !body.hasAttribute('data-hos-phase'), 'effect 清理后还原 body 属性')

console.log(`\n  通过 ${pass} / 失败 ${fail}`)
process.exit(fail ? 1 : 0)
