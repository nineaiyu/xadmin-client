import { describe, expect, it } from "vitest";

import type { DashboardCard } from "@/api/system/datasets";
import { cardColSpan, cardColSpanNarrow } from "./span";

const card = (span?: number) => ({ span }) as Pick<DashboardCard, "span">;

describe("仪表盘卡片栅格换算", () => {
  it("12 栅格档位换算为 el-col 的 24 栅格", () => {
    expect(cardColSpan(card(3))).toBe(6);
    expect(cardColSpan(card(6))).toBe(12);
    expect(cardColSpan(card(9))).toBe(18);
    expect(cardColSpan(card(12))).toBe(24);
  });

  it("缺省 span 按 6（半宽）处理", () => {
    expect(cardColSpan(card())).toBe(12);
  });

  it("越界值钳制到 24，避免传给 el-col 非法栅格", () => {
    expect(cardColSpan(card(24))).toBe(24);
  });

  it("窄屏最多两列（≤12），宽卡不缩到两列以下", () => {
    expect(cardColSpanNarrow(card(3))).toBe(6);
    expect(cardColSpanNarrow(card(6))).toBe(12);
    expect(cardColSpanNarrow(card(12))).toBe(12);
  });
});
