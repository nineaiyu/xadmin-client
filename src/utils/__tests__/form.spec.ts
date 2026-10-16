import { describe, expect, it } from "vitest";
import { dataToFormData } from "@/utils/form";

/** 把展开结果转为有序 [key, value] 数组，便于断言（FormData 遍历顺序稳定） */
function snapshot(data: Record<string, unknown>): Array<[string, string]> {
  const formData = dataToFormData(data);
  const entries: Array<[string, string]> = [];
  formData.forEach((value, key) => entries.push([key, String(value)]));
  return entries;
}

describe("dataToFormData（FormData 协议 v1）", () => {
  it("展开嵌套对象为点分键", () => {
    expect(
      snapshot({ category: { value: "0" }, admin: { label: "(isummer)" } })
    ).toEqual([
      ["category.value", "0"],
      ["admin.label", "(isummer)"]
    ]);
  });

  it("展开数组为数字下标", () => {
    expect(
      snapshot({
        covers: [
          { value: "2", label: "1111" },
          { value: "3", label: "2222" }
        ]
      })
    ).toEqual([
      ["covers.0.value", "2"],
      ["covers.0.label", "1111"],
      ["covers.1.value", "3"],
      ["covers.1.label", "2222"]
    ]);
  });

  it("深层混合嵌套", () => {
    expect(snapshot({ a: { b: [{ c: "x" }] } })).toEqual([["a.b.0.c", "x"]]);
  });

  it("File 原样保留", () => {
    const file = new File(["content"], "a.png", { type: "image/png" });
    const entries = dataToFormData({ avatar: file });
    expect(entries.get("avatar")).toBe(file);
  });

  it("布尔与数值 String 化", () => {
    expect(snapshot({ enabled: true, priority: 10 })).toEqual([
      ["enabled", "true"],
      ["priority", "10"]
    ]);
  });

  it("null/undefined 字段跳过", () => {
    expect(snapshot({ a: "x", b: null, c: undefined })).toEqual([["a", "x"]]);
  });

  it("空对象产出空 FormData", () => {
    expect(snapshot({})).toEqual([]);
  });
});
