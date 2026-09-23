import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";

/** 流程定义（列表式节点编辑；节点随定义整体提交） */
export type FlowVersionRow = {
  version: number;
  remark: string;
  created_time: string;
};

/** 当前节点进度（比例会签的达标线预览）：required 为达标所需通过数，与后端 engine 同口径 */
export type NodeProgress = {
  approve_type: string;
  approve_ratio: number;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  required: number;
  reached: boolean;
};

class ApprovalFlowApi extends BaseApi {
  // 标准 CRUD 由 BaseApi 提供（list/create/retrieve/partialUpdate/destroy）

  /** 流程定义版本列表（快照审计） */
  versions = (pk: string, params?: object) => {
    return this.request<BaseResult & { data: FlowVersionRow[] }>(
      "get",
      params ?? {},
      {},
      `${this.baseApi}/${pk}/versions`
    );
  };

  /** 回滚到历史版本：快照写回活定义并落新版本 */
  rollback = (pk: string, version: number, remark?: string) => {
    return this.request<BaseResult>(
      "post",
      { version, remark },
      {},
      `${this.baseApi}/${pk}/rollback`
    );
  };
}

export const approvalFlowApi = new ApprovalFlowApi(
  "/api/system/approval-flows"
);

/** 流程实例（一次申请） */
/** 审批讨论区评论（mentions 为被 @ 用户 pk 列表） */
export type InstanceComment = {
  pk: string;
  creator: string | number | null;
  author_display: string;
  content: string;
  mentions: string[];
  created_time: string;
};

class ApprovalInstanceApi extends BaseApi {
  /** 讨论区：评论列表 */
  comments = (pk: string | number) => {
    return this.request<DataListResult<InstanceComment>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/comments`
    );
  };
  /** 讨论区：发表评论（内容支持 @用户名 提醒） */
  addComment = (pk: string | number, content: string) => {
    return this.request<DetailResult<InstanceComment>>(
      "post",
      {},
      { content },
      `${this.baseApi}/${pk}/comment`
    );
  };
  /** 讨论区：删除评论（作者本人或超管） */
  deleteComment = (pk: string | number, commentPk: string | number) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pk: commentPk },
      `${this.baseApi}/${pk}/comment/delete`
    );
  };
  /** 通过（task 缺省取当前用户在当前节点的待办） */
  approve = (pk: string | number, task?: string, comment?: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { task, comment },
      `${this.baseApi}/${pk}/approve`
    );
  };

  /** 驳回（原因必填；驳回即终止申请） */
  reject = (pk: string | number, reason: string, task?: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { task, reason },
      `${this.baseApi}/${pk}/reject`
    );
  };

  /** 撤回（仅申请人、仅审批中） */
  cancel = (pk: string | number) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/cancel`
    );
  };

  /** 催办（仅申请人/超管、仅审批中；可选留言，服务端 10 分钟节流） */
  urge = (pk: string | number, message?: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      { message },
      `${this.baseApi}/${pk}/urge`
    );
  };

  /** 加签（当前节点追加审批人，用户名逗号分隔） */
  addSign = (pk: string | number, usernames: string, comment?: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { usernames, comment },
      `${this.baseApi}/${pk}/add-sign`
    );
  };

  /** 转交（把我的当前待办交给指定用户处理；task 缺省取当前待办） */
  transfer = (
    pk: string | number,
    username: string,
    comment?: string,
    task?: string
  ) => {
    return this.request<DetailResult>(
      "post",
      {},
      { username, comment, task },
      `${this.baseApi}/${pk}/transfer`
    );
  };

  /** 批量通过 */
  batchApprove = (pks: Array<string | number>, comment?: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks, comment },
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

  /** 批量转交：勾选的待办一次性转给同一用户（逐条独立，返回成功数与失败明细） */
  batchTransfer = (
    pks: Array<string | number>,
    username: string,
    comment?: string
  ) => {
    return this.request<DetailResult>(
      "post",
      {},
      { pks, username, comment },
      `${this.baseApi}/batch-transfer`
    );
  };

  /** 可发起流程（启用中）：发起申请弹窗数据源，只回传 pk/name/form_schema */
  availableFlows = () => {
    return this.request<DataListResult>(
      "get",
      {},
      {},
      `${this.baseApi}/available-flows`
    );
  };

  /** 待我审批数（轻量接口：页签角标轮询，服务端 10s 短缓存） */
  pendingCount = () => {
    return this.request<DetailResult>(
      "get",
      {},
      {},
      `${this.baseApi}/pending-count`
    );
  };

  /** 统计（近 30 天：我提交 / 我通过 / 我驳回 / 我的待办） */
  stats = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/stats`);
  };
}

export const approvalInstanceApi = new ApprovalInstanceApi(
  "/api/system/approval-instances"
);
