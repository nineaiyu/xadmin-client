import type { FormField } from "@/api/dataset/dform";
import {
  AGGREGATE_FUNCS,
  type FormulaNode,
  parseFormula,
  ROUND_DIGITS_DEFAULT
} from "./formula";

/**
 * 动态表单公式字段：求值（与 formula.ts 的解析器、后端 dataset/utils/dform_formula.py 同口径）。
 *
 * - 标量引用 {key}：null/缺失/非数值 → null；表格列引用只能作为 SUM/AVG/MIN/MAX 参数；
 * - 二元运算任一操作数为 null → null；除数为 0 或 null → null；ROUND/ABS 参数 null → null；
 * - 结果统一 round 到 6 位小数（half up，与 JS Math.round 同语义）；
 * - 嵌套公式按依赖顺序求值（被引用公式取已 round 的终值）。
 */

function scalarOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function roundSix(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) >= 1e18) return value;
  return Math.floor(value * 1e6 + 0.5) / 1e6;
}

type ScalarResolver = (key: string) => number | null;
type RowResolver = (table: string) => Array<Record<string, unknown>>;

function aggregate(
  name: string,
  node: Extract<FormulaNode, { kind: "col" }>,
  rowsOf: RowResolver
): number | null {
  const values: number[] = [];
  rowsOf(node.table).forEach(row => {
    if (row && typeof row === "object") {
      const number = scalarOf(row[node.column]);
      if (number !== null) values.push(number);
    }
  });
  if (name === "SUM") {
    let total = 0;
    values.forEach(value => {
      total += value; // 按行序累加：与服务端同序，结果一致
    });
    return total;
  }
  if (!values.length) return null;
  if (name === "AVG") {
    let total = 0;
    values.forEach(value => {
      total += value;
    });
    return total / values.length;
  }
  if (name === "MIN") return Math.min(...values);
  return Math.max(...values);
}

function evaluateNode(
  node: FormulaNode,
  scalarOfKey: ScalarResolver,
  rowsOf: RowResolver
): number | null {
  if (node.kind === "num") return node.value;
  if (node.kind === "ref") return scalarOfKey(node.key);
  if (node.kind === "col") return null;
  if (node.kind === "unary") {
    const value = evaluateNode(node.operand, scalarOfKey, rowsOf);
    return value === null ? null : -value;
  }
  if (node.kind === "binary") {
    const left = evaluateNode(node.left, scalarOfKey, rowsOf);
    const right = evaluateNode(node.right, scalarOfKey, rowsOf);
    if (left === null || right === null) return null;
    if (node.op === "+") return left + right;
    if (node.op === "-") return left - right;
    if (node.op === "*") return left * right;
    if (right === 0) return null;
    return left / right;
  }
  // call
  if (AGGREGATE_FUNCS.includes(node.name))
    return aggregate(
      node.name,
      node.args[0] as Extract<FormulaNode, { kind: "col" }>,
      rowsOf
    );
  const value = evaluateNode(node.args[0], scalarOfKey, rowsOf);
  if (value === null) return null;
  if (node.name === "ABS") return Math.abs(value);
  const digits =
    node.args.length === 2
      ? (node.args[1] as { kind: "num"; value: number }).value
      : ROUND_DIGITS_DEFAULT;
  const factor = 10 ** digits;
  if (Math.abs(value) >= 1e18 / factor) return value;
  return Math.floor(value * factor + 0.5) / factor;
}

/** 求值单个表达式（结果 round 到 6 位小数；null 表示空/不可计算） */
export function evaluateFormula(
  node: FormulaNode,
  scalarOfKey: ScalarResolver,
  rowsOf: RowResolver
): number | null {
  const value = evaluateNode(node, scalarOfKey, rowsOf);
  return value === null ? null : roundSix(value);
}

/**
 * 按依赖顺序求值全部 formula 字段（服务端提交同口径的前端镜像）。
 *
 * `data` 为表单当前取值；被隐藏（联动）的公式字段结果为 null；被引用的公式字段
 * 取已 round 的终值。表达式异常（理论上前端已校验）返回 null。
 */
export function evaluateFormulaFields(
  fields: FormField[],
  data: Record<string, unknown>,
  hidden?: Set<string>
): Record<string, number | null> {
  const hiddenKeys = hidden ?? new Set<string>();
  const declarations: Record<string, FormField> = {};
  fields.forEach(item => {
    if (item.type === "formula") declarations[item.key] = item;
  });
  const results: Record<string, number | null> = {};
  const resolving = new Set<string>();

  const rowsOf: RowResolver = table => {
    const rows = data[table];
    return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
  };

  const resolveFormula = (key: string): number | null => {
    if (key in results) return results[key];
    if (resolving.has(key)) return null;
    if (hiddenKeys.has(key)) {
      results[key] = null;
      return null;
    }
    resolving.add(key);
    let value: number | null = null;
    try {
      const node = parseFormula(declarations[key].formula ?? "");
      value = evaluateFormula(node, resolveScalar, rowsOf);
    } catch {
      value = null;
    } finally {
      resolving.delete(key);
    }
    results[key] = value;
    return value;
  };

  // 与 resolveFormula 相互引用：两者都在下方 forEach 触发前完成初始化
  const resolveScalar: ScalarResolver = key => {
    if (key in declarations) return resolveFormula(key);
    return scalarOf(data[key]);
  };

  Object.keys(declarations).forEach(key => resolveFormula(key));
  return results;
}

/** 公式字段的数值格式化（按 precision，缺省 2 位；null 显示空） */
export function formatFormulaValue(value: unknown, precision?: number): string {
  const number = scalarOf(value);
  if (number === null) return "";
  const digits =
    precision === undefined ? 2 : Math.max(0, Math.min(6, precision));
  return number.toFixed(digits);
}
