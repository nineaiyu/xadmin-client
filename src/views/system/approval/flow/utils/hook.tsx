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
import Edit from "~icons/ep/edit-pen";
import Plus from "~icons/ep/plus";

type FlowRow = {
  pk: string;
  name: string;
  code: string;
  is_active: boolean;
};

/**
 * 流程定义页装配：列表用 RePlusPage 标准 CRUD，新增/编辑走自定义「配置抽屉」
 * （基本信息 + 表单字段 + 节点列表整体编辑，ADR-012 一期不做拖拽画布）。
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
    options.props = {
      flow: row?.pk ? row : null,
      onSaved: () => tableRef.value?.handleGetData(),
      onClose: () => closeDrawer(options, 0)
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

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 3,
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
