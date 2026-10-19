import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  ElAlert,
  ElButton,
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElOptionGroup,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElText
} from "element-plus";

import type { FieldLookupNode, FieldRuleRow } from "./utils/types";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn(() => true)
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/components/RePlusPage", () => ({
  getDateTimePickerShortcuts: () => [],
  getPickerShortcuts: () => []
}));
vi.mock("@/components/SearchPicker", () => ({
  default: {
    name: "SearchPicker",
    template: "<div data-testid='search-picker' />"
  }
}));
vi.mock("./RuleFieldPicker.vue", () => ({
  default: { name: "RuleFieldPicker", template: "<div />" }
}));

import RuleEditForm from "./RuleEditForm.vue";

/** 关联对象类取值（表字段用户）：值控件走通讯录搜索选择器 */
const USER_TYPE = "value.table.user.ids";

const valuesData = [
  {
    label: "指定用户",
    value: USER_TYPE,
    group: "explicit",
    input: "user" as const,
    value_required: true,
    default_match: "in"
  }
];

const objectRule: FieldRuleRow = {
  table: "demo_book",
  field: "owner",
  match: "in",
  exclude: false,
  type: USER_TYPE,
  value: [{ pk: 1 }]
};

const mountForm = () =>
  mount(RuleEditForm, {
    props: {
      modelValue: objectRule,
      fieldLookupsData: [],
      valuesData
    },
    global: {
      components: {
        ElAlert,
        ElButton,
        ElDatePicker,
        ElInput,
        ElInputNumber,
        ElOption,
        ElOptionGroup,
        ElRadioButton,
        ElRadioGroup,
        ElSelect,
        ElText
      }
    }
  });

describe("RuleEditForm 关联对象取值的权限降级", () => {
  it("有搜索权限时渲染搜索选择器，保存按 pk 列表提交", async () => {
    mocks.hasAuth.mockReturnValue(true);
    const wrapper = mountForm();
    await wrapper.find('[data-testid="rule-save"]').trigger("click");

    expect(wrapper.find('[data-testid="search-picker"]').exists()).toBe(true);
    expect(wrapper.emitted("submit")).toHaveLength(1);
    const payload = wrapper.emitted(
      "update:modelValue"
    )?.[0]?.[0] as FieldRuleRow;
    expect(JSON.parse(String(payload.value))).toEqual([{ pk: 1 }]);
  });

  it("缺搜索权限时取值控件禁用并提示，保存被拦截不落裸字符串", async () => {
    mocks.hasAuth.mockReturnValue(false);
    const wrapper = mountForm();

    // 走不到搜索选择器分支，也不提供纯文本退化入口（禁用态 + 提示）
    expect(wrapper.find('[data-testid="search-picker"]').exists()).toBe(false);
    const valueRow = wrapper.find('[data-testid="rule-value"]');
    const disabledInput = valueRow.find("input.el-input__inner[disabled]");
    expect(disabledInput.exists()).toBe(true);
    expect(disabledInput.attributes("placeholder")).toBe(
      "systemPermission.editor.pickerAuthMissing"
    );

    await wrapper.find('[data-testid="rule-save"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(valueRow.text()).toContain(
      "systemPermission.editor.pickerAuthMissing"
    );
  });

  it("文本类取值不受搜索权限影响：仍可自由填写并保存", async () => {
    mocks.hasAuth.mockReturnValue(false);
    const wrapper = mount(RuleEditForm, {
      props: {
        modelValue: {
          table: "demo_book",
          field: "title",
          match: "exact",
          exclude: false,
          type: "value.text",
          value: ""
        },
        fieldLookupsData: [],
        valuesData: [
          {
            label: "文本",
            value: "value.text",
            group: "free",
            input: "text" as const,
            value_required: true,
            default_match: "exact"
          }
        ]
      },
      global: {
        components: {
          ElAlert,
          ElButton,
          ElDatePicker,
          ElInput,
          ElInputNumber,
          ElOption,
          ElOptionGroup,
          ElRadioButton,
          ElRadioGroup,
          ElSelect,
          ElText
        }
      }
    });

    await wrapper
      .find('input[placeholder="systemPermission.addValue"]')
      .setValue("abc");
    await wrapper.find('[data-testid="rule-save"]').trigger("click");
    expect(wrapper.emitted("submit")).toHaveLength(1);
    const payload = wrapper.emitted(
      "update:modelValue"
    )?.[0]?.[0] as FieldRuleRow;
    expect(payload.value).toBe("abc");
  });
});

