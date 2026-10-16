import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { approvalFlowApi } from "@/api/approval/approvalFlow";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useFlowDrawers, type FlowRow } from "./useFlowDrawers";
import Edit from "~icons/ep/edit-pen";
import Plus from "~icons/ep/plus";
import Clock from "~icons/ep/clock";

/**
 * 流程定义页装配：列表用 RePlusPage 标准 CRUD，新增/编辑走自定义「配置抽屉」
 * （基本信息 + 表单字段 + 节点列表整体编辑，一期不做拖拽画布；见 useFlowDrawers）。
 *
 * 内置的 create/update 入口被显式关闭（auth 覆盖），避免"标准表单 + 配置抽屉"
 * 两套编辑口径并存；删除/详情仍走标准入口（有历史实例的流程禁止删除，与在途与否无关）。
 */
export function useFlow(tableRef: Ref) {
  const { t } = useI18n();
  const auth = usePageAuth("SystemApprovalFlow");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:SystemApprovalFlow");
  const canUpdate =
    hasAuth("partialUpdate:SystemApprovalFlow") ||
    hasAuth("update:SystemApprovalFlow");
  // 版本历史与回滚是独立权限点（versions/rollback），与编辑权限互不蕴含：
  // 用编辑权限判断会让只有 partialUpdate 的角色点开抽屉后回滚 403
  const canViewVersions = hasAuth("versions:SystemApprovalFlow");
  const api = reactive(approvalFlowApi);

  const { openConfig, openVersions } = useFlowDrawers({ tableRef });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemApprovalFlow.createTitle"),
        code: "createConfig",
        props: {
          type: "primary",
          icon: useRenderIcon(Plus)
        },
        onClick: () => openConfig(null),
        show: canCreate
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 300,
    buttons: [
      {
        text: t("systemApprovalFlow.editTitle"),
        code: "editConfig",
        props: {
          type: "primary",
          icon: useRenderIcon(Edit),
          link: true
        },
        onClick: ({ row }) => openConfig(row),
        index: 50,
        show: canUpdate
      },
      {
        text: t("systemApprovalFlow.versionsTitle"),
        code: "versions",
        props: {
          type: "info",
          icon: useRenderIcon(Clock),
          link: true
        },
        onClick: ({ row }) => openVersions(row as FlowRow),
        index: 40,
        show: canViewVersions
      }
    ]
  });

  return {
    api,
    auth,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
