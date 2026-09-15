import { approvalDelegationApi } from "@/api/system/approvalDelegation";
import { getCurrentInstance, reactive } from "vue";
import { getDefaultAuths } from "@/router/utils";

/**
 * 审批委托管理（审批流三期）。
 *
 * 列表与表单由服务端元数据驱动：delegator/delegate 为用户外键（用户搜索选择器）、
 * start_time/end_time 为 datetime、flow_codes 为流程 code 列表（空 = 全部流程）。
 * 解析语义：生效委托用代理人替换原审批人（不递归、期外回落、申请人剔除）。
 */
export function useApprovalDelegation() {
  const api = reactive(approvalDelegationApi);
  const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });

  return {
    api,
    auth
  };
}
