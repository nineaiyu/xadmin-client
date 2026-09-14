import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

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

export const leaveApi = new LeaveApi("/api/system/leaves");
