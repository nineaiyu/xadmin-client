import { describe, expect, it } from "vitest";
import {
  buildLookupFields,
  buildLookupParams,
  collectLookupValues,
  defaultLookupForField,
  findLookupField,
  isEmptyLookupRow,
  lookupsForField,
  normalizeLookupForField,
  normalizeRowValue,
  parseLookupConditions,
  stripLookupConditions,
  type LookupRow
} from "../src/utils/advancedFilter";
import type { PageColumn } from "../src/utils/types";

/** 构造列元数据（只填高级筛选关心字段；`_column.key` 与 prop 同源） */
const column = (over: Record<string, unknown>): PageColumn => {
  const prop = String(over.prop ?? "field");
  return {
    prop,
    label: "字段",
    lookups: [],
    _column: { key: prop, label: "字段", input_type: "string" },
    ...over
  } as unknown as PageColumn;
};

const textColumn = column({
  prop: "username",
  label: "用户名",
  lookups: ["exact", "icontains", "startswith", "in", "isnull", "ne"]
});

const genderColumn = column({
  prop: "gender",
  label: "性别",
  lookups: ["exact", "in", "gte", "lte", "isnull", "ne"],
  _column: {
    key: "gender",
    label: "性别",
    input_type: "labeled_choice",
    choices: [
      { value: 0, label: "未知" },
      { value: 1, label: "男" },
      { value: 2, label: "女" }
    ]
  }
});

const activeColumn = column({
  prop: "is_active",
  label: "有效",
  lookups: ["exact", "isnull", "ne"],
  _column: { key: "is_active", label: "有效", input_type: "boolean" }
});

const joinedColumn = column({
  prop: "date_joined",
  label: "加入日期",
  lookups: ["exact", "in", "gte", "lte", "isnull", "ne"],
  _column: { key: "date_joined", label: "加入日期", input_type: "datetime" }
});

const rolesColumn = column({
  prop: "roles",
  label: "角色权限",
  lookups: ["exact", "in", "ne"],
  _column: {
    key: "roles",
    label: "角色权限",
    input_type: "m2m_related_field",
    multiple: true,
    choices: [{ pk: "r1", label: "管理员", value: "r1" }]
  }
});

const rawRelationColumn = column({
  prop: "creator",
  label: "创建人",
  lookups: ["exact", "icontains", "startswith", "in", "isnull", "ne"],
  _column: {
    key: "creator",
    label: "创建人",
    input_type: "object_related_field"
  }
});

describe("buildLookupFields（字段候选与联动能力）", () => {
  it("只保留后端下发 lookups 的列", () => {
    const fields = buildLookupFields([
      textColumn,
      column({
        prop: "avatar",
        label: "头像",
        _column: { key: "avatar", input_type: "string" }
      })
    ]);
    expect(fields.map(item => item.value)).toEqual(["username"]);
  });

  it("选择型字段收敛条件并带出选项（性别只有 等于/属于/不等于/为空）", () => {
    const [facet] = buildLookupFields([genderColumn]);
    expect(facet.kind).toBe("choice");
    expect(facet.multiple).toBe(false);
    expect(facet.lookups).toEqual(["exact", "in", "ne", "isnull"]);
    expect(facet.defaultLookup).toBe("exact");
    expect(facet.options).toEqual([
      { value: "0", label: "未知" },
      { value: "1", label: "男" },
      { value: "2", label: "女" }
    ]);
  });

  it("布尔字段只给 等于/不等于/为空 且默认 等于", () => {
    const [facet] = buildLookupFields([activeColumn]);
    expect(facet.kind).toBe("boolean");
    expect(facet.lookups).toEqual(["exact", "ne", "isnull"]);
    expect(facet.defaultLookup).toBe("exact");
  });

  it("日期字段默认 大于等于，且不出现文本类条件", () => {
    const [facet] = buildLookupFields([joinedColumn]);
    expect(facet.kind).toBe("datetime");
    expect(facet.defaultLookup).toBe("gte");
    expect(facet.lookups).not.toContain("icontains");
    expect(facet.lookups).not.toContain("startswith");
  });

  it("多值字段默认 属于 并标记 multiple", () => {
    const [facet] = buildLookupFields([rolesColumn]);
    expect(facet.multiple).toBe(true);
    expect(facet.defaultLookup).toBe("in");
    expect(facet.options).toEqual([{ value: "r1", label: "管理员" }]);
  });

  it("关联列未下发选项时退化为自由文本（不给出空下拉）", () => {
    const [facet] = buildLookupFields([rawRelationColumn]);
    expect(facet.kind).toBe("text");
  });

  it("查询字段名取元数据 key：列 prop 被详情渲染器改写成取值路径时仍下发接口字段名", () => {
    // 列表列的 prop 会被改成 `gender.value`（详情取值路径），查询参数必须用 key
    const polluted = { ...genderColumn, prop: "gender.value" } as PageColumn;
    const [facet] = buildLookupFields([polluted]);
    expect(facet.value).toBe("gender");
    expect(
      buildLookupParams([
        { field: facet.value, lookup: "exact", value: "1", values: [] }
      ]).params
    ).toEqual({
      gender__exact: "1"
    });
  });

  it("字段查询与默认条件回退", () => {
    const fields = buildLookupFields([genderColumn, joinedColumn]);
    expect(findLookupField(fields, "gender")?.label).toBe("性别");
    expect(findLookupField(fields, "missing")).toBeUndefined();
    expect(lookupsForField(fields, "gender")).toEqual([
      "exact",
      "in",
      "ne",
      "isnull"
    ]);
    expect(defaultLookupForField(fields, "date_joined")).toBe("gte");
    expect(defaultLookupForField(fields, "missing")).toBe("icontains");
  });
});

