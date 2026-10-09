import { reactive, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { roleApi } from "@/api/system/role";
import { usePageAuth } from "@/router/utils";
import { useRoleButtons } from "./useRoleButtons";
import { useRoleColumns } from "./useRoleColumns";
import { useRoleFormOptions } from "./useRoleFormOptions";
import { useRoleMenuTree } from "./useRoleMenuTree";
import { openRolePreview } from "./rolePreview";

/**
 * 角色列表页装配：
 * - useRoleMenuTree     菜单全量缓存 + 模型字段合成节点（授权树数据源）；
 * - useRoleFormOptions  新增/编辑弹层（授权树，值归一化见 roleFormValues.ts）；
 * - useRoleColumns      「用户数」关联计数列（跳转用户列表）；
 * - useRoleButtons      工具栏批量更新与行操作权限预览。
 */
export function useRole(pageRef?: Ref) {
  const { t } = useI18n();
  const api = reactive(roleApi);
  // 批量更新需要读取勾选行：页面传入 RePlusPage ref（缺省自带一个，供独立使用）
  const tableRef = pageRef ?? ref();

  const auth = usePageAuth(["preview"]);

  // 授权树数据源：菜单全量缓存 + 模型字段合成节点注入
  const { menuTreeData } = useRoleMenuTree();

  // 新增/编辑弹层：授权树（field/menu/fields 归一化见 roleFormValues.ts，纯函数可单测直测）
  const { addOrEditOptions } = useRoleFormOptions({ api, auth, menuTreeData });

  const { listColumnsFormat } = useRoleColumns();

  const { tableBarButtonsProps, operationButtonsProps } = useRoleButtons({
    t,
    api,
    tableRef,
    canPreview: auth.preview,
    openPreview: row => openRolePreview({ t, row })
  });

  return {
    api,
    auth,
    tableRef,
    addOrEditOptions,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
