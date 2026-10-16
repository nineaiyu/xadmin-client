/**
 * 角色表单行值归一化（纯函数，自 useRole 抽出便于单测直测）。
 *
 * 列表行 field 为 []（ListRoleSerializer 口径）；编辑态会叠加详情原文，
 * 详情口径是 {menuPk: [fieldPk]} 字典。授权树勾选回显（MenuPermissionTree
 * 的 setCheckedKeys）要的是合成键数组，这里统一归一化（键约定见 ./treeKeys.ts）。
 */

import { menuFieldKey } from "./treeKeys";

export function roleFieldFormValue(field: unknown): Array<string | number> {
  if (Array.isArray(field)) {
    return field;
  }
  if (field && typeof field === "object") {
    const dict = field as Record<string, unknown>;
    return Object.keys(dict).flatMap(menuPk =>
      ((dict[menuPk] ?? []) as Array<string | number>).map(fieldPk =>
        menuFieldKey(menuPk, String(fieldPk))
      )
    );
  }
  return [];
}
