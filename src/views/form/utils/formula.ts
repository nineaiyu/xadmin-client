import type { FormField } from "@/api/dataset/dform";

/**
 * 动态表单公式字段：表达式解析与 schema 校验（求值见 ./formulaEval.ts；两份实现
 * 与后端 dataset/utils/dform_formula.py 同口径）。设计器/填写页/数据页共用。
 *
 * 语法 v1：
 *
 * ```
 * expr    := term (('+' | '-') term)*
 * term    := unary (('*' | '/') unary)*
 * unary   := '-' unary | primary
 * primary := NUMBER | REF | CALL | '(' expr ')'
 * REF     := '{' key '}' | '{' table '.' column '}'
 * CALL    := FUNC '(' expr (',' expr)* ')'
 * ```
 *
 * 语义约定（双端必须一致；服务端在提交时重算并覆盖，前端求值仅用于展示）：
 * - 标量引用 `{key}`：None/缺失/非数值（含布尔与字符串）→ null；
 * - 表格列引用 `{table.column}` 只能作为 SUM/AVG/MIN/MAX 的参数：逐行取列值，
 *   忽略空值与非数值；SUM 空集合为 0，AVG/MIN/MAX 空集合为 null；
 * - 二元运算任一操作数为 null → null；除数为 0 或 null → null；
 * - ROUND(x[, n])：n 为 0-6 整数字面量（缺省 2）；ABS(x)；参数为 null → null；
 * - 结果统一 round 到 6 位小数（half up，与 JS Math.round 同语义）；
 * - 嵌套公式按依赖顺序求值（被引用公式取已 round 的终值）。
 */

export const MAX_FORMULA_LENGTH = 500;
export const MAX_FORMULA_DEPTH = 25;
export const ROUND_DIGITS_MAX = 6;
export const ROUND_DIGITS_DEFAULT = 2;

export const AGGREGATE_FUNCS = ["SUM", "AVG", "MIN", "MAX"];

/** 公式校验错误（code 用于 i18n 文案，params 为文案插值） */
export class FormulaError extends Error {
  code: string;
  params: Record<string, string | number>;

  constructor(code: string, params: Record<string, string | number> = {}) {
    super(`formula:${code}:${JSON.stringify(params)}`);
    this.name = "FormulaError";
    this.code = code;
    this.params = params;
  }
}

export type FormulaNode =
  | { kind: "num"; value: number }
  | { kind: "ref"; key: string }
  | { kind: "col"; table: string; column: string }
  | { kind: "unary"; op: "-"; operand: FormulaNode }
  | {
      kind: "binary";
      op: "+" | "-" | "*" | "/";
      left: FormulaNode;
      right: FormulaNode;
    }
  | { kind: "call"; name: string; args: FormulaNode[] };

type Token = { kind: string; value?: number | string };

const NUMBER_RE = /^\d+(?:\.\d+)?/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/;

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/\d/.test(char)) {
      const match = NUMBER_RE.exec(expression.slice(index));
      if (!match) throw new FormulaError("invalid");
      tokens.push({ kind: "num", value: parseFloat(match[0]) });
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = IDENT_RE.exec(expression.slice(index));
      if (!match) throw new FormulaError("invalid");
      tokens.push({ kind: "ident", value: match[0] });
      index += match[0].length;
      continue;
    }
    if ("{}.,()+-*/".includes(char)) {
      tokens.push({ kind: char, value: char });
      index += 1;
      continue;
    }
    throw new FormulaError("invalid");
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

function checkCall(name: string, args: FormulaNode[]): FormulaNode {
  if (AGGREGATE_FUNCS.includes(name)) {
    if (args.length !== 1 || args[0].kind !== "col")
      throw new FormulaError("columnRequired");
    return { kind: "call", name, args };
  }
  if (name !== "ROUND" && name !== "ABS")
    throw new FormulaError("unknownFunction", { name });
  const range: [number, number] = name === "ROUND" ? [1, 2] : [1, 1];
  if (args.length < range[0] || args.length > range[1])
    throw new FormulaError("argCount", {
      name,
      range: `${range[0]}-${range[1]}`
    });
  if (name === "ROUND" && args.length === 2) {
    const digits = args[1];
    if (
      digits.kind !== "num" ||
      !Number.isInteger(digits.value) ||
      digits.value < 0 ||
      digits.value > ROUND_DIGITS_MAX
    )
      throw new FormulaError("roundDigits", { max: ROUND_DIGITS_MAX });
  }
  return { kind: "call", name, args };
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(kind: string): Token {
    const token = this.peek();
    if (token.kind !== kind) throw new FormulaError("invalid");
    return this.next();
  }

  parse(): FormulaNode {
    const node = this.expr(0);
    if (this.peek().kind !== "eof") throw new FormulaError("invalid");
    return node;
  }

  private expr(depth: number): FormulaNode {
    let node = this.term(depth);
    while (this.peek().kind === "+" || this.peek().kind === "-") {
      const op = this.next().kind as "+" | "-";
      node = { kind: "binary", op, left: node, right: this.term(depth) };
    }
    return node;
  }

  private term(depth: number): FormulaNode {
    let node = this.unary(depth);
    while (this.peek().kind === "*" || this.peek().kind === "/") {
      const op = this.next().kind as "*" | "/";
      node = { kind: "binary", op, left: node, right: this.unary(depth) };
    }
    return node;
  }

  private unary(depth: number): FormulaNode {
    if (this.peek().kind === "-") {
      this.next();
      return { kind: "unary", op: "-", operand: this.unary(depth) };
    }
    return this.primary(depth);
  }

  private primary(depth: number): FormulaNode {
    if (depth > MAX_FORMULA_DEPTH) throw new FormulaError("tooDeep");
    const token = this.peek();
    if (token.kind === "num") {
      this.next();
      return { kind: "num", value: token.value as number };
    }
    if (token.kind === "{") return this.ref();
    if (token.kind === "ident") {
      this.next();
      return this.call(String(token.value).toUpperCase(), depth);
    }
    if (token.kind === "(") {
      this.next();
      const node = this.expr(depth + 1);
      this.expect(")");
      return node;
    }
    throw new FormulaError("invalid");
  }

  private ref(): FormulaNode {
    this.expect("{");
    const key = String(this.expect("ident").value);
    if (this.peek().kind === ".") {
      this.next();
      const column = String(this.expect("ident").value);
      this.expect("}");
      return { kind: "col", table: key, column };
    }
    this.expect("}");
    return { kind: "ref", key };
  }

  private call(name: string, depth: number): FormulaNode {
    this.expect("(");
    const args: FormulaNode[] = [];
    if (this.peek().kind !== ")") {
      args.push(this.expr(depth + 1));
      while (this.peek().kind === ",") {
        this.next();
        args.push(this.expr(depth + 1));
      }
    }
    this.expect(")");
    return checkCall(name, args);
  }
}

