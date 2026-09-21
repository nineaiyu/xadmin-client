import { SUCCESS_CODE } from "@/api/types";
import { computed, ref } from "vue";
import { useIntervalFn } from "@vueuse/core";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/system/approval";
import { approvalInstanceApi } from "@/api/system/approvalFlow";

/**
 * 待审批角标轮询间隔：服务端 `pending-count` 有 10s 短缓存，客户端 60s 足够
 * （角标是提示性信息，不需要秒级实时；写操作后由 refreshApprovalBadge 立即刷新）。
 */
const POLL_INTERVAL = 60_000;

/** 轻量敏感操作审批的待办角标权限码（页面挂在 SystemApprovalRequest 下，页签无独立菜单） */
const PENDING_COUNT_AUTH = "pendingCount:SystemApprovalRequest";
/** 流程审批中心的待办角标权限码（页面挂在 SystemApprovalInstance 下，页签无独立菜单） */
const FLOW_PENDING_COUNT_AUTH = "pendingCount:SystemApprovalInstance";

/**
 * 模块级单例：顶栏铃铛与两个审批中心页签角标共享同一计数。
 *
 * 若各组件各自持有 ref，写操作后的即时刷新只能更新自己那份，另一处要等下一次轮询；
 * 单例 + `refreshApprovalBadge()` 让任一处触发刷新都能同步到全部展示位。
 *
 * 两条审批轨（轻量敏感操作 / 流程实例）各自独立计数：各自的页签角标只显示本轨
 * 待办，顶栏铃铛显示合计（都是「待我处理」）。
 */
const pendingCount = ref(0);
const flowPendingCount = ref(0);
const totalPendingCount = computed(
  () => Number(pendingCount.value || 0) + Number(flowPendingCount.value || 0)
);

/**
 * 拉取一次待办数并写入共享计数（两条轨并行、各自按权限码收口）。
 *
 * - 按菜单权限码收口：无该权限码时直接跳过请求（不产生 403 噪声），计数保持 0
 *   —— 与后端 action 的权限校验口径一致；
 * - 拉取失败静默：角标属附加信息，不能影响主流程。
 */
export function refreshApprovalBadge() {
  if (hasAuth(PENDING_COUNT_AUTH)) {
    approvalApi
      .pendingCount()
      .then(res => {
        if (res.code === SUCCESS_CODE && res.data) {
          pendingCount.value = Number(res.data.pending ?? 0);
        }
      })
      .catch(() => undefined);
  }
  if (hasAuth(FLOW_PENDING_COUNT_AUTH)) {
    approvalInstanceApi
      .pendingCount()
      .then(res => {
        if (res.code === SUCCESS_CODE && res.data) {
          flowPendingCount.value = Number(res.data.pending ?? 0);
        }
      })
      .catch(() => undefined);
  }
}

/**
 * 订阅待办计数：挂载即拉取一次并开启轮询，卸载自动停止
 * （轮询生命周期由 `useIntervalFn` 随组件 scope 清理）。
 *
 * 顶栏铃铛（layout/lay-notice）与两个审批中心页签角标都用它；审批动作成功后调用
 * `refreshApprovalBadge()` 即时更新。
 */
export function useApprovalBadge() {
  useIntervalFn(refreshApprovalBadge, POLL_INTERVAL, {
    immediateCallback: true
  });

  return {
    pendingCount,
    flowPendingCount,
    totalPendingCount,
    load: refreshApprovalBadge
  };
}
