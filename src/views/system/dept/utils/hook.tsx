import { deptApi } from "@/api/identity/dept";
import { shallowRef } from "vue";
import { hasAuth } from "@/router/utils";
import { defineListPage, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Setting from "~icons/ri/settings-3-line";
import { useDeptRoleRules } from "./useDeptRoleRules";
import { useDeptManagers } from "./useDeptManagers";
import { useActiveBatchUpdate } from "@/views/system/components/useActiveBatchUpdate";
import { useDeptColumns } from "./deptColumns";
import { useDeptFormOptions } from "./deptFormOptions";
import { useDeptPanel } from "./useDeptPanel";

/**
 * 部门管理页面装配。
 *
 * 子模块：deptColumns（列渲染与人数跳转）/ deptFormOptions（新增编辑表单选项）/
 * useDeptPanel（行内「管理」抽屉）；角色授权与管理员任命见 useDeptRoleRules /
 * useDeptManagers，批量更新见 useBatchUpdate（自 utils/hook 拆出，行为不变）。
 */
export function useDept() {
  const { listColumnsFormat, onGoDetail } = useDeptColumns();

  const page = defineListPage({
    api: deptApi,
    localeName: "systemDept",
    extraAuth: ["empower", "preview", "assignManagers", "changeHistory"],
    columns: ({ columns }) => listColumnsFormat(columns),
    formOptions: ({ tableRef }) => useDeptFormOptions(tableRef)
  });

  const { api, auth, tableRef, t } = page;

  // 角色授权与管理员任命弹层（列裁剪状态 + 弹窗动作）
  const { baseColumnsFormat, handleRoleRules } = useDeptRoleRules({
    t,
    api,
    tableRef
  });
  const { openManagers } = useDeptManagers({ t, api, tableRef });

  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useActiveBatchUpdate({
    t,
    api,
    tableRef,
    canBatch: hasAuth("batchUpdate:SystemDept")
  });
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [batchUpdateButton]
  });

  const { openDeptPanel } = useDeptPanel({
    api,
    auth,
    handleRoleRules,
    openManagers,
    onGoDetail
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    // 列宽与「编辑/删除/管理」三个按钮的实际占用一致（表格固定列对齐按此收敛）
    width: 260,
    // 默认「查看 / 变更历史」入口收敛进抽屉，操作列保持三个动作
    hideDetail: true,
    hideChangeHistory: true,
    buttons: [
      {
        text: t("systemDept.manage"),
        code: "manage",
        props: {
          type: "primary",
          icon: useRenderIcon(Setting),
          link: true
        },
        onClick: ({ row }) => {
          openDeptPanel(row);
        },
        // 面板内容受各自权限点控制；无任何可看内容时不渲染入口（避免点开空抽屉）。
        // 授权角色 / 部门管理员同样属于面板内容：只看预览与成员会把「只有授权权」的管理员挡在门外
        show:
          hasAuth("preview:SystemDept") ||
          hasAuth("list:SystemUser") ||
          hasAuth("empower:SystemDept") ||
          hasAuth("assignManagers:SystemDept")
      }
    ]
  });

  return {
    ...page,
    baseColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps,
    openDeptPanel
  };
}
