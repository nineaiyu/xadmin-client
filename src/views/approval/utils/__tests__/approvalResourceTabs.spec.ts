import { describe, expect, it } from "vitest";
import {
  APPROVAL_RESOURCE_TABS,
  visibleApprovalResourceTabs
} from "../approvalResourceTabs";

describe("visibleApprovalResourceTabs", () => {
  it("两个资源都可见时按操作审批、流程审批顺序返回", () => {
    const tabs = visibleApprovalResourceTabs(() => true);
    expect(tabs.map(tab => tab.path)).toEqual([
      "/approval/index",
      "/approval/instance/index"
    ]);
  });

  it("只保留有列表权限的资源", () => {
    const onlyInstance = visibleApprovalResourceTabs(
      code => code === "list:SystemApprovalInstance"
    );
    expect(onlyInstance.map(tab => tab.path)).toEqual([
      "/approval/instance/index"
    ]);

    const onlyRequest = visibleApprovalResourceTabs(
      code => code === "list:SystemApprovalRequest"
    );
    expect(onlyRequest.map(tab => tab.path)).toEqual(["/approval/index"]);
  });

  it("两套资源都有独立权限码，不复用页面名", () => {
    expect(APPROVAL_RESOURCE_TABS.map(tab => tab.authCode)).toEqual([
      "list:SystemApprovalRequest",
      "list:SystemApprovalInstance"
    ]);
  });
});