describe("normalizeLookupForField（字段切换后条件修正）", () => {
  const fields = buildLookupFields([textColumn, genderColumn, activeColumn]);

  it("不兼容的条件回到字段默认项", () => {
    const row: LookupRow = {
      field: "is_active",
      lookup: "icontains",
      value: "",
      values: []
    };
    expect(normalizeLookupForField(fields, row).lookup).toBe("exact");
  });

  it("兼容的条件保持不变", () => {
    const row: LookupRow = {
      field: "gender",
      lookup: "ne",
      value: "1",
      values: []
    };
    expect(normalizeLookupForField(fields, row).lookup).toBe("ne");
  });
});

describe("normalizeRowValue（取值规范化）", () => {
  it("isnull 只接受布尔字面量", () => {
    expect(
      normalizeRowValue({
        field: "is_active",
        lookup: "isnull",
        value: "true",
        values: []
      })
    ).toBe(true);
    expect(
      normalizeRowValue({
        field: "is_active",
        lookup: "isnull",
        value: "false",
        values: []
      })
    ).toBe(false);
    expect(
      normalizeRowValue({
        field: "is_active",
        lookup: "isnull",
        value: "1",
        values: []
      })
    ).toBeNull();
  });

  it("in 多值拼成逗号分隔的单参数（后端按单值 split）", () => {
    expect(
      normalizeRowValue({
        field: "roles",
        lookup: "in",
        value: "",
        values: ["r1", "r2", "r1"]
      })
    ).toBe("r1,r2");
    expect(
      normalizeRowValue({
        field: "username",
        lookup: "in",
        value: "a, b ,,c",
        values: []
      })
    ).toBe("a,b,c");
  });

  it("普通条件去空白原样下发，空值返回 null", () => {
    expect(
      normalizeRowValue({
        field: "username",
        lookup: "icontains",
        value: " 张三 ",
        values: []
      })
    ).toBe("张三");
    expect(
      normalizeRowValue({
        field: "username",
        lookup: "exact",
        value: "  ",
        values: []
      })
    ).toBeNull();
  });

  it("collectLookupValues 去重且优先 values", () => {
    expect(
      collectLookupValues({
        field: "f",
        lookup: "in",
        value: "a,b",
        values: ["b", "c"]
      })
    ).toEqual(["b", "c"]);
    expect(
      collectLookupValues({
        field: "f",
        lookup: "in",
        value: "a,a,b",
        values: []
      })
    ).toEqual(["a", "b"]);
  });

  it("空行判定", () => {
    expect(
      isEmptyLookupRow({
        field: "",
        lookup: "icontains",
        value: "",
        values: []
      })
    ).toBe(true);
    expect(
      isEmptyLookupRow({
        field: "username",
        lookup: "icontains",
        value: "",
        values: []
      })
    ).toBe(false);
    expect(
      isEmptyLookupRow({ field: "", lookup: "exact", value: "", values: [] })
    ).toBe(false);
  });
});

