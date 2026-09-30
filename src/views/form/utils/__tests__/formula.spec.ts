import { describe, expect, it } from "vitest";
import type { FormField } from "@/api/dataset/dform";
import {
  assertFormulaAcyclic,
  FormulaError,
  formulaReferences,
  parseFormula,
  validateFormulaExpression
} from "../formula";
import {
  evaluateFormula,
  evaluateFormulaFields,
  formatFormulaValue
} from "../formulaEval";

/** 求值向量与后端 tests/unit/dataset/test_dform_formula.py 同口径（双端共享用例） */
const evalExpr = (expression: string, data: Record<string, unknown> = {}) =>
  evaluateFormula(
    parseFormula(expression),
    key => {
      const value = data[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    table => {
      const rows = data[table];
      return Array.isArray(rows)
        ? (rows as Array<Record<string, unknown>>)
        : [];
    }
  );

const field = (key: string, type: string, extra: Partial<FormField> = {}) =>
  ({ key, label: key, type, ...extra }) as FormField;

describe("求值（与后端同口径）", () => {
  it.each([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["10 / 4", 2.5],
    ["-2 + 5", 3],
    ["2 * -3", -6],
    ["1 - -1", 2],
    ["0.1 + 0.2", 0.3]
  ])("%s = %s", (expression, expected) => {
    expect(evalExpr(expression)).toBe(expected);
  });

  it("字段引用与 null 传播", () => {
    expect(evalExpr("{price} * {qty}", { price: 3, qty: 4 })).toBe(12);
    expect(evalExpr("{price} + 1", { price: null as unknown })).toBeNull();
    expect(evalExpr("{price} + 1", { price: "abc" })).toBeNull();
    expect(evalExpr("1 + {missing}")).toBeNull();
  });

  it("除零与聚合", () => {
    expect(evalExpr("1 / 0")).toBeNull();
    const rows = { items: [{ price: 1 }, { price: 2.5 }, {}] };
    expect(evalExpr("SUM({items.price})", rows)).toBe(3.5);
    expect(evalExpr("AVG({items.price})", rows)).toBe(1.75);
    expect(evalExpr("MIN({items.price})", rows)).toBe(1);
    expect(evalExpr("MAX({items.price})", rows)).toBe(2.5);
    expect(evalExpr("SUM({items.price})", { items: [] })).toBe(0);
    expect(evalExpr("AVG({items.price})", { items: [] })).toBeNull();
  });

  it("ROUND/ABS 与函数名大小写", () => {
    expect(evalExpr("ROUND(1.2345, 2)")).toBe(1.23);
    expect(evalExpr("round(2.5, 0)")).toBe(3);
    expect(evalExpr("ABS(-3.2)")).toBe(3.2);
  });

  it("引用展开", () => {
    const node = parseFormula("{a} + SUM({t.c})");
    expect(formulaReferences(node)).toEqual([
      ["a", null],
      ["t", "c"]
    ]);
  });
});

describe("语法校验", () => {
  it.each([
    "1 +",
    "{}",
    "{a",
    "* 2",
    "1 2",
    "SUM(1)",
    "{t.c} + 1",
    "UNKNOWN(1)",
    "ROUND()",
    "1 & 2"
  ])("拒绝：%s", expression => {
    expect(() => parseFormula(expression)).toThrow(FormulaError);
  });

  it("空表达式与超长", () => {
    expect(() => parseFormula("   ")).toThrow(FormulaError);
    expect(() => parseFormula("1 + ".repeat(150) + "1")).toThrow(FormulaError);
  });

  it("嵌套深度上限", () => {
    expect(() => parseFormula("(".repeat(30) + "1" + ")".repeat(30))).toThrow(
      FormulaError
    );
  });
});

describe("schema 级校验", () => {
  const fields: FormField[] = [
    field("price", "number"),
    field("name", "input"),
    field("items", "table", {
      columns: [
        { key: "amount", label: "金额", type: "number" },
        { key: "note", label: "备注", type: "input" }
      ]
    } as Partial<FormField>),
    field("total", "formula", { formula: "SUM({items.amount})" })
  ];

  it("合法引用通过", () => {
    expect(() =>
      validateFormulaExpression("{price} + {total}", fields, "grand")
    ).not.toThrow();
  });

  it("各类非法引用给出对应错误码", () => {
    const codes: Array<[string, string]> = [
      ["{ghost} + 1", "unknownField"],
      ["{name} + 1", "notNumeric"],
      ["SUM({ghost.x})", "unknownTable"],
      ["SUM({items.note})", "invalidColumn"],
      ["{self} + 1", "selfReference"]
    ];
    codes.forEach(([expression, code]) => {
      try {
        validateFormulaExpression(expression, fields, "self");
        throw new Error(`expected ${code}`);
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaError);
        expect((error as FormulaError).code).toBe(code);
      }
    });
  });

  it("循环引用检测", () => {
    const cyclic: FormField[] = [
      field("a", "formula", { formula: "{b} + 1" }),
      field("b", "formula", { formula: "{a} + 1" })
    ];
    expect(() => assertFormulaAcyclic(cyclic)).toThrow(FormulaError);
    expect(() => assertFormulaAcyclic(fields)).not.toThrow();
  });
});

describe("公式字段集合求值", () => {
  const fields: FormField[] = [
    field("price", "number"),
    field("qty", "number"),
    field("a", "formula", { formula: "{price} * 0.1" }),
    field("b", "formula", { formula: "{a} * 3" })
  ];

  it("嵌套公式取已 round 的终值", () => {
    const values = evaluateFormulaFields(fields, { price: 1, qty: 2 });
    expect(values.a).toBe(0.1);
    expect(values.b).toBe(0.3);
  });

  it("隐藏字段结果为 null（含依赖它的公式）", () => {
    const values = evaluateFormulaFields(
      fields,
      { price: 1, qty: 2 },
      new Set(["a"])
    );
    expect(values.a).toBeNull();
    expect(values.b).toBeNull();
  });
});

describe("展示格式化", () => {
  it("按精度格式化", () => {
    expect(formatFormulaValue(12, 2)).toBe("12.00");
    expect(formatFormulaValue(12.345, 1)).toBe("12.3");
    expect(formatFormulaValue(12, undefined)).toBe("12.00");
    expect(formatFormulaValue(null)).toBe("");
    expect(formatFormulaValue("abc")).toBe("");
  });
});
