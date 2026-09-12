import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";

/** 流程定义（ADR-012：列表式节点编辑；节点随定义整体提交） */
export type FlowVersionRow = {
  version: number;
  remark: string;
  created_time: string;
};

class ApprovalFlowApi extends BaseApi {
  // 标准 CRUD 由 BaseApi 提供（list/create/retrieve/partialUpdate/destroy）

  /** 流程定义版本列表（ADR-016 §2 快照审计） */
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
class ApprovalInstanceApi extends BaseApi {
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

  /** 加签（当前节点追加审批人，用户名逗号分隔） */
  addSign = (pk: string | number, usernames: string, comment?: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { usernames, comment },
      `${this.baseApi}/${pk}/add-sign`
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
