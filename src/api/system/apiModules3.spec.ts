import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("@/utils/http", () => ({ http: { request: requestMock } }));

import { approvalApi } from "@/api/approval/approval";
import { approvalRuleApi } from "@/api/approval/approvalRule";
import { leaveApi } from "@/api/approval/leave";
import { noticeApi, noticeReadApi } from "./notice";
import { systemMsgSubscriptionApi } from "./notifications";
import { tagApi } from "./tag";
import { knowledgeApi } from "@/api/ai/knowledge";
import { oauthApi } from "../identity/oauth";

/**
 * api/system 第三批（拆分自第一批超长文件）：审批、通知协作与平台集成域的契约测试，
 * 口径同第一批——逐方法断言「方法 + URL + 载荷」，覆盖薄封装自声明端点。
 */

describe("approvalApi 审批单动作", () => {
  beforeEach(() => requestMock.mockReset());

  it("approve / reject / cancel", () => {
    approvalApi.approve("t1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approvals/t1/approve",
      { params: {}, data: { comment: "" } },
      {}
    );

    approvalApi.approve("t2", "同意按期执行");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approvals/t2/approve",
      { params: {}, data: { comment: "同意按期执行" } },
      {}
    );

    approvalApi.reject("t1", "不符合");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approvals/t1/reject",
      { params: {}, data: { reason: "不符合" } },
      {}
    );

    approvalApi.cancel("t1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approvals/t1/cancel",
      { params: {}, data: {} },
      {}
    );
  });

  it("批量通过 / 驳回", () => {
    approvalApi.batchApprove([1, 2]);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approvals/batch-approve",
      { params: {}, data: { pks: [1, 2] } },
      {}
    );

    approvalApi.batchReject([3], "材料不全");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/approvals/batch-reject",
      { params: {}, data: { pks: [3], reason: "材料不全" } },
      {}
    );
  });

  it("pendingCount / stats 轻量端点", () => {
    approvalApi.pendingCount();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approvals/pending-count",
      { params: {}, data: {} },
      {}
    );

    approvalApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approvals/stats",
      { params: {}, data: {} },
      {}
    );
  });

  it("approvalRuleApi candidateOptions", () => {
    approvalRuleApi.candidateOptions();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/approval-rules/candidate-options",
      { params: {}, data: {} },
      {}
    );
  });
});
describe("公告与已读", () => {
  it("noticeApi announcement / publish", () => {
    noticeApi.announcement({ title: "hi" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/notifications/notice-messages/announcement",
      { params: {}, data: { title: "hi" } },
      {}
    );

    noticeApi.publish(2, { top: 1 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/notice-messages/2/publish",
      { params: {}, data: { top: 1 } },
      {}
    );
  });

  it("noticeReadApi state", () => {
    noticeReadApi.state(3, { read: true });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/user-read-messages/3/state",
      { params: {}, data: { read: true } },
      {}
    );
  });
});

describe("消息订阅", () => {
  it("backends / list / update / testMsg / partialUpdate", () => {
    systemMsgSubscriptionApi.backends();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/notifications/system-msg-subscription/backends",
      { params: {}, data: {} },
      {}
    );

    systemMsgSubscriptionApi.list({ category: "audit" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/notifications/system-msg-subscription",
      { params: { category: "audit" }, data: {} },
      {}
    );

    systemMsgSubscriptionApi.update(5, { receive_backends: ["email"] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "put",
      "/api/notifications/system-msg-subscription/5",
      { params: {}, data: { receive_backends: ["email"] } },
      {}
    );

    systemMsgSubscriptionApi.testMsg({ message_type: "security" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/notifications/system-msg-subscription/test",
      { params: {}, data: { message_type: "security" } },
      {}
    );

    systemMsgSubscriptionApi.partialUpdate(5, { receive_backends: [] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "patch",
      "/api/notifications/system-msg-subscription/5",
      { params: {}, data: { receive_backends: [] } },
      {}
    );
  });
});
describe("leaveApi 请假", () => {
  it("submit / cancel / stats", () => {
    leaveApi.submit("lv1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/leaves/lv1/submit",
      { params: {}, data: {} },
      {}
    );

    leaveApi.cancel("lv1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/approval/leaves/lv1/cancel",
      { params: {}, data: {} },
      {}
    );

    leaveApi.stats();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/approval/leaves/stats",
      { params: {}, data: {} },
      {}
    );
  });
});
describe("knowledgeApi 知识库", () => {
  it("upload 落在资源根端点", () => {
    knowledgeApi.upload("手册", { content: "# 内容" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/knowledge-documents",
      { params: {}, data: { name: "手册", content: "# 内容" } },
      {}
    );
  });

  it("syncRepo / batchToggle", () => {
    knowledgeApi.syncRepo();
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/knowledge-documents/sync-repo",
      { params: {}, data: {} },
      {}
    );

    knowledgeApi.batchToggle([1, 2], false);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/knowledge-documents/batch-toggle",
      { params: {}, data: { pks: [1, 2], is_active: false } },
      {}
    );
  });
});

describe("oauthApi 第三方登录", () => {
  it("providers / authorize / callback", () => {
    oauthApi.providers();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/identity/auth/oauth/providers",
      { params: {}, data: {} },
      {}
    );

    oauthApi.authorize("github");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/identity/auth/oauth/github/authorize",
      { params: {}, data: {} },
      {}
    );

    oauthApi.callback("github", { code: "c", state: "s" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/identity/auth/oauth/github/callback",
      { params: { code: "c", state: "s" }, data: {} },
      {}
    );
  });

  it("绑定：bindAuthorize / bindings / unbind", () => {
    oauthApi.bindAuthorize("github");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/identity/auth/oauth/github/bind-authorize",
      { params: {}, data: {} },
      {}
    );

    oauthApi.bindings();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/identity/auth/oauth/bindings",
      { params: {}, data: {} },
      {}
    );

    oauthApi.unbind("b1", "pw");
    expect(requestMock).toHaveBeenLastCalledWith(
      "delete",
      "/api/identity/auth/oauth/bindings/b1",
      { params: {}, data: { password: "pw" } },
      {}
    );
  });
});
describe("tagApi 标签中心", () => {
  it("getResources / getObjectTags", () => {
    tagApi.getResources();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tags/resources",
      { params: {}, data: {} },
      {}
    );

    tagApi.getObjectTags("file", "9");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/system/tags/objects",
      { params: { resource: "file", pk: "9" }, data: {} },
      {}
    );
  });

  it("assign / batchAssign 全量替换与批量模式", () => {
    tagApi.assign({ resource: "file", pk: "9", tags: ["t1"] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tags/assign",
      { params: {}, data: { resource: "file", pk: "9", tags: ["t1"] } },
      {}
    );

    tagApi.batchAssign({
      resource: "file",
      pks: ["1"],
      tags: ["t2"],
      mode: "add"
    });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/system/tags/batch-assign",
      {
        params: {},
        data: { resource: "file", pks: ["1"], tags: ["t2"], mode: "add" }
      },
      {}
    );
  });
});
