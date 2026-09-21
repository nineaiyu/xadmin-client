import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { approvalFlowApi } from "@/api/system/approvalFlow";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import FlowConfigDrawer from "../components/FlowConfigDrawer.vue";
import FlowVersions from "../components/FlowVersions.vue";
import Edit from "~icons/ep/edit-pen";
import Plus from "~icons/ep/plus";
import Clock from "~icons/ep/clock";

type FlowRow = {
  pk: string;
  name: string;
  code: string;
  is_active: boolean;
};

/**
 * 流程定义页装配：列表用 RePlusPage 标准 CRUD，新增/编辑走自定义「配置抽屉」
 * （基本信息 + 表单字段 + 节点列表整体编辑，一期不做拖拽画布）。
 *
 * 内置的 create/update 入口被显式关闭（auth 覆盖），避免"标准表单 + 配置抽屉"
 * 两套编辑口径并存；删除/详情仍走标准入口（后端对在途实例有保护）。
 */
export function useFlow(tableRef: Ref) {
  const { t } = useI18n();
  const baseAuth = getDefaultAuths("SystemApprovalFlow");
  const auth = reactive({
    ...baseAuth,
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:SystemApprovalFlow");
  const canUpdate =
    hasAuth("partialUpdate:SystemApprovalFlow") ||
    hasAuth("update:SystemApprovalFlow");
  // 版本历史与回滚是独立权限点（versions/rollback），与编辑权限互不蕴含：
  // 用编辑权限判断会让只有 partialUpdate 的角色点开抽屉后回滚 403
  const canViewVersions = hasAuth("versions:SystemApprovalFlow");
  const api = reactive(approvalFlowApi);

  const openConfig = (row?: Partial<FlowRow> | null) => {
    const options: DrawerOptions = {
      title: row?.pk
        ? `${t("systemApprovalFlow.editTitle")} - ${row.name}`
        : t("systemApprovalFlow.createTitle"),
      size: "60%",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: {},
      contentRenderer: () => h(FlowConfigDrawer)
    };
    // 关闭不走 props（ReDrawer 会把 props 里的 onClose 与模板 @close 合并成数组），
    // 配置抽屉内部 emit("close")，由 ReDrawer 的 @close 统一关闭
    options.props = {
      flow: row?.pk ? row : null,
      onSaved: () => tableRef.value?.handleGetData()
    };
    addDrawer(options);
  };

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

  /** 版本历史抽屉：快照列表 + 回滚动作 */
  const openVersions = (row: FlowRow) => {
    const options: DrawerOptions = {
      title: `${t("systemApprovalFlow.versionsTitle")} - ${row.name}`,
      size: "40%",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: {},
      contentRenderer: () =>
        h(FlowVersions, {
          flowPk: row.pk,
          onRollback: () => {
            closeDrawer(options, 0);
            tableRef.value?.handleGetData();
          }
        })
    };
    addDrawer(options);
  };

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
        show: canUpdate && 50
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
        show: canViewVersions && 40
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
