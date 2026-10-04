import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import DatasetForm from "../DatasetForm.vue";
import type { DatasetItem, DatasetMeta } from "@/api/dataset/datasets";

/**
 * 数据集表单（DatasetForm）单测（T02-13）。
 *
 * 核心回归：`op=in` 过滤的 value 按逗号拆分为数组提交——后端强制 in 的 value
 * 为 list/tuple，字符串原样提交必 400（输入框按逗号串展示，placeholder 已
 * 暗示该用法）；编辑回显时数组 join 回逗号串（双向可逆）。
 */

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
// choiceValue 为纯函数（编辑回显取标量值）；mock 以切断 dict 模块的 i18n 依赖链
vi.mock("@/utils/dict", () => ({
  choiceValue: (value: unknown) =>
    typeof value === "object" && value !== null
      ? (value as { value: unknown }).value
      : value
}));

const META = {
  models: ["system.userinfo"],
  fields: { "system.userinfo": ["username", "nickname"] }
} as unknown as DatasetMeta;

const ROW = {
  name: "用户数据集",
  description: "",
  bound_model: "system.userinfo",
  columns: ["username"],
  filters: [
    { field: "username", op: "in", value: ["zhangsan", "lisi"] },
    { field: "nickname", op: "exact", value: "张" }
  ],
  ordering: "",
  row_limit: 100,
  visibility: "shared",
  config: {}
} as unknown as DatasetItem;

const mountForm = (row: DatasetItem | null) =>
  mount(DatasetForm, {
    props: { row, meta: META },
    global: {
      stubs: [
        "el-form",
        "el-form-item",
        "el-input",
        "el-input-number",
        "el-select",
        "el-option",
        "el-radio-group",
        "el-radio",
        "el-button"
      ]
    }
  });

const payloadOf = (wrapper: ReturnType<typeof mountForm>) =>
  (
    wrapper.vm as unknown as {
      getPayload: () => Record<string, unknown> | null;
    }
  ).getPayload();

describe("DatasetForm op=in 过滤值（T02-13）", () => {
  it("编辑回显：数组 value 以逗号串展示，提交拆回数组（双向可逆）", () => {
    const wrapper = mountForm(ROW);
    const filters = payloadOf(wrapper)!.filters as Array<{
      field: string;
      op: string;
      value: unknown;
    }>;
    expect(filters[0]).toEqual({
      field: "username",
      op: "in",
      value: ["zhangsan", "lisi"]
    });
    // 非 in 操作符原样透传
    expect(filters[1]).toEqual({
      field: "nickname",
      op: "exact",
      value: "张"
    });
  });

  it("用户手输逗号串：拆分、去空白、丢弃空段", () => {
    const row = {
      ...ROW,
      filters: [{ field: "username", op: "in", value: "a, b ,,c" }]
    } as unknown as DatasetItem;
    const wrapper = mountForm(row);
    const filters = payloadOf(wrapper)!.filters as Array<{
      value: unknown;
    }>;
    expect(filters[0].value).toEqual(["a", "b", "c"]);
  });

  it("新建未填必填项：getPayload 返回 null（调用方保持弹窗打开）", () => {
    const wrapper = mountForm(null);
    expect(payloadOf(wrapper)).toBeNull();
  });
});
