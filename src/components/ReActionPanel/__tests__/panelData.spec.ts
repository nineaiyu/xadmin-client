import { describe, expect, it, vi } from "vitest";
import { bindRowGroups, toDisplayList, toDisplayText } from "../src/panelData";

describe("toDisplayText", () => {
  it("空值统一回退占位符", () => {
    expect(toDisplayText(null)).toBe("—");
    expect(toDisplayText(undefined)).toBe("—");
    expect(toDisplayText("")).toBe("—");
  });

  it("对象取 name/label/username/nickname 首个非空键", () => {
    expect(toDisplayText({ name: "研发部" })).toBe("研发部");
    // 与原面板一致：?? 仅跳过 null/undefined，空字符串视为缺省回退「—」
    expect(toDisplayText({ label: "管理员", name: "" })).toBe("—");
    expect(toDisplayText({ username: "xadmin", name: null })).toBe("xadmin");
    expect(toDisplayText({ nickname: "小明" })).toBe("小明");
    expect(toDisplayText({})).toBe("—");
  });

  it("数组逐项收敛并以顿号拼接，全空回退占位符", () => {
    expect(toDisplayText([{ name: "A" }, { name: "B" }])).toBe("A、B");
    expect(toDisplayText([null, { name: "A" }])).toBe("A");
    expect(toDisplayText([])).toBe("—");
    expect(toDisplayText([{}, null])).toBe("—");
  });

  it("标量直接字符串化", () => {
    expect(toDisplayText(0)).toBe("0");
    expect(toDisplayText(true)).toBe("true");
    expect(toDisplayText("文本")).toBe("文本");
  });
});

describe("toDisplayList", () => {
  it("非数组输入返回空数组", () => {
    expect(toDisplayList(null)).toEqual([]);
    expect(toDisplayList("x")).toEqual([]);
  });

  it("对象数组取稳定键值与名称，保留字典色", () => {
    expect(
      toDisplayList([
        { pk: 1, name: "管理员" },
        { pk: 2, label: "只读", color: "#f00" },
        { value: "v3", username: "u3" }
      ])
    ).toEqual([
      { key: "1", name: "管理员", color: undefined },
      { key: "2", name: "只读", color: "#f00" },
      { key: "v3", name: "u3", color: undefined }
    ]);
  });

  it("对象缺名称时回退键值，标量按序号收敛", () => {
    expect(toDisplayList([{ pk: 7 }])).toEqual([
      { key: "7", name: "7", color: undefined }
    ]);
    expect(toDisplayList(["甲", "乙"])).toEqual([
      { key: "0", name: "甲" },
      { key: "1", name: "乙" }
    ]);
  });
});

describe("bindRowGroups", () => {
  const icon = {};

  it("把行参数契约收敛为闭包绑定契约，保留分组与展示字段", () => {
    const run = vi.fn();
    const groups = bindRowGroups(
      [
        {
          key: "g1",
          title: "分组一",
          actions: [
            {
              code: "a1",
              label: "动作一",
              description: "说明",
              icon,
              run
            },
            {
              code: "a2",
              label: "动作二",
              icon,
              type: "danger",
              disabled: (row: { count: number }) => row.count === 0,
              run
            }
          ]
        }
      ],
      { count: 0 }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("g1");
    expect(groups[0].title).toBe("分组一");

    const [first, second] = groups[0].actions;
    expect(first).toMatchObject({
      code: "a1",
      label: "动作一",
      description: "说明",
      icon,
      type: undefined,
      disabled: undefined
    });
    first.run();
    expect(run).toHaveBeenCalledOnce();

    expect(second.type).toBe("danger");
    expect(second.disabled?.()).toBe(true);
    second.run();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("行变化后以新行快照判定可用性", () => {
    const groups = bindRowGroups(
      [
        {
          key: "g",
          title: "t",
          actions: [
            {
              code: "a",
              label: "l",
              icon,
              disabled: (row: { on: boolean }) => !row.on,
              run: () => undefined
            }
          ]
        }
      ],
      { on: true }
    );
    expect(groups[0].actions[0].disabled?.()).toBe(false);
  });
});
