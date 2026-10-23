import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

export type ApprovalRuleImpactItem = {
  pk: string;
  path: string;
  method: string;
  module: string;
  applicant: string;
  created_time: string;
  current_rule: string;
  current_priority: number;
  draft_wins: boolean;
};

export type ApprovalRuleImpact = {
  total: number;
  items: ApprovalRuleImpactItem[];
  truncated: boolean;
  rule_active: boolean;
};

/** 审批规则（多级审批链配置）：命中路径的敏感操作按规则的级次逐级审批 */
class ApprovalRuleApi extends BaseApi {
  /** 审批人候选目录（启用用户 + 启用角色 + 启用岗位）：支持关键字远程搜索 */
  candidateOptions = (params?: { keyword?: string; limit?: number }) => {
    return this.request<DetailResult>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/candidate-options`
    );
  };
  /** 影响面预览：草稿或已保存规则会命中的在途审批单（只读） */
  impactPreview = (data: {
    pk?: string;
    path_patterns?: string[];
    methods?: string[];
    priority?: number;
    is_active?: boolean;
  }) => {
    return this.request<DetailResult<ApprovalRuleImpact>>(
      "post",
      {},
      data,
      `${this.baseApi}/impact-preview`
    );
  };
}

export const approvalRuleApi = new ApprovalRuleApi(
  "/api/approval/approval-rules"
);
