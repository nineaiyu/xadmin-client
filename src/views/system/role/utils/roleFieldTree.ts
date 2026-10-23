import { cloneDeep } from "@pureadmin/utils";
import {
  fieldGroupKey,
  menuFieldKey
} from "@/components/ReMenuPermissionTree/utils/treeKeys";
import type { PermissionTreeNode } from "@/components/ReMenuPermissionTree/utils/permissionTree";
import type { RecordType } from "plus-pro-components";

/**
 * 在绑定了模型的叶子菜单下注入字段权限分组节点。
 *
 * 分组键 `+{fieldPk}`，其子节点为字段叶子键 `{menuPk}+{fieldPk}`
 * （分组仅作展示，字段叶子才计入 role.fields，见 ./treeKeys.ts）。
 * 原地修改并返回同一棵树；`fieldLookups` 为字段注册表（按模型字段 pk 索引）。
 */
export function injectFieldNodes(
  arr: PermissionTreeNode[],
  fieldLookups: Record<string | number, RecordType>
): PermissionTreeNode[] {
  arr.forEach(item => {
    if (item.model && item.model.length > 0 && !item.children) {
      const children: PermissionTreeNode[] = [];
      item.children = children;
      item.model.forEach(m => {
        const mPk =
          typeof m === "object" && m !== null
            ? (m as { pk?: string | number }).pk
            : m;
        const data = cloneDeep(
          fieldLookups[mPk as string]
        ) as PermissionTreeNode;
        if (!data) return;
        data.pk = fieldGroupKey(String(data.pk));
        data.children?.forEach(child => {
          child.pk = menuFieldKey(String(item.pk), String(child.pk));
          child.parent = data.pk;
        });
        children.push(data);
      });
      if (children.length) item.children = children;
    }
    if (item.children) injectFieldNodes(item.children, fieldLookups);
  });
  return arr;
}