function assertColumnUsage(node: FormulaNode, allowColumn = false): void {
  if (node.kind === "col") {
    if (!allowColumn) throw new FormulaError("columnUsage");
    return;
  }
  if (node.kind === "call") {
    if (AGGREGATE_FUNCS.includes(node.name)) return;
    node.args.forEach(arg => assertColumnUsage(arg));
    return;
  }
  if (node.kind === "unary") {
    assertColumnUsage(node.operand);
    return;
  }
  if (node.kind === "binary") {
    assertColumnUsage(node.left);
    assertColumnUsage(node.right);
  }
}

/** 语法校验并解析（抛 FormulaError） */
export function parseFormula(expression: string): FormulaNode {
  if (typeof expression !== "string" || !expression.trim())
    throw new FormulaError("required");
  if (expression.length > MAX_FORMULA_LENGTH)
    throw new FormulaError("tooLong", { max: MAX_FORMULA_LENGTH });
  const node = new Parser(tokenize(expression)).parse();
  assertColumnUsage(node);
  return node;
}

/** 展开表达式引用：[key, null] 为标量引用，[table, column] 为表格列引用 */
export function formulaReferences(
  node: FormulaNode
): Array<[string, string | null]> {
  const found: Array<[string, string | null]> = [];
  const walk = (item: FormulaNode): void => {
    if (item.kind === "ref") found.push([item.key, null]);
    else if (item.kind === "col") found.push([item.table, item.column]);
    else if (item.kind === "unary") walk(item.operand);
    else if (item.kind === "binary") {
      walk(item.left);
      walk(item.right);
    } else if (item.kind === "call") item.args.forEach(walk);
  };
  walk(node);
  return found;
}

/** 设计器用途：校验公式表达式与引用合法性（抛 FormulaError） */
export function validateFormulaExpression(
  expression: string,
  fields: FormField[],
  selfKey?: string
): FormulaNode {
  const node = parseFormula(expression);
  const numericTypes = ["number", "amount", "formula"];
  const fieldsByKey: Record<string, FormField> = {};
  fields.forEach(item => (fieldsByKey[item.key] = item));
  const tableColumns: Record<string, string[]> = {};
  fields.forEach(item => {
    if (item.type === "table")
      tableColumns[item.key] = (item.columns ?? [])
        .filter(column => column.type === "number")
        .map(column => column.key);
  });
  formulaReferences(node).forEach(([key, column]) => {
    if (column === null) {
      if (key === selfKey) throw new FormulaError("selfReference", { key });
      const target = fieldsByKey[key];
      if (!target) throw new FormulaError("unknownField", { key });
      if (!numericTypes.includes(target.type))
        throw new FormulaError("notNumeric", { key });
    } else {
      if (!(key in tableColumns))
        throw new FormulaError("unknownTable", { key });
      if (!tableColumns[key].includes(column))
        throw new FormulaError("invalidColumn", { table: key, column });
    }
  });
  return node;
}

/**
 * 设计器用途：全部公式字段的循环引用检测（抛 FormulaError('circular')）。
 *
 * 字段级语法/引用校验在属性弹窗完成；本函数在保存前对全图检测（与服务端
 * schema 校验同口径——把问题拦在提交前，报错给出环上字段链）。
 */
export function assertFormulaAcyclic(fields: FormField[]): void {
  const declarations: Record<string, FormField> = {};
  fields.forEach(item => {
    if (item.type === "formula") declarations[item.key] = item;
  });
  const graph: Record<string, string[]> = {};
  Object.keys(declarations).forEach(key => {
    const deps: string[] = [];
    try {
      formulaReferences(parseFormula(declarations[key].formula ?? "")).forEach(
        ([ref, column]) => {
          if (column === null && ref in declarations) deps.push(ref);
        }
      );
    } catch {
      // 语法错误由字段弹窗拦截；此处忽略，服务端兜底
    }
    graph[key] = deps;
  });
  const state: Record<string, number> = {};
  const visit = (node: string, path: string[]): void => {
    state[node] = 1;
    (graph[node] ?? []).forEach(nxt => {
      const mark = state[nxt] ?? 0;
      if (mark === 1) {
        const index = path.indexOf(nxt);
        const chain = (index >= 0 ? path.slice(index) : [nxt]).concat(nxt);
        throw new FormulaError("circular", { chain: chain.join(" -> ") });
      }
      if (mark === 0) visit(nxt, [...path, nxt]);
    });
    state[node] = 2;
  };
  Object.keys(graph).forEach(key => {
    if ((state[key] ?? 0) === 0) visit(key, [key]);
  });
}
