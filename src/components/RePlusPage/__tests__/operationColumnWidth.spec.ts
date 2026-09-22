import { describe, expect, it } from "vitest";
import {
  collectDataColumnWidths,
  resolveOperationColumnWidth,
  SELECTION_COLUMN_WIDTH,
  DEFAULT_COLUMN_WIDTH
} from "../src/utils/operationColumnWidth";

/** 取自 celery 定时任务页实测列宽（含多选列，不含操作列） */
const TASK_COLUMNS = [48, 80, 120, 120, 120, 120, 120, 120, 160, 120, 160, 120];

describe("resolveOperationColumnWidth", () => {
  it("无横向滚动（列宽合计 + 操作列最小宽 ≤ 容器）时保持页面配置宽度", () => {
    expect(resolveOperationColumnWidth(2000, TASK_COLUMNS, 300)).toBe(300);
    // 恰好放得下（≥ 判定为不滚动）
    expect(resolveOperationColumnWidth(1708, TASK_COLUMNS, 300)).toBe(300);
  });

  it("对齐加宽幅度在容差内时应用对齐（覆盖区左边界落到列边界）", () => {
    // 累计边界 48/128/248/368/488/608/728…；容器 800 - 300 = 500 → 对齐 488 → 312（+12）
    expect(resolveOperationColumnWidth(800, TASK_COLUMNS, 300)).toBe(312);
    // 恰好 +30（含容差边界）：818 - 488 = 330
    expect(resolveOperationColumnWidth(818, TASK_COLUMNS, 300)).toBe(330);
  });

  it("对齐加宽幅度超过容差时保持页面配置宽度（所见即配置）", () => {
    // 996 - 608 = 388（+88）；836 - 488 = 348（+48）；1200 - 848 = 352（+52）
    expect(resolveOperationColumnWidth(996, TASK_COLUMNS, 300)).toBe(300);
    expect(resolveOperationColumnWidth(836, TASK_COLUMNS, 300)).toBe(300);
    expect(resolveOperationColumnWidth(1200, TASK_COLUMNS, 300)).toBe(300);
    // +31（超容差 1px）：819 - 488 = 331 → 保持 300
    expect(resolveOperationColumnWidth(819, TASK_COLUMNS, 300)).toBe(300);
  });

  it("操作列配置较宽（>35% 容器）时按同一口径判定", () => {
    // 定时任务页：996 - 420 = 576 → 对齐边界 488 → 508（+88，超容差）→ 保持 420；
    // 可对齐边界占容器 49%，不得触发窄容器兜底
    expect(resolveOperationColumnWidth(996, TASK_COLUMNS, 420)).toBe(420);
  });

  it("极端窄容器（可对齐边界落在容器前 35% 以左）放弃对齐", () => {
    expect(resolveOperationColumnWidth(400, TASK_COLUMNS, 200)).toBe(200);
    expect(resolveOperationColumnWidth(300, TASK_COLUMNS, 200)).toBe(200);
  });

  it("容器未测量到或列未就绪时返回配置宽度", () => {
    expect(resolveOperationColumnWidth(0, TASK_COLUMNS, 200)).toBe(200);
    expect(resolveOperationColumnWidth(996, [], 200)).toBe(200);
  });
});

describe("collectDataColumnWidths", () => {
  it("过滤隐藏列与操作列，多选列取固定宽度", () => {
    const widths = collectDataColumnWidths([
      { type: "selection" },
      { width: 80 },
      { minWidth: 140 },
      { hide: true, width: 999 },
      { width: 200, _column: { key: "operation" } },
      { _column: { key: "name" } }
    ]);
    expect(widths).toEqual([
      SELECTION_COLUMN_WIDTH,
      80,
      140,
      DEFAULT_COLUMN_WIDTH
    ]);
  });

  it("容忍空列与非法宽度", () => {
    expect(
      collectDataColumnWidths([
        undefined,
        null,
        { width: "abc" },
        { minWidth: 0 }
      ])
    ).toEqual([DEFAULT_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH]);
  });
});
