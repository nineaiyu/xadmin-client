import { ref } from "vue";
import { describe, expect, it } from "vitest";

import type { PageColumn } from "@/components/RePlusPage";
import { buildDelegationFormColumns } from "./delegationFormColumns";

const t = (key: string) => key;

function column(key: string): PageColumn {
  return {
    _column: { key },
    label: key,
    prop: key,
    fieldProps: {}
  } as PageColumn;
}

describe("委托表单列：流程必选规则", () => {
  it("规则写入表单级 addOrEditRules（实际校验消费面）", () => {
    const format = buildDelegationFormColumns({
      flowOptions: ref([]),
      isSuperuser: true,
      t
    });
    const addOrEditColumns = ref([column("flow_codes"), column("delegator")]);
    const addOrEditRules = ref<Record<string, unknown>>({});

    format({ addOrEditColumns, addOrEditRules });

    const rules = addOrEditRules.value.flow_codes as Array<
      Record<string, unknown>
    >;
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      required: true,
      type: "array",
      min: 1,
      trigger: "change"
    });
    // 双写：列级 rules 保留（渲染器兜底），两处口径一致
    expect(addOrEditColumns.value[0].rules).toEqual(rules);
  });

  it("非超管锁定委托人；流程列收敛为多选下拉", () => {
    const format = buildDelegationFormColumns({
      flowOptions: ref([{ label: "请假", value: "leave" }]),
      isSuperuser: false,
      t
    });
    const addOrEditColumns = ref([column("flow_codes"), column("delegator")]);
    const addOrEditRules = ref<Record<string, unknown>>({});

    format({ addOrEditColumns, addOrEditRules });

    const flowCol = addOrEditColumns.value[0];
    expect(flowCol.valueType).toBe("select");
    expect(flowCol.fieldProps).toMatchObject({ multiple: true });
    expect(addOrEditColumns.value[1].fieldProps).toMatchObject({
      disabled: true
    });
  });

  it("缺少规则容器时不报错（列级规则仍写入）", () => {
    const format = buildDelegationFormColumns({
      flowOptions: ref([]),
      isSuperuser: true,
      t
    });
    const addOrEditColumns = ref([column("flow_codes")]);

    expect(() => format({ addOrEditColumns })).not.toThrow();
    expect(addOrEditColumns.value[0].rules).toBeTruthy();
  });
});
