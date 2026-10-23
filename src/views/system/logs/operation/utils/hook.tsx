import { onMounted, ref, shallowRef } from "vue";
import { operationLogApi } from "@/api/audit/logs/operation";
import { defineListPage, type OperationProps } from "@/components/RePlusPage";
import { withCursorPagination } from "@/utils/cursorPagination";
import { useOperationLogColumns } from "./operationLogColumns";
import { fetchOperationLogDetail } from "./operationLogDetail";

/**
 * 操作日志：列渲染见 operationLogColumns.tsx（列表列与详情抽屉列），
 * 详情全量兜底见 operationLogDetail.ts。
 */
export function useOperationLog() {
  // 审计表百万行级：顺序翻页走 keyset（cursor），跳页/改排序自动回退 page 模式
  const cursorApi = withCursorPagination(operationLogApi);
  const page = defineListPage({
    api: cursorApi,
    localeName: "logsOperation",
    buttons: ({ auth }) => ({
      operationButtonsProps: shallowRef<OperationProps>({
        width: 140,
        buttons: [
          {
            // 全量正文需要 retrieve：仅 list 权限时隐藏详情入口，避免点了 403
            code: "detail",
            update: true,
            show: () => Boolean(auth.retrieve)
          }
        ]
      })
    })
  });
  const { t, api } = page;

  // 审计日志只读：删除/批量删除端点已下线（留存的收敛由服务端归档命令统一执行），
  // 关闭框架默认入口，避免按钮打了 405
  page.auth.destroy = false;
  page.auth.batchDestroy = false;

  /** 慢请求标红阈值：优先后端自持阈值端点（与操作日志列表同权限，
   *  无监控权限也能拿到），接口异常时回退默认 1 秒 */
  const slowThreshold = ref(1);

  onMounted(async () => {
    try {
      const res = await api.slowThreshold();
      const threshold = res?.data?.threshold;
      if (typeof threshold === "number") {
        slowThreshold.value = threshold;
      }
    } catch {
      // 接口异常时沿用默认阈值
    }
  });

  const { listColumnsFormat, detailColumnsFormat } = useOperationLogColumns({
    t,
    slowThreshold
  });

  const detailRowFetch = (row: Record<string, unknown>) =>
    fetchOperationLogDetail({ t, row });

  return {
    ...page,
    listColumnsFormat,
    detailColumnsFormat,
    detailRowFetch
  };
}
