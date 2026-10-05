import { describe, expect, it } from "vitest";

import { canActRow, isChainRow } from "../approvalRowRules";
import { approverText, batchFailedDetail } from "../approvalTexts";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("isChainRow / canActRow", () => {
  it("treats rows with current_level > 0 as chain rows", () => {
    expect(isChainRow({ current_level: 1 })).toBe(true);
    expect(isChainRow({ current_level: 0 })).toBe(false);
    expect(isChainRow({})).toBe(false);
    expect(isChainRow(undefined)).toBe(false);
  });

  it("restricts chain rows to current assignees (can_act)", () => {
    expect(canActRow({ current_level: 2, can_act: true })).toBe(true);
    expect(canActRow({ current_level: 2, can_act: false })).toBe(false);
    expect(canActRow({ current_level: 2 })).toBe(false);
  });

  it("keeps flat rows always actionable", () => {
    expect(canActRow({})).toBe(true);
    expect(canActRow(undefined)).toBe(true);
  });
});

describe("approverText", () => {
  it("renders current assignees for chain rows with level prefix", () => {
    const text = approverText(
      {
        current_level: 3,
        current_assignees: [{ username: "alice" }, { username: "bob" }]
      },
      t
    );
    expect(text).toBe(
      `approval.levelNo:${JSON.stringify({ n: 3 })}：alice、bob`
    );
  });

  it("falls back to pending label when chain row has no assignees", () => {
    const text = approverText({ current_level: 1, current_assignees: [] }, t);
    expect(text).toBe(
      `approval.levelNo:${JSON.stringify({ n: 1 })}：approval.pendingApprover`
    );
  });

  it("renders flat rows with the actual approver username", () => {
    expect(approverText({ approver: { username: "carol" } }, t)).toBe("carol");
    expect(approverText({}, t)).toBe("approval.pendingApprover");
  });
});

describe("batchFailedDetail", () => {
  it("joins failures as no: reason with Chinese semicolon", () => {
    expect(
      batchFailedDetail([
        { no: "REQ-0001", reason: "已通过" },
        { no: "REQ-0002", reason: "状态变更" }
      ])
    ).toBe("REQ-0001: 已通过；REQ-0002: 状态变更");
  });

  it("returns empty string for no failures", () => {
    expect(batchFailedDetail([])).toBe("");
  });
});
