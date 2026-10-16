import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: {
    request: requestMock,
    upload: vi.fn(),
    autoDownload: vi.fn(),
    download: vi.fn()
  }
}));

import { approvalFlowApi, approvalInstanceApi } from "./approvalFlow";

/**
 * api/approval 流程定义 / 实例动作薄封装契约测试：逐方法断言「方法 + URL + 载荷」。
 * 审批动作 URL 拼错或载荷字段漂移时（approve/reject/transfer/add-sign 等），
 * 失败模式是提交后静默 404 / 400，靠该层测试在构建期变红。
 */

describe("approvalFlowApi 流程定义", () => {
  beforeEach(() => {
    requestMock.mockClear();
  });

  it("versions 列出历史版本（快照审计）", () => {
    approvalFlowApi.versions("f1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-flows/f1/versions",
      { params: {}, data: {} },
      {}
    );
    approvalFlowApi.versions("f1", { page: 2 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-flows/f1/versions",
      { params: { page: 2 }, data: {} },
      {}
    );
  });

  it("rollback 把版本号与备注放在查询参数上（POST 动作端点）", () => {
    approvalFlowApi.rollback("f1", 3, "回滚原因");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-flows/f1/rollback",
      { params: { version: 3, remark: "回滚原因" }, data: {} },
      {}
    );
    approvalFlowApi.rollback("f1", 3);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-flows/f1/rollback",
      { params: { version: 3, remark: undefined }, data: {} },
      {}
    );
  });
});

describe("approvalInstanceApi 实例动作", () => {
  beforeEach(() => {
    requestMock.mockClear();
  });

  it("讨论区：列表 / 发表 / 删除评论", () => {
    approvalInstanceApi.comments("i1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-instances/i1/comments",
      { params: {}, data: {} },
      {}
    );
    approvalInstanceApi.addComment("i1", "请补充截图");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/comment",
      { params: {}, data: { content: "请补充截图" } },
      {}
    );
    approvalInstanceApi.deleteComment("i1", "c9");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/comment/delete",
      { params: {}, data: { pk: "c9" } },
      {}
    );
  });

  it("approve 缺省 task/comment 时载荷为空，传入时原样携带", () => {
    approvalInstanceApi.approve("i1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/approve",
      { params: {}, data: {} },
      {}
    );
    approvalInstanceApi.approve("i1", "t1", "同意");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/approve",
      { params: {}, data: { task: "t1", comment: "同意" } },
      {}
    );
  });

  it("reject 原因必填，task 可选", () => {
    approvalInstanceApi.reject("i1", "材料不全", "t2");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/reject",
      { params: {}, data: { task: "t2", reason: "材料不全" } },
      {}
    );
    approvalInstanceApi.reject("i1", "不同意");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/reject",
      { params: {}, data: { task: undefined, reason: "不同意" } },
      {}
    );
  });

  it("cancel / urge 端点与可选留言", () => {
    approvalInstanceApi.cancel("i1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/cancel",
      { params: {}, data: {} },
      {}
    );
    approvalInstanceApi.urge("i1", "麻烦尽快");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/urge",
      { params: {}, data: { message: "麻烦尽快" } },
      {}
    );
    approvalInstanceApi.urge("i1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/urge",
      { params: {}, data: { message: undefined } },
      {}
    );
  });

  it("addSign / transfer 携带目标人与可选备注", () => {
    approvalInstanceApi.addSign("i1", "lisi,wangwu", "会签");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/add-sign",
      { params: {}, data: { usernames: "lisi,wangwu", comment: "会签" } },
      {}
    );
    approvalInstanceApi.transfer("i1", "lisi", "出差代理", "t3");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/i1/transfer",
      {
        params: {},
        data: { username: "lisi", comment: "出差代理", task: "t3" }
      },
      {}
    );
  });

  it("批量三动作 pks 透传数组", () => {
    const pks = ["a", "b"];
    approvalInstanceApi.batchApprove(pks, "批量同意");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/batch-approve",
      { params: {}, data: { pks, comment: "批量同意" } },
      {}
    );
    approvalInstanceApi.batchReject(pks, "批量驳回");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/batch-reject",
      { params: {}, data: { pks, reason: "批量驳回" } },
      {}
    );
    approvalInstanceApi.batchTransfer(pks, "lisi", "统一转交");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approval-instances/batch-transfer",
      { params: {}, data: { pks, username: "lisi", comment: "统一转交" } },
      {}
    );
  });

  it("availableFlows / pendingCount / stats 轻量端点", () => {
    approvalInstanceApi.availableFlows();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-instances/available-flows",
      { params: {}, data: {} },
      {}
    );
    approvalInstanceApi.pendingCount();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-instances/pending-count",
      { params: {}, data: {} },
      {}
    );
    approvalInstanceApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-instances/stats",
      { params: {}, data: {} },
      {}
    );
  });
});
