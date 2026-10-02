import { describe, expect, it } from "vitest";

import { collectUserPks, userLabelText } from "../userData";
import type { FormDataItem, FormField } from "@/api/dataset/dform";

const asField = (field: Partial<FormField>) => field as FormField;
const asRow = (row: Partial<FormDataItem>) => row as FormDataItem;

describe("userLabelText", () => {
  it("joins username and nickname with a dash when nickname exists", () => {
    expect(
      userLabelText({ pk: 1, username: "alice", nickname: "爱丽丝" })
    ).toBe("alice-爱丽丝");
  });

  it("falls back to username when nickname is empty", () => {
    expect(userLabelText({ pk: 2, username: "bob", nickname: "" })).toBe("bob");
  });
});

describe("collectUserPks", () => {
  it("collects pks from user fields including array multi-select", () => {
    const fields = [
      asField({ key: "owner", type: "user" }),
      asField({ key: "collaborators", type: "user" }),
      asField({ key: "state", type: "select" })
    ];
    const rows = [
      asRow({ data: { owner: 7, collaborators: [8, 9], state: "open" } }),
      asRow({ data: { owner: "7", collaborators: [10] } })
    ];
    expect(collectUserPks(rows, fields)).toEqual([7, 8, 9, 10]);
  });

  it("skips non-positive and non-integer pks", () => {
    const fields = [asField({ key: "owner", type: "user" })];
    const rows = [asRow({ data: { owner: [0, -3, 1.5, "x", null, 11] } })];
    expect(collectUserPks(rows, fields)).toEqual([11]);
  });

  it("ignores rows without the field and non-user fields", () => {
    const fields = [asField({ key: "owner", type: "input" })];
    expect(collectUserPks([asRow({ data: { owner: 5 } })], fields)).toEqual([]);
    expect(collectUserPks([asRow({})], [])).toEqual([]);
  });
});
