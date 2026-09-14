/**
 * 角色权限树合成键约定（`utils/hook.tsx` 构树 ↔ `components/RoleForm.vue` 解析
 * 的单一事实源）。
 *
 * 角色授权树在真实菜单节点（pk 为 UUID，不含 "+"）下注入两类合成节点：
 * - 字段叶子键 `{menuPk}+{fieldPk}`：某菜单下可勾选的模型字段；
 * - 字段分组键 `+{fieldPk}`：fieldLookups 树根注入的分组节点，仅作展示。
 *
 * 勾选结果按此约定反解（formatMenuFields）：无 "+" → 菜单授权；
 * `a+b` → 菜单 a 勾选字段 b（按菜单分组合并进 role.fields）；`+x` 不计入授权。
 * 修改键格式属破坏性变更：需同步 form.vue 的勾选回显（setCheckedKeys）与
 * 后端 role.fields 的读取口径，并回归角色授权 E2E。
 */

/** 是否为合成键（含 "+"，即非真实菜单 pk） */
export function isSyntheticKey(key: string): boolean {
  return key.includes("+");
}

/** 是否为字段叶子键（`a+b`；分组键 `+x` 与真实菜单 pk 除外） */
export function isMenuFieldKey(key: string): boolean {
  return isSyntheticKey(key) && !key.startsWith("+");
}

/** 反解字段叶子键为 [menuPk, fieldPk]；非字段叶子键返回 null */
export function parseMenuFieldKey(key: string): [string, string] | null {
  if (!isMenuFieldKey(key)) return null;
  const index = key.indexOf("+");
  return [key.slice(0, index), key.slice(index + 1)];
}

/** 字段分组键：`+{fieldPk}` */
export function fieldGroupKey(fieldPk: string): string {
  return `+${fieldPk}`;
}

/** 字段叶子键：`{menuPk}+{fieldPk}` */
export function menuFieldKey(menuPk: string, fieldPk: string): string {
  return `${menuPk}+${fieldPk}`;
}
