import { BaseApi } from "@/api/base";
import type { BaseResult, DetailResult } from "@/api/types";

/** 敏感操作审批单 */
class ApprovalApi extends BaseApi {
  /** 通过审批单 */
  approve = (pk: string | number) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/approve`
    );
  };

  /** 驳回审批单（必填原因） */
  reject = (pk: string | number, reason: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { reason },
      `${this.baseApi}/${pk}/reject`
    );
  };

  /** 撤回审批单（仅申请人、仅待审批） */
  cancel = (pk: string | number) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/cancel`
    );
  };

  /** 批量通过 */
  batchApprove = (pks: Array<string | number>) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks },
      `${this.baseApi}/batch-approve`
    );
  };
}

export const approvalApi = new ApprovalApi("/api/system/approvals");
