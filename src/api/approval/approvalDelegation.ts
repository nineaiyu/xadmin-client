import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 委托停用影响面：挂在委托人或代理人名下的在途审批待办 */
export type ApprovalDelegationImpact = {
  total: number;
  delegator_pending: number;
  delegate_pending: number;
  items: Array<{
    /** 审批实例 pk（一行任务所属实例） */
    pk: string;
    /** 节点任务 pk（影响面按任务粒度列出） */
    task_pk: string;
    node_name: string;
    title: string;
    flow: string;
    applicant: string;
  }>;
  note: string;
};

/** 审批委托：生效时段内由代理人代审，flow_codes 空 = 全部流程 */
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
  impact = (pk: string) => {
    return this.request<DetailResult<ApprovalDelegationImpact>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/impact`
    );
  };
}

export const approvalDelegationApi = new ApprovalDelegationApi(
  "/api/approval/approval-delegations"
);
