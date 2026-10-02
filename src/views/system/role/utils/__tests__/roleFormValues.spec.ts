import { describe, expect, it } from "vitest";

import { roleFieldFormValue } from "../roleFormValues";
import { menuFieldKey } from "../treeKeys";

describe("roleFieldFormValue", () => {
  it("passes through array field values unchanged", () => {
    const arr = ["menu-1", menuFieldKey("menu-1", "f-1")];
    expect(roleFieldFormValue(arr)).toBe(arr);
    expect(roleFieldFormValue([])).toEqual([]);
  });

  it("flattens {menuPk: [fieldPk]} dicts into synthetic keys", () => {
    expect(
      roleFieldFormValue({ "menu-1": ["f-1", "f-2"], "menu-2": ["f-3"] })
    ).toEqual([
      menuFieldKey("menu-1", "f-1"),
      menuFieldKey("menu-1", "f-2"),
      menuFieldKey("menu-2", "f-3")
    ]);
  });

  it("tolerates empty or malformed values", () => {
    expect(roleFieldFormValue(undefined)).toEqual([]);
    expect(roleFieldFormValue(null)).toEqual([]);
    expect(roleFieldFormValue({})).toEqual([]);
    expect(roleFieldFormValue({ "menu-1": null })).toEqual([]);
  });
});