/** 访问日志所在的应用 → 模型 → 字段树 */
const auditTree: FieldLookupNode[] = [
  {
    name: "audit",
    label: "审计",
    children: [
      {
        name: "audit.operationlog",
        label: "访问日志",
        children: [{ name: "username", label: "用户名" }]
      }
    ]
  }
];

const ruleTypes = [
  {
    label: "文本",
    value: "value.text",
    group: "free",
    input: "text" as const,
    value_required: true,
    default_match: "exact"
  },
  {
    label: "全部数据",
    value: "value.all",
    group: "all",
    input: "none" as const,
    value_required: false,
    default_match: "all"
  }
];

const mountRuleForm = (modelValue: FieldRuleRow) =>
  mount(RuleEditForm, {
    props: {
      modelValue,
      fieldLookupsData: auditTree,
      valuesData: ruleTypes
    },
    global: {
      components: {
        ElAlert,
        ElButton,
        ElDatePicker,
        ElInput,
        ElInputNumber,
        ElOption,
        ElOptionGroup,
        ElRadioButton,
        ElRadioGroup,
        ElSelect,
        ElText
      }
    }
  });

/** 通过取值方式下拉切换类型（与用户操作同路径） */
async function switchType(
  wrapper: ReturnType<typeof mountRuleForm>,
  value: string
) {
  const select = wrapper
    .get('[data-testid="rule-type"]')
    .findComponent(ElSelect);
  select.vm.$emit("update:modelValue", value);
  select.vm.$emit("change", value);
  await nextTick();
}

async function saveAndRead(
  wrapper: ReturnType<typeof mountRuleForm>
): Promise<FieldRuleRow> {
  await wrapper.find('[data-testid="rule-save"]').trigger("click");
  return wrapper.emitted("update:modelValue")?.[0]?.[0] as FieldRuleRow;
}

describe("RuleEditForm「全部数据」保留过滤对象", () => {
  it("已选具体表时切到全部数据，保存仍只作用于该表", async () => {
    const wrapper = mountRuleForm({
      table: "audit.operationlog",
      field: "username",
      match: "exact",
      exclude: false,
      type: "value.text",
      value: "admin"
    });

    await switchType(wrapper, "value.all");
    const payload = await saveAndRead(wrapper);

    expect(payload.table).toBe("audit.operationlog");
    expect(payload.field).toBe("*");
    expect(payload.match).toBe("all");
    expect(payload.type).toBe("value.all");
  });

  it("未选表时切到全部数据，才落为全部表", async () => {
    const wrapper = mountRuleForm({
      table: "",
      field: "",
      match: "",
      exclude: false,
      type: "",
      value: ""
    });

    await switchType(wrapper, "value.all");
    const payload = await saveAndRead(wrapper);

    expect(payload.table).toBe("*");
    expect(payload.field).toBe("*");
  });

  it("历史规则（具体表 + 非通配字段）回显后保存不丢表", async () => {
    const wrapper = mountRuleForm({
      table: "audit.operationlog",
      field: "id",
      match: "all",
      exclude: false,
      type: "value.all",
      value: ""
    });

    const payload = await saveAndRead(wrapper);

    expect(payload.table).toBe("audit.operationlog");
    expect(payload.field).toBe("*");
    expect(payload.type).toBe("value.all");
  });
});
