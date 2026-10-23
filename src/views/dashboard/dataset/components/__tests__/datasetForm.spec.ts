import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import DatasetForm from "../DatasetForm.vue";
import type { DatasetItem, DatasetMeta } from "@/api/dataset/datasets";

/**
 * 数据集表单（DatasetForm）单测。
 *
 * 核心回归：`op=in` 过滤的 value 以数组/tag 输入提交——值本身可包含逗号，
 * 不再做 join/split 往返（旧实现会拆散含逗号的值）。
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

const META: DatasetMeta = {
  models: ["system.userinfo"],
  fields: { "system.userinfo": ["username", "nickname"] }
};

const ROW: DatasetItem = {
  pk: "ds-1",
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
};

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
    wrapper.vm as {
      getPayload: () => Record<string, unknown> | null;
    }
  ).getPayload();

describe("DatasetForm op=in 过滤值", () => {
  it("编辑回显：数组 value 原样保留（不 join）", () => {
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

  it("含逗号的值保持完整，不做字符串拆分", () => {
    const row: DatasetItem = {
      ...ROW,
      filters: [{ field: "username", op: "in", value: ["a,b", "c"] }]
    };
    const wrapper = mountForm(row);
    const filters = payloadOf(wrapper)!.filters as Array<{
      value: unknown;
    }>;
    expect(filters[0].value).toEqual(["a,b", "c"]);
  });

  it("新建未填必填项：getPayload 返回 null（调用方保持弹窗打开）", () => {
    const wrapper = mountForm(null);
    expect(payloadOf(wrapper)).toBeNull();
  });
});
