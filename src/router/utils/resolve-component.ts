/**
 * 动态路由组件路径解析（纯函数，便于单测）。
 *
 * 后端下发的 `component` 是「src/views 下的路径片段」（如 `settings/message`、
 * `settings/security/index`、`/src/views/xxx.vue`），也可能缺失（此时用 `path` 兜底）。
 * 二开页面经 `src/extensions/<module>` 约定登记，片段可为 `extensions/<module>/<page>`
 * 或 `/src/extensions/<module>/<page>.vue`。
 *
 * 关键约束：必须**精确优先**。历史实现直接 `keys.findIndex(k => k.includes(component))`
 * 取首个命中，一旦页面目录下新增其它文件（如 `settings/message/components/Xxx.vue`
 * 排序在 `index.vue` 之前）就会劫持整页渲染——消息设置页曾因此渲染成消息模板
 * 子组件（页签与表单全部消失，且无任何报错）。
 */
export function resolveComponentKey(
  target: string | undefined,
  keys: string[],
  isDirectory = false
): number {
  // 目录节点（含子路由）自身不渲染页面：交给 redirect 与拍平后的子记录，
  // 否则空 component 会退化为 path，被下方子串兜底误绑到某个子页面。
  if (!target || isDirectory) return -1;
  const normalized = target.replace(/^@\//, "").replace(/^\/+/, "");
  const base = target.startsWith("/src/")
    ? target
    : normalized.startsWith("extensions/")
      ? `/src/${normalized}`
      : `/src/views/${normalized}`;
  const candidates = [
    base,
    `${base}.vue`,
    `${base}.tsx`,
    `${base}/index.vue`,
    `${base}/index.tsx`
  ];
  for (const candidate of candidates) {
    const index = keys.indexOf(candidate);
    if (index !== -1) return index;
  }
  // 二开片段历史写法兼容：给 `views/<x>` / `extensions/<x>` 两种前缀各试一次
  const alternative = normalized.startsWith("extensions/")
    ? `/src/views/${normalized.slice("extensions/".length)}`
    : `/src/extensions/${normalized}`;
  for (const candidate of [
    alternative,
    `${alternative}.vue`,
    `${alternative}.tsx`,
    `${alternative}/index.vue`,
    `${alternative}/index.tsx`
  ]) {
    const index = keys.indexOf(candidate);
    if (index !== -1) return index;
  }
  // 历史宽松口径兜底：路径片段包含匹配（兼容「后端片段与文件路径非严格前缀」
  // 的既有写法，如 `views/system/user` 对应 `/src/views/system/user/index.vue`）
  const matches = keys.filter(key => key.includes(target));
  if (matches.length > 1) {
    // 多候选时按顺序取第一个仍可能绑错页（如 system/user ↔ system/user-role）：
    // 至少留下可定位告警，避免静默绑定到名字相近的错误页面
    console.warn(
      `[xadmin] 组件路径 ${target} 命中多个候选：${matches.join(" / ")}，将使用第一个`
    );
  }
  return matches.length ? keys.indexOf(matches[0]) : -1;
}
