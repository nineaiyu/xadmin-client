import { computed, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { accountRiskApi } from "@/api/system/security";
import { usePageAuth } from "@/router/utils";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Search from "~icons/ep/search";
import Edit from "~icons/ep/edit";
import { normalizeError } from "@/utils/apiError";
import { useRiskStats } from "./useRiskStats";
import { useRiskDialogs } from "./useRiskDialogs";
import { useRiskDetail } from "./useRiskDetail";
import { useRiskColumns } from "./useRiskColumns";

// 展示常量与纯函数已下沉 ./display；此处再导出保持既有导入面（单测直接自 ./hook 导入）
export { metricEntriesOf, metricText } from "./display";

/**
 * 账号安全风险清单页面装配。
 *
 * 子模块：useRiskStats（统计面板）/ useRiskDialogs（处置弹窗）/
 * useRiskDetail（详情抽屉）/ useRiskColumns（列渲染）；
 * 本模块只做装配与工具栏按钮。
 */
export function useAccountRisk(tableRef: Ref, selectedRows: Ref<RecordType[]>) {
  const { t } = useI18n();

  const api = reactive(accountRiskApi);
  const auth = usePageAuth(["scan", "handle", "batchHandle", "stats"]);

  const { statsGroups, refreshStats } = useRiskStats({ api, auth });
  const { handleDialog } = useRiskDialogs({
    api,
    tableRef,
    onHandled: refreshStats
  });
  const { openDetail } = useRiskDetail();
  const { listColumnsFormat } = useRiskColumns();
  refreshStats();

  /** 同步巡检：后端为同步调用（大库扫描耗时明显），按钮置 loading 防重复触发 */
  const scan = (loading?: { value: boolean }) => {
    if (loading) loading.value = true;
    handleOperation({
      t,
      apiReq: api.scan().catch(normalizeError),
      success() {
        tableRef.value?.handleGetData?.();
        refreshStats();
      },
      requestEnd() {
        if (loading) loading.value = false;
      }
    });
  };

  /** 批量处置按钮显隐：由 selection-change 驱动的响应式选中态决定（点击时仍以
   * getSelectPks 实时取 pk，两处口径一致）；每行渲染回调查询选中数会随表格
   * 重渲染反复执行，收敛为 computed 后只在选择变化时重算 */
  const canBatchHandle = computed(() =>
    Boolean(auth.batchHandle && selectedRows.value.length)
  );

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("accountRisk.scan"),
        code: "scan",
        props: { type: "primary", icon: useRenderIcon(Search) },
        onClick: ({ loading }) => scan(loading),
        show: auth.scan
      },
      {
        text: t("accountRisk.batchHandle"),
        code: "batchHandle",
        props: { type: "warning", plain: true, icon: useRenderIcon(Edit) },
        onClick: () => {
          const pks = tableRef.value?.getSelectPks?.() ?? [];
          if (!pks.length) return;
          handleDialog(pks);
        },
        show: canBatchHandle
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 180,
    buttons: [
      {
        text: t("accountRisk.detail"),
        code: "detail",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDetail(row),
        show: true
      },
      {
        text: t("accountRisk.handle"),
        code: "handle",
        props: { type: "warning", link: true },
        onClick: ({ row }) => handleDialog([row.pk]),
        show: auth.handle
      }
    ]
  });

  return {
    api,
    auth,
    statsGroups,
    tableBarButtonsProps,
    operationButtonsProps,
    listColumnsFormat
  };
}
