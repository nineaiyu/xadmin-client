import { describe, expect, it } from "vitest";

import {
  buildDraftEntries,
  buildFieldModelOptions,
  buildModelOptions,
  normalizeTargetPk,
  parseBoundMenuPks,
  parseFormMode
} from "./trial";

describe("trial 试算面板纯工具", () => {
  it("parseFormMode：数字/字符串/labeled 对象归一，空值与非法值返回 null", () => {
    expect(parseFormMode(0)).toBe(0);
    expect(parseFormMode("1")).toBe(1);
    expect(parseFormMode({ value: 1, label: "且" })).toBe(1);
    expect(parseFormMode(null)).toBeNull();
    expect(parseFormMode(undefined)).toBeNull();
    expect(parseFormMode("")).toBeNull();
    expect(parseFormMode("abc")).toBeNull();
  });

  it("parseBoundMenuPks：单值/对象/数组归一为字符串 pk 列表", () => {
    expect(parseBoundMenuPks(null)).toEqual([]);
    expect(parseBoundMenuPks("")).toEqual([]);
    expect(parseBoundMenuPks("pk-1")).toEqual(["pk-1"]);
    expect(parseBoundMenuPks({ pk: "pk-2" })).toEqual(["pk-2"]);
    expect(parseBoundMenuPks(["pk-1", { pk: "pk-2" }, null, ""])).toEqual([
      "pk-1",
      "pk-2"
    ]);
  });

  it("normalizeTargetPk：字符串/数字/对象/数组取首个非空 pk", () => {
    expect(normalizeTargetPk("")).toBe("");
    expect(normalizeTargetPk(null)).toBe("");
    expect(normalizeTargetPk(12)).toBe("12");
    expect(normalizeTargetPk("abc")).toBe("abc");
    expect(normalizeTargetPk({ pk: 7 })).toBe("7");
    expect(normalizeTargetPk([{ pk: "u-1" }, { pk: "u-2" }])).toBe("u-1");
  });

  it("buildModelOptions：跳过 * 与空 name，label 带 (name) 后缀", () => {
    const options = buildModelOptions([
      {
        name: "system",
        label: "系统",
        children: [
          { name: "*", label: "全部表" },
          { name: "system.userinfo", label: "用户" },
          { name: "", label: "空" },
          { name: "system.deptinfo", label: undefined }
        ]
      }
    ]);
    expect(options).toEqual([
      { value: "system.userinfo", label: "用户 (system.userinfo)" },
      { value: "system.deptinfo", label: "system.deptinfo (system.deptinfo)" }
    ]);
  });

  it("buildFieldModelOptions：兼容 app→model→field 与 model→field 两种层级", () => {
    const options = buildFieldModelOptions([
      {
        name: "app",
        children: [
          {
            name: "system.userinfo",
            label: "用户",
            children: [
              { name: "username", label: "用户名" },
              { name: "email", label: "" }
            ]
          }
        ]
      },
      {
        name: "message.chatroom",
        children: [{ name: "name", label: "会话名" }]
      }
    ]);
    expect(options).toEqual([
      {
        value: "system.userinfo",
        label: "用户",
        fields: [
          { value: "username", label: "用户名" },
          // 空 label 不回退 name（保持搬迁前 `label ?? name` 语义）
          { value: "email", label: "" }
        ]
      },
      {
        value: "message.chatroom",
        label: "message.chatroom",
        fields: [{ value: "name", label: "会话名" }]
      }
    ]);
  });

  it("buildDraftEntries：优先候选中文名，未命中回退原名", () => {
    const options = [
      {
        value: "system.userinfo",
        label: "用户",
        fields: [{ value: "username", label: "用户名" }]
      }
    ];
    expect(
      buildDraftEntries(
        { "system.userinfo": ["username", "unknown"], other: ["x"] },
        options
      )
    ).toEqual([
      { model: "system.userinfo", label: "用户", text: "用户名、unknown" },
      { model: "other", label: "other", text: "x" }
    ]);
  });
});
