import { describe, expect, it } from "vitest";
import { approvalSelectionEnabled } from "../batchSelection";

describe("approvalSelectionEnabled", () => {
  const codes = ["batchApprove", "batchReject"] as const;

  it("仅待办页签开启勾选", () => {
    expect(
      approvalSelectionEnabled("pending", { batchApprove: true }, codes)
    ).toBe(true);
    expect(
      approvalSelectionEnabled("mine", { batchApprove: true }, codes)
    ).toBe(false);
  });

  it("无任一批量动作权限时不开启（避免死勾选）", () => {
    expect(
      approvalSelectionEnabled(
        "pending",
        { approve: true, reject: true },
        codes
      )
    ).toBe(false);
    expect(approvalSelectionEnabled("pending", {}, codes)).toBe(false);
  });

  it("任一批量动作权限即可勾选", () => {
    expect(
      approvalSelectionEnabled("pending", { batchReject: true }, codes)
    ).toBe(true);
  });
});
