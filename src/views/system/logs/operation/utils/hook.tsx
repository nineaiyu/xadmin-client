import { onMounted, reactive, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { operationLogApi } from "@/api/audit/logs/operation";
import { usePageAuth } from "@/router/utils";
import { useOperationLogColumns } from "./operationLogColumns";
import { fetchOperationLogDetail } from "./operationLogDetail";
import type { OperationProps } from "@/components/RePlusPage";

/**
 * 操作日志：列渲染见 operationLogColumns.tsx（列表列与详情抽屉列），
 * 详情全量兜底见 operationLogDetail.ts。
 */
export function useOperationLog() {
  const { t } = useI18n();
  const api = reactive(operationLogApi);

  /** 慢请求标红阈值：优先后端自持阈值端点（与操作日志列表同权限，
   *  无监控权限也能拿到），接口异常时回退默认 1 秒 */
  const slowThreshold = ref(1);

  const auth = usePageAuth();
  // 审计日志只读：删除/批量删除端点已下线（留存的收敛由服务端归档命令统一执行），
  // 关闭框架默认入口，避免按钮打了 405
  auth.destroy = false;
  auth.batchDestroy = false;

  onMounted(async () => {
    try {
      const res = await operationLogApi.slowThreshold();
      const threshold = res?.data?.threshold;
      if (typeof threshold === "number") {
        slowThreshold.value = threshold;
      }
    } catch {
      // 接口异常时沿用默认阈值
    }
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140
  });

  const { listColumnsFormat, detailColumnsFormat } = useOperationLogColumns({
    t,
    slowThreshold
  });

  const detailRowFetch = (row: Record<string, unknown>) =>
    fetchOperationLogDetail({ t, row });

  return {
    api,
    auth,
    listColumnsFormat,
    detailColumnsFormat,
    detailRowFetch,
    operationButtonsProps
  };
}
