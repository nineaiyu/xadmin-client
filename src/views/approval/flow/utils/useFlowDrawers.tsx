import { h } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { approvalFlowApi } from "@/api/approval/approvalFlow";
import FlowConfigDrawer from "../components/FlowConfigDrawer.vue";
import FlowVersions from "../components/FlowVersions.vue";

export type FlowRow = {
  pk: string;
  name: string;
  code: string;
  is_active: boolean;
};

/**
 * 流程定义页抽屉（自 hook.tsx 抽出，行数门禁）：配置抽屉（基本信息 + 表单字段 +
 * 节点列表整体编辑，一期不做拖拽画布）与版本历史抽屉（快照列表 + 回滚动作）。
 */
export function useFlowDrawers({ tableRef }: { tableRef: Ref }) {
  const { t } = useI18n();

  const openConfig = async (row?: Partial<FlowRow> | null) => {
    // 列表行不带 nodes/form_schema（列表载荷裁剪），编辑前先取全量定义；
    // 取不到（网络/权限）直接中止：打开一个空节点编辑器再保存会覆盖线上定义
    let flow: Partial<FlowRow> | null = null;
    if (row?.pk) {
      try {
        const res = await approvalFlowApi.retrieve(row.pk);
        if (res.code !== SUCCESS_CODE || !res.data) {
          message(String(res.detail || t("results.failed")), { type: "error" });
          return;
        }
        flow = res.data as Partial<FlowRow>;
      } catch {
        // HTTP 层错误提示由拦截器统一处理
        return;
      }
      flow = { ...row, ...flow };
    }
    const options: DrawerOptions = {
      title: flow?.pk
        ? `${t("systemApprovalFlow.editTitle")} - ${flow.name}`
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
      flow,
      onSaved: () => tableRef.value?.handleGetData()
    };
    addDrawer(options);
  };

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

  return { openConfig, openVersions };
}
