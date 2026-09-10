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

  /** 批量驳回（原因必填） */
  batchReject = (pks: Array<string | number>, reason: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks, reason },
      `${this.baseApi}/batch-reject`
    );
  };

  /** 待我审批数（轻量接口：顶栏铃铛/页签角标轮询，服务端 10s 短缓存） */
  pendingCount = () => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/pending-count`
    );
  };

  /** 审批统计（近 30 天：我提交 / 我通过 / 我驳回 / 平均审批时长 / 我的待办） */
  stats = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/stats`);
  };
}

export const approvalApi = new ApprovalApi("/api/system/approvals");
