import { computed, watch } from "vue";
import { roleApi } from "@/api/identity/role";
import { defineListPage } from "@/components/RePlusPage";
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
export function useRole() {
  const page = defineListPage({
    api: roleApi,
    localeName: "systemRole",
    extraAuth: ["preview"]
  });
  const { api, auth, tableRef, t } = page;

  // 授权树数据源：菜单全量缓存 + 模型字段合成节点注入
  const { menuTreeData, menuDenied, menuError, fieldError } = useRoleMenuTree();

  // 编辑回显依赖 retrieve：列表行的 menu 恒为空（列表口径不带授权），
  // 缺 retrieve 的角色打开编辑会看到空树，保存即清空该角色全部菜单授权（数据损坏）。
  // 与授权树不可用同口径禁用编辑；新增不依赖回显，不受影响。
  // 能力位先快照：门控会就地关闭 auth.update/partialUpdate，若直接用 auth 计算，
  // 关闭后 editNeedsRetrieve 立即变 false，警告条也随之消失（用户只看到按钮没了）。
  const canEditByPermission = Boolean(auth.partialUpdate || auth.update);
  const canRetrieve = Boolean(auth.retrieve);
  const editNeedsRetrieve = computed(() => canEditByPermission && !canRetrieve);

  watch(
    editNeedsRetrieve,
    value => {
      if (!value) return;
      auth.update = false;
      // 编辑按钮的显示条件是 (partialUpdate || update)：只关 update 仍会露出口子
      auth.partialUpdate = false;
    },
    { immediate: true }
  );

  // 授权树不可用（缺 list:SystemMenu 或菜单列表加载失败）时禁用新增/编辑：
  // 空树上保存会清空角色授权，比「不能编辑」危险得多
  const menuAlert = computed(() => {
    if (menuDenied.value) return t("systemRole.menuTreeDenied");
    if (menuError.value) return t("systemRole.menuTreeLoadFailed");
    if (fieldError.value) return t("systemRole.fieldTreeLoadFailed");
    if (editNeedsRetrieve.value) return t("systemRole.editRetrieveDenied");
    return "";
  });

  watch(
    menuAlert,
    value => {
      if (!value) return;
      // 菜单/字段元数据不可用时禁止新增与编辑：空树上保存会清空角色授权，
      // 字段树缺失时保存会清空字段白名单，均比「不能编辑」危险得多。
      if (menuDenied.value || menuError.value) auth.create = false;
      auth.update = false;
      // 编辑按钮的显示条件是 (partialUpdate || update)：只关 update 仍会露出口子
      auth.partialUpdate = false;
    },
    { immediate: true }
  );

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
    ...page,
    addOrEditOptions,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps,
    menuAlert
  };
}
