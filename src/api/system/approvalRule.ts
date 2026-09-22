import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 审批规则（多级审批链配置）：命中路径的敏感操作按规则的级次逐级审批 */
class ApprovalRuleApi extends BaseApi {
  /** 审批人候选目录（启用用户 + 启用角色）：审批模块自给自足，不依赖搜索模块 */
  candidateOptions = () => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/candidate-options`
    );
  };
}

export const approvalRuleApi = new ApprovalRuleApi(
  "/api/system/approval-rules"
);
