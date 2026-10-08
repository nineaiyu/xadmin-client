import { describe, expect, it } from "vitest";
import { toFieldMatrixEntries } from "../src/fieldMatrix";

describe("toFieldMatrixEntries", () => {
  it("扁平形态（用户预览）：一行一个模型归一为单模型条目", () => {
    const entries = toFieldMatrixEntries([
      {
        menu: { pk: "m1", title: "用户管理" },
        role: { pk: "r1", name: "管理员" },
        model: "system.UserInfo",
        model_label: "用户",
        fields: ["username", "email"],
        field_labels: ["用户名", "邮箱"]
      }
    ]);

    expect(entries).toEqual([
      {
        key: "m1",
        menu: "用户管理",
        role: "管理员",
        models: [
          {
            model: "system.UserInfo",
            model_label: "用户",
            fields: ["username", "email"],
            field_labels: ["用户名", "邮箱"]
          }
        ]
      }
    ]);
  });

  it("分组形态（角色/部门预览）：一行含多个模型，role 缺省留空", () => {
    const entries = toFieldMatrixEntries([
      {
        menu: { pk: "m2", title: "部门管理" },
        role: { pk: "r2", name: "主管" },
        models: [
          {
            model: "a",
            model_label: "A",
            fields: ["f1"],
            field_labels: ["F1"]
          }
        ]
      },
      {
        menu: { pk: "m3", title: "角色管理" },
        models: [{ model: "b", model_label: "B", fields: [], field_labels: [] }]
      }
    ]);

    expect(entries[0].key).toBe("m2");
    expect(entries[0].role).toBe("主管");
    expect(entries[0].models).toHaveLength(1);
    expect(entries[1].key).toBe("m3");
    expect(entries[1].role).toBeUndefined();
    expect(entries[1].models[0].model).toBe("b");
  });
});
