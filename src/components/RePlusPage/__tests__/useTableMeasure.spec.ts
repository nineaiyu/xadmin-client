import { describe, expect, it } from "vitest";

import {
  DEFAULT_ADAPTIVE_OFFSET_BOTTOM,
  MIN_ADAPTIVE_TABLE_HEIGHT,
  resolveAdaptiveHeight,
  resolveContentSlack
} from "../src/utils/tableMeasureMath";

/**
 * 自适应高度的稳态解：`avail = 当前高度 + 闲置量`，
 * `next = clamp(min(期望高度, avail), 最小可用高度)`。
 *
 * 闲置量带符号：正 = 容器还有空闲（可增长）、负 = 内容已溢出（需收缩）、
 * 0 = 恰好占满（保持不动）。
 */
describe("resolveAdaptiveHeight（稳态解）", () => {
  it("还有空闲：增长到期望高度（空闲足够时不越过期望值）", () => {
    expect(resolveAdaptiveHeight(500, 547, 61)).toBe(547);
  });

  it("还有空闲但幅度不足：增长到把空闲用尽", () => {
    expect(resolveAdaptiveHeight(500, 1200, 61)).toBe(561);
  });

  it("内容已溢出：收缩到刚好填满容器", () => {
    expect(resolveAdaptiveHeight(586, 547, -39)).toBe(547);
  });

  it("恰好占满（闲置量为 0）：保持当前高度，不增长也不收缩", () => {
    expect(resolveAdaptiveHeight(400, 547, 0)).toBe(400);
  });

  it("期望高度更小且有空闲：取期望高度（不越过可用空间估计）", () => {
    expect(resolveAdaptiveHeight(500, 520, 100)).toBe(520);
  });

  it("测量不到内容容器（null）时按期望高度处理", () => {
    expect(resolveAdaptiveHeight(300, 320, null)).toBe(320);
  });

  it("异常闲置值（NaN）按期望高度处理", () => {
    expect(resolveAdaptiveHeight(300, 320, Number.NaN)).toBe(320);
  });

  it("溢出无法消除时钳到最小可用高度", () => {
    expect(resolveAdaptiveHeight(260, 200, -124)).toBe(
      MIN_ADAPTIVE_TABLE_HEIGHT
    );
  });
});

/**
 * 收敛不变式（防「抖两次」与每帧互推）：把解写回后按线性关系重算闲置量
 * （表格变高 = 闲置量等量减少），再次求解必须得到同一取值——否则高度会在
 * 两个状态间来回跳。
 */
describe("resolveAdaptiveHeight 收敛性", () => {
  const cases = [
    { name: "空闲增长到期望", height: 500, desired: 547, slack: 61 },
    { name: "空闲用尽", height: 500, desired: 1200, slack: 61 },
    { name: "溢出收缩", height: 586, desired: 547, slack: -39 },
    { name: "恰好占满", height: 400, desired: 547, slack: 0 },
    { name: "最小高度钳制", height: 260, desired: 200, slack: -124 }
  ];

  for (const item of cases) {
    it(`${item.name}：写回后取值不变`, () => {
      const next = resolveAdaptiveHeight(item.height, item.desired, item.slack);
      // 高度变化量按 1:1 反向反映到闲置量上
      const slackAfter = item.slack - (next - item.height);
      expect(resolveAdaptiveHeight(next, item.desired, slackAfter)).toBe(next);
    });
  }
});

/** 内容容器闲置量实测（`#main-content` 即内容区滚动容器内的 flex 内容块） */
describe("resolveContentSlack", () => {
  const stubBox = (el: Element, top: number, bottom: number) => {
    el.getBoundingClientRect = () =>
      ({
        top,
        bottom,
        left: 0,
        right: 0,
        width: bottom - top,
        height: bottom - top,
        x: 0,
        y: top,
        toJSON: () => ({})
      }) as DOMRect;
  };

  const buildPage = (children: number) => {
    document.body.innerHTML = `<div id="main-content">${Array.from(
      { length: children },
      (_, index) => `<div class="page-${index}"></div>`
    ).join("")}</div>`;
    const container = document.getElementById("main-content") as HTMLElement;
    Object.defineProperty(container, "clientHeight", {
      value: 785,
      configurable: true
    });
    // 容器自身从视口 91 起、内容底 876（页脚顶）
    stubBox(container, 91, 876);
    return container;
  };

  it("内容未占满：返回正闲置量（容器可分配高 - 内容实际占用）", () => {
    const container = buildPage(1);
    stubBox(container.firstElementChild as HTMLElement, 115, 815);
    expect(resolveContentSlack(container.firstElementChild)).toBe(61);
  });

  it("内容已超出容器：返回负闲置量", () => {
    const container = buildPage(1);
    stubBox(container.firstElementChild as HTMLElement, 115, 900);
    expect(resolveContentSlack(container.firstElementChild)).toBe(-24);
  });

  it("多个子节点时取底边最大值（弹窗等脱离文档流的子节点不参与）", () => {
    const container = buildPage(2);
    stubBox(container.children[0] as HTMLElement, 115, 815);
    stubBox(container.children[1] as HTMLElement, 0, 0);
    expect(resolveContentSlack(container.children[0] as HTMLElement)).toBe(61);
  });

  it("取不到内容容器（如弹窗/内嵌表格）时返回 null", () => {
    document.body.innerHTML = `<div class="standalone"></div>`;
    expect(resolveContentSlack(document.querySelector(".standalone"))).toBe(
      null
    );
    expect(resolveContentSlack(null)).toBe(null);
  });
});

describe("DEFAULT_ADAPTIVE_OFFSET_BOTTOM", () => {
  it("保持列表页直铺口径的预留值", () => {
    expect(DEFAULT_ADAPTIVE_OFFSET_BOTTOM).toBe(110);
  });
});
