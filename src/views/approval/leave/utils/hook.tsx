import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { leaveApi } from "@/api/approval/leave";
import { usePageAuth } from "@/router/utils";
import { useLeaveColumns } from "./leaveColumns";
import { useLeaveButtons } from "./useLeaveButtons";
import { useLeaveFormOptions } from "./useLeaveFormOptions";
import { useLeaveRunner } from "./useLeaveRunner";

/**
 * 请假申请页：RePlusPage 元数据驱动列表 + 申请人侧「提交 / 撤回」。
 *
 * 审批动作不在本页：审批人统一在「流程审批」中心处理，避免出现第二套审批入口；
 * 本页只展示审批进度（当前节点 / 驳回原因），点击详情可看到流程轨迹。
 * 拆分：列渲染见 useLeaveColumns、按钮见 useLeaveButtons、表单选项见
 * useLeaveFormOptions、确认+执行链路见 useLeaveRunner（行数门禁）。
 */
export function useLeave(
  tableRef: Ref,
  statsRef?: Ref<{ refresh: () => void } | null>
) {
  const api = reactive(leaveApi);
  const auth = usePageAuth(["submit", "cancel"]);
  const { t } = useI18n();

  // 状态列 / 操作按钮 / 统计卡随业务单状态联动（提交 → 审批中、撤回 → 已撤回）
  const refresh = () => {
    tableRef.value?.handleGetData();
    statsRef?.value?.refresh();
  };

  const { confirmAndRun } = useLeaveRunner({ t, refresh });
  const { listColumnsFormat } = useLeaveColumns({ t });
  const { operationButtonsProps } = useLeaveButtons({
    t,
    auth,
    api,
    confirmAndRun
  });
  const { addOrEditOptions } = useLeaveFormOptions({ t, refresh });

  return {
    api,
    auth,
    operationButtonsProps,
    listColumnsFormat,
    addOrEditOptions
  };
}
