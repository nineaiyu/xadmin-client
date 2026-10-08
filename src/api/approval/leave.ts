import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/**
 * 新增保存后未能提交审批（已存草稿）的业务码：区别于成功 1000 与失败 1001，
 * 前端据此给「警告」提示而不是成功/失败，避免用户把草稿当成已提交。
 * 取 1008 而非早期沿用的 1002：1002 是审批令牌待审批语义，两义重载易误读。
 */
export const LEAVE_DRAFT_SAVED_CODE = 1008;

/**
 * 请假申请：新增即提交审批。
 *
 * 通过 / 驳回在「流程审批」中心处理（审批人视角），本接口只负责
 * 申请人侧的提交与撤回；业务单状态由后端在审批终态自动回写。
 */
class LeaveApi extends BaseApi {
  /** 提交审批（草稿 / 已驳回 / 已撤回的申请可重新提交） */
  submit = (pk: string | number) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/submit`
    );
  };

  /** 撤回申请（仅申请人、仅审批中） */
  cancel = (pk: string | number) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/cancel`
    );
  };

  /** 我的请假统计（近 30 天：提交 / 审批中 / 已通过 / 已驳回） */
  stats = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/stats`);
  };
}

export const leaveApi = new LeaveApi("/api/approval/leaves");
