// dsh-harness-os — 宿主半边。
//
// 皮肤全部在浏览器端（client.js）。这里只保证 loader entry 是「活的」：
// client-modules 只把活的 entry 编进 window.__DSH_BOOT__，host 进程也能安全导入本包。
export const name = 'dsh-harness-os'

export function apply() {
  /* 纯前端皮肤，宿主无逻辑。 */
}
