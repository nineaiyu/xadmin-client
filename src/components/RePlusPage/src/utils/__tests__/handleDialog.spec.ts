import { describe, expect, it } from "vitest";

import { dialogSize } from "@/components/ReDialog/size";
import {
  mergeFormProps,
  resolveFormColumn,
  resolveFormDialogWidth
} from "../handle-dialog";

describe("表单列解析上下文", () => {
  it("元数据已下发的键：返回装配好的列（保留 _column 与既有个性化配置）", () => {
    const column = {
      prop: "name",
      label: "名称",
      _column: { key: "name", input_type: "string" }
    };
    const resolved = resolveFormColumn({ name: column }, "name");
    expect(resolved).toBe(column);
  });

  it("元数据未下发的键：返回只有 prop / _column.key 的空列（供页面建立扩展字段）", () => {
    const resolved = resolveFormColumn({}, "grants");
    expect(resolved.prop).toBe("grants");
    expect(resolved._column?.key).toBe("grants");
    // 空列不携带任何渲染配置，扩展字段的控件由页面解析器决定
    expect(resolved.valueType).toBeUndefined();
    expect(resolved.renderField).toBeUndefined();
  });
});

describe("表单 props 合并", () => {
  it("页面补充规则与元数据规则按字段合并（不整块覆盖）", () => {
    const merged = mergeFormProps(
      { rules: { name: [{ required: true }], url: [{ required: true }] } },
      { rules: { secret: [{ required: true }] }, labelWidth: "110px" }
    );
    expect(Object.keys(merged.rules as object)).toEqual([
      "name",
      "url",
      "secret"
    ]);
    expect(merged.labelWidth).toBe("110px");
    expect((merged.rules as Record<string, unknown[]>).name).toEqual([
      { required: true }
    ]);
  });

  it("页面同名字段规则优先（显式覆盖单字段）", () => {
    const merged = mergeFormProps(
      { rules: { secret: [{ required: true }] } },
      { rules: { secret: [{ required: false }] } }
    );
    expect((merged.rules as Record<string, unknown[]>).secret).toEqual([
      { required: false }
    ]);
  });

  it("两侧都没有规则时不注入空 rules（保持原有 props 形状）", () => {
    const merged = mergeFormProps({ labelWidth: "100px" }, undefined);
    expect(merged).toEqual({ labelWidth: "100px" });
    expect("rules" in merged).toBe(false);
  });
});

describe("新增/编辑弹层默认宽度", () => {
  it("页面未声明宽度：取 xxl 档（两列表单 640px/760px 偏窄）", () => {
    expect(resolveFormDialogWidth()).toBe(dialogSize("xxl"));
    expect(resolveFormDialogWidth({})).toBe("960px");
  });

  it("页面显式声明宽度：以页面配置为准（含窄档与百分比）", () => {
    expect(resolveFormDialogWidth({ width: dialogSize("sm") })).toBe("480px");
    expect(resolveFormDialogWidth({ width: "50%" })).toBe("50%");
  });
});
