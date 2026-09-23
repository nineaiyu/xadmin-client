/**
 * 动态路由组件路径解析（纯函数，便于单测）。
 *
 * 后端下发的 `component` 是「src/views 下的路径片段」（如 `settings/message`、
 * `settings/security/index`、`/src/views/xxx.vue`），也可能缺失（此时用 `path` 兜底）。
 *
 * 关键约束：必须**精确优先**。历史实现直接 `keys.findIndex(k => k.includes(component))`
 * 取首个命中，一旦页面目录下新增其它文件（如 `settings/message/components/Xxx.vue`
 * 排序在 `index.vue` 之前）就会劫持整页渲染——消息设置页曾因此渲染成消息模板
 * 子组件（页签与表单全部消失，且无任何报错）。
 */
export function resolveComponentKey(
  target: string | undefined,
  keys: string[]
): number {
  if (!target) return -1;
  const base = target.startsWith("/src/views")
    ? target
    : `/src/views/${target.replace(/^\/+/, "")}`;
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
  // 历史宽松口径兜底：路径片段包含匹配（兼容「后端片段与文件路径非严格前缀」
  // 的既有写法，如 `views/system/user` 对应 `/src/views/system/user/index.vue`）
  return keys.findIndex(key => key.includes(target));
}
