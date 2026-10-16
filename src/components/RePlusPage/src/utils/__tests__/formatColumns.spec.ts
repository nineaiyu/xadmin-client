import { describe, expect, it } from "vitest";
import { formatPageColumns } from "../formatColumns";
import type { PageTableColumn } from "../types";

/** 构造最小列（仅 _column.key 参与分派，其余字段由框架运行时填充） */
const column = (key?: string) =>
  ({ _column: key ? { key } : {} }) as PageTableColumn;

describe("formatPageColumns", () => {
  it("按 _column.key 命中处理器并就地改写列", () => {
    const name = column("name");
    formatPageColumns([name], {
      name: col => {
        col["minWidth"] = 200;
      }
    });
    expect(name["minWidth"]).toBe(200);
  });

  it("返回入参数组本身（页面 return columns 契约不变）", () => {
    const columns = [column("a")];
    expect(formatPageColumns(columns, {})).toBe(columns);
  });

  it("未命中的 key 与无 key 的列原样保留", () => {
    const other = column("other");
    const noKey = column();
    const hits: string[] = [];
    formatPageColumns([other, noKey], {
      target: () => hits.push("target")
    });
    expect(hits).toEqual([]);
    expect(other).not.toHaveProperty("cellRenderer");
    expect(noKey).not.toHaveProperty("cellRenderer");
  });

  it("同一处理器可挂多个 key（两级字典的 parent / parent_code 双形态）", () => {
    const calls: string[] = [];
    const handler = (col: PageTableColumn) =>
      calls.push(String(col._column.key));
    formatPageColumns([column("parent"), column("parent_code")], {
      parent: handler,
      parent_code: handler
    });
    expect(calls).toEqual(["parent", "parent_code"]);
  });

  it("逐列按序执行（列顺序即渲染顺序）", () => {
    const order: string[] = [];
    formatPageColumns([column("b"), column("a")], {
      a: () => order.push("a"),
      b: () => order.push("b")
    });
    expect(order).toEqual(["b", "a"]);
  });
});
