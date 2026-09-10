import { onMounted, onUnmounted, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/system/approval";

/**
 * 待审批角标轮询间隔：服务端 `pending-count` 有 10s 短缓存，客户端 60s 足够
 * （角标是提示性信息，不需要秒级实时；写操作后由 refreshApprovalBadge 立即刷新）。
 */
const POLL_INTERVAL = 60_000;

/** 待我审批角标权限码（页面挂在 SystemApprovalRequest 下，页签无独立菜单） */
const PENDING_COUNT_AUTH = "pendingCount:SystemApprovalRequest";

/**
 * 模块级单例：顶栏铃铛与审批中心页签角标共享同一计数。
 *
 * 若各组件各自持有 ref，写操作后的即时刷新只能更新自己那份，另一处要等下一次轮询；
 * 单例 + `refreshApprovalBadge()` 让任一处触发刷新都能同步到全部展示位。
 */
const pendingCount = ref(0);

/**
 * 拉取一次待我审批数并写入共享计数。
 *
 * - 按菜单权限码 `pendingCount` 收口：无该权限码时直接跳过请求（不产生 403 噪声），
 *   计数保持 0 —— 与后端 action 的权限校验口径一致；
 * - 拉取失败静默：角标属附加信息，不能影响主流程。
 */
export function refreshApprovalBadge() {
  if (!hasAuth(PENDING_COUNT_AUTH)) return;
  approvalApi
    .pendingCount()
    .then(res => {
      if (res.code === 1000 && res.data) {
        pendingCount.value = Number(res.data.pending ?? 0);
      }
    })
    .catch(() => undefined);
}

/**
 * 订阅待我审批计数：挂载时拉取一次并开启轮询，卸载时清理定时器。
 *
 * 顶栏铃铛（layout/lay-notice）与审批中心页签角标都用它；审批动作成功后调用
 * `refreshApprovalBadge()` 即时更新。
 */
export function useApprovalBadge() {
  let timer: ReturnType<typeof setInterval> | null = null;
  onMounted(() => {
    refreshApprovalBadge();
    timer = setInterval(refreshApprovalBadge, POLL_INTERVAL);
  });
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { pendingCount, load: refreshApprovalBadge };
}