describe("buildLookupParams（条件行 → 查询参数）", () => {
  it("逐行拼装 field__lookup 参数（含多值与布尔）", () => {
    const { params, errors } = buildLookupParams([
      { field: "username", lookup: "icontains", value: "admin", values: [] },
      { field: "is_active", lookup: "isnull", value: "false", values: [] },
      { field: "roles", lookup: "in", value: "", values: ["r1", "r2"] },
      { field: "nickname", lookup: "ne", value: "test", values: [] }
    ]);
    expect(errors).toEqual([]);
    expect(params).toEqual({
      username__icontains: "admin",
      is_active__isnull: false,
      roles__in: "r1,r2",
      nickname__ne: "test"
    });
  });

  it("缺字段 / 缺值 / 重复条件逐行报错但不阻断其它行", () => {
    const { params, errors } = buildLookupParams([
      { field: "", lookup: "icontains", value: "x", values: [] },
      { field: "username", lookup: "icontains", value: "", values: [] },
      { field: "username", lookup: "icontains", value: "a", values: [] },
      { field: "username", lookup: "icontains", value: "b", values: [] },
      { field: "email", lookup: "exact", value: "e@x.com", values: [] }
    ]);
    expect(Object.keys(params)).toEqual([
      "username__icontains",
      "email__exact"
    ]);
    expect(errors).toEqual([
      { index: 0, code: "field" },
      { index: 1, code: "value" },
      { index: 3, code: "duplicate" }
    ]);
  });

  it("空行集合产出空参数", () => {
    expect(buildLookupParams([])).toEqual({ params: {}, errors: [] });
  });
});

describe("parseLookupConditions（条件快照 → 回显行）", () => {
  it("识别白名单 lookup 并按值形态还原（多值 / 布尔）", () => {
    const { rows } = parseLookupConditions({
      page: 1,
      size: 15,
      ordering: "-created_time",
      username__icontains: "admin",
      roles__in: ["r1", "r2"],
      is_active__isnull: false
    });
    expect(rows).toEqual([
      { field: "username", lookup: "icontains", value: "admin", values: [] },
      { field: "roles", lookup: "in", value: "", values: ["r1", "r2"] },
      { field: "is_active", lookup: "isnull", value: "false", values: [] }
    ]);
  });

  it("逗号串多值同样还原为多值形态", () => {
    const { rows } = parseLookupConditions({ roles__in: "r1,r2" });
    expect(rows[0].values).toEqual(["r1", "r2"]);
  });

  it("忽略非白名单 lookup（日期区间 _after/_before 等）与嵌套键", () => {
    const { rows } = parseLookupConditions({
      created_time__after: "2026-01-01",
      updated_time__before: "2026-02-01",
      user__dept__icontains: "x",
      ordering: "name"
    });
    expect(rows).toEqual([]);
  });

  it("已不在候选内的历史字段回填为 extraFields（条件不静默丢失）", () => {
    const fields = buildLookupFields([genderColumn]);
    const { rows, extraFields } = parseLookupConditions(
      { legacy_field__exact: "x", gender__exact: "1" },
      fields
    );
    expect(rows.map(row => row.field)).toEqual(["legacy_field", "gender"]);
    expect(extraFields.map(item => item.value)).toEqual(["legacy_field"]);
  });
});

describe("stripLookupConditions（清除既有高级筛选键）", () => {
  it("只删 lookup 键，保留分页与普通条件", () => {
    const result = stripLookupConditions({
      page: 2,
      size: 15,
      ordering: "-created_time",
      username: "admin",
      nickname__icontains: "x",
      roles__in: "r1",
      created_time_after: "2026-01-01"
    });
    expect(result).toEqual({
      page: 2,
      size: 15,
      ordering: "-created_time",
      username: "admin",
      created_time_after: "2026-01-01"
    });
  });
});
