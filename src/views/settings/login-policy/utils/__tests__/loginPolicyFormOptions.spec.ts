import { describe, expect, it, vi } from "vitest";

import { useLoginPolicyFormOptions } from "../useLoginPolicyFormOptions";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));
vi.mock(
  "@/views/settings/login-policy/components/LoginPolicyTargetSelect.vue",
  () => ({
    default: { name: "LoginPolicyTargetSelect", render: () => null }
  })
);

type Column = Record<string, unknown> & {
  label?: string;
  valueType?: string;
  options?: Array<{ value: unknown; label: unknown }>;
  fieldProps?: Record<string, unknown>;
  renderField?: unknown;
};

const makeColumn = (key: string): Column => ({
  prop: key,
  _column: { key, input_type: "string" },
  fieldProps: {}
});

/** 取 columns 解析器（上下文只需 column） */
function resolveColumn(key: string) {
  const { addOrEditOptions } = useLoginPolicyFormOptions({
    t: (k: string) => k
  });
  const spec = addOrEditOptions.value?.props?.columns?.[key] as
    ((ctx: { column: Column }) => Column | undefined) | undefined;
  const column = makeColumn(key);
  const resolved = spec?.({ column });
  return { column: resolved ?? column, addOrEditOptions };
}

type Validator = (
  rule: unknown,
  value: unknown,
  callback: (error?: Error) => void
) => void;

const validate = (rule: Validator, value: unknown) =>
  new Promise<string>((resolve, reject) => {
    rule({}, value, error => (error ? reject(error.message) : resolve("")));
  });

describe("登录策略元数据表单微调", () => {
  it("weekdays：JSON 编辑器改为 1~7 多选（清空 renderField）", () => {
    const { column } = resolveColumn("weekdays");
    expect(column.renderField).toBeUndefined();
    expect(column.valueType).toBe("select");
    expect(column.fieldProps?.multiple).toBe(true);
    expect(column.options).toEqual([
      { value: 1, label: "loginPolicy.weekday1" },
      { value: 2, label: "loginPolicy.weekday2" },
      { value: 3, label: "loginPolicy.weekday3" },
      { value: 4, label: "loginPolicy.weekday4" },
      { value: 5, label: "loginPolicy.weekday5" },
      { value: 6, label: "loginPolicy.weekday6" },
      { value: 7, label: "loginPolicy.weekday7" }
    ]);
  });

  it("ip_ranges：textarea + 行数与占位提示", () => {
    const { column } = resolveColumn("ip_ranges");
    expect(column.valueType).toBe("textarea");
    expect(column.fieldProps?.rows).toBe(3);
    expect(column.fieldProps?.placeholder).toBe("loginPolicy.ipPlaceholder");
  });

  it("时段成对校验：只填一侧报错，两侧齐备放行", async () => {
    const { addOrEditOptions } = resolveColumn("start_time");
    const rules = (
      addOrEditOptions.value?.props?.formProps as {
        rules: (
          ctx: unknown
        ) => Record<string, Array<{ validator: Validator }>>;
      }
    ).rules({ rawFormProps: { rules: {} } });

    addOrEditOptions.value?.props?.dialogDrawerOptions?.onChange?.({
      options: {},
      index: 0,
      values: { values: { start_time: "10:00:00", end_time: "" } }
    } as never);

    await expect(
      validate(rules.start_time[0].validator, "10:00:00")
    ).rejects.toBe("loginPolicy.timePairInvalid");

    addOrEditOptions.value?.props?.dialogDrawerOptions?.onChange?.({
      options: {},
      index: 0,
      values: { values: { start_time: "10:00:00", end_time: "18:00:00" } }
    } as never);

    await expect(
      validate(rules.start_time[0].validator, "10:00:00")
    ).resolves.toBe("");
  });

  it("目标对象非 all 时 target_value 必填；all 时放行", async () => {
    const { addOrEditOptions } = resolveColumn("target_value");
    const rules = (
      addOrEditOptions.value?.props?.formProps as {
        rules: (
          ctx: unknown
        ) => Record<string, Array<{ validator: Validator }>>;
      }
    ).rules({ rawFormProps: { rules: {} } });

    addOrEditOptions.value?.props?.dialogDrawerOptions?.onChange?.({
      options: {},
      index: 0,
      values: { values: { target_type: { value: "role" }, target_value: " " } }
    } as never);
    await expect(validate(rules.target_value[0].validator, " ")).rejects.toBe(
      "loginPolicy.targetValueRequired"
    );

    addOrEditOptions.value?.props?.dialogDrawerOptions?.onChange?.({
      options: {},
      index: 0,
      values: { values: { target_type: { value: "all" }, target_value: "" } }
    } as never);
    await expect(validate(rules.target_value[0].validator, "")).resolves.toBe(
      ""
    );
  });

  it("beforeSubmit：空时段归一 null、weekdays 归一数字数组", () => {
    const { addOrEditOptions } = resolveColumn("name");
    const beforeSubmit = addOrEditOptions.value?.props?.beforeSubmit as (ctx: {
      formData: Record<string, unknown>;
    }) => Record<string, unknown>;
    const payload = beforeSubmit({
      formData: {
        start_time: "",
        end_time: null,
        target_type: { value: "role" },
        target_value: "  ops  ",
        weekdays: ["1", "3"]
      }
    });
    expect(payload.start_time).toBeNull();
    expect(payload.end_time).toBeNull();
    expect(payload.target_value).toBe("ops");
    expect(payload.weekdays).toEqual([1, 3]);
  });
});
