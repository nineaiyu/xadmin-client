/**
 * `process` 全局垫片（原为 index.html 内联脚本，2026-09-18 抽出）。
 *
 * 部分依赖在运行期读取 `process.env.*`（构建产物体量统计显示 version-rocket 等
 * 仍带 process 引用），缺失会抛 ReferenceError；此处提供空对象兜底。
 *
 * 抽出原因：页面层 CSP 切强制后 `script-src 'self'` 会拦截内联脚本
 * （xadmin-web/default.conf 的 CSP 头），改由同源静态文件加载即可通过。
 */
window.process = {};
