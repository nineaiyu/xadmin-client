import { BaseApi } from "@/api/base";

/** 审批委托（审批流三期）：生效时段内由代理人代审，flow_codes 空 = 全部流程 */
export type ApprovalDelegationRow = {
  pk: string;
  delegator: string;
  delegator_name: string;
  delegate: string;
  delegate_name: string;
  delegate_nickname: string;
  start_time: string;
  end_time: string;
  flow_codes: string[];
  is_active: boolean;
  remark: string | null;
  created_time: string;
};

class ApprovalDelegationApi extends BaseApi {
  // 标准 CRUD 由 BaseApi 提供（list/create/retrieve/partialUpdate/destroy/batchDestroy）
}

export const approvalDelegationApi = new ApprovalDelegationApi(
  "/api/system/approval-delegations"
);
