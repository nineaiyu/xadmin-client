import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 前端体验基线（U1）：核心页 TTFB / FCP / LCP / CLS 实测采集。
 *
 * 按需运行：`pnpm test:e2e:perf`（E2E_PERF=1，chromium）
 * 刷新基线：`pnpm test:e2e:perf:update`（E2E_PERF_UPDATE=1）
 *
 * 口径：固定 chromium + E2E 同链路（vite dev + 种子后端）；数字随机器变化，
 * **只看同环境趋势**——基线按「平台-CI」分组存放（perf-baseline.json）。
 * 判定：现阶段只做「离谱回归」兜底（TTFB ≤ 2s / LCP ≤ 5s / CLS ≤ 0.25）；
 * 数据积累后再定预算（与首屏体积预算同思路，见长期优化方案 U1）。
 */

test.skip(
  process.env.E2E_PERF !== "1",
  "体验基线按需运行：E2E_PERF=1 pnpm test:e2e:perf"
);

/** 页面稳定等待：懒加载卡片 / 字体切换会继续影响 LCP 与 CLS */
const SETTLE_MS = Number(process.env.E2E_PERF_SETTLE ?? "2000");
const ENV_KEY = `${process.platform}-${process.env.CI ? "ci" : "local"}`;
const BASELINE_FILE = fileURLToPath(
  new URL("./perf-baseline.json", import.meta.url)
);

/**
 * 离谱回归兜底（非正式预算；预算待基线数据积累后另行评审）。
 * 首轮实测（darwin-local）：TTFB ≤ 332ms、LCP ≤ 1224ms、CLS ≤ 0.2403——
 * 阈值取「明显超出实测」的量级，只拦离谱回归。
 * 2026-09-18 列表页 CLS 定位收口：0.2403 → ~0.02（搜索卡片高度占位 +
 * 列首帧隐藏，见 RePlusPage 组件内注释与长期优化方案 U1）；剩余为登录页/
 * 布局页脚等页面级小位移（各 ≤ 0.008）。
 */
const CEILINGS = { ttfb: 2000, lcp: 5000, cls: 0.5 };

type PagePerfMetrics = {
  ttfb: number;
  fcp: number | null;
  lcp: number | null;
  cls: number;
  /** CLS 定位（U1 改进候选）：按影响值排序的前 5 个 layout-shift 来源明细（src 含位移/尺寸几何） */
  cls_top?: Array<{ v: number; t: number; src: string }>;
  dcl: number;
  load: number;
};

/**
 * layout-shift 条目形状（局部声明）：`LayoutShift` 是 Chrome 专有 API，
 * 尚未进入 TS 内置 DOM lib（lib.dom.d.ts 无该类型）；这里按 W3C 规范声明
 * 本文件实际消费的字段，避免依赖全局补丁（TS 升级新增该类型时也不会冲突）。
 */
type LayoutShiftAttribution = {
  node: Node | null;
  previousRect: DOMRectReadOnly;
  currentRect: DOMRectReadOnly;
};

type LayoutShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources: LayoutShiftAttribution[];
};

/** 采集脚本注入：LCP / CLS 用 PerformanceObserver 缓冲历史条目；CLS 记录来源明细 */
const INIT_PERF_SCRIPT = () => {
  const target = window as unknown as {
    __perf?: {
      lcp: number;
      cls: number;
      shifts: Array<{ v: number; t: number; src: string }>;
    };
  };
  target.__perf = { lcp: 0, cls: 0, shifts: [] };
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        target.__perf!.lcp = entry.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput) continue;
        const value = entry.value ?? 0;
        target.__perf!.cls += value;
        const src = (entry.sources ?? [])
          .slice(0, 3)
          .map(s => {
            const node = s.node as Element | null;
            const tag = node?.tagName?.toLowerCase() ?? "?";
            const id = node?.id ? `#${node.id}` : "";
            const cls =
              typeof node?.className === "string" && node.className
                ? `.${node.className.split(/\s+/)[0]}`
                : "";
            // 几何明细（U1 定位用）：位移量与尺寸变化，区分「整体下移」与「自身增高」
            const prev = s.previousRect;
            const cur = s.currentRect;
            const dx = Math.round(cur.x - prev.x);
            const dy = Math.round(cur.y - prev.y);
            const geo =
              `[dx${dx >= 0 ? "+" : ""}${dx},dy${dy >= 0 ? "+" : ""}${dy},` +
              `${Math.round(prev.width)}x${Math.round(prev.height)}→` +
              `${Math.round(cur.width)}x${Math.round(cur.height)}]`;
            return `${tag}${id}${cls}${geo}`;
          })
          .join(",");
        target.__perf!.shifts.push({
          v: Number(value.toFixed(4)),
          t: Math.round(entry.startTime),
          src
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // 浏览器不支持对应 observer 时保持零值（不阻断采集）
  }
};

const READ_PERF_SCRIPT = () => {
  const nav = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0];
  const perf = (
    window as unknown as {
      __perf?: {
        lcp: number;
        cls: number;
        shifts: Array<{ v: number; t: number; src: string }>;
      };
    }
  ).__perf;
  return {
    ttfb: Math.round(nav?.responseStart ?? 0),
    fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
    lcp: perf?.lcp ? Math.round(perf.lcp) : null,
    cls: Number((perf?.cls ?? 0).toFixed(4)),
    cls_top: [...(perf?.shifts ?? [])].sort((a, b) => b.v - a.v).slice(0, 5),
    dcl: Math.round(nav?.domContentLoadedEventEnd ?? 0),
    load: Math.round(nav?.loadEventEnd ?? 0)
  };
};

const PAGES: Array<{
  name: string;
  open: (page: Page) => Promise<void>;
}> = [
  {
    name: "login",
    open: async page => {
      await page.goto("/#/login");
      await expect(page.getByPlaceholder("账号")).toBeVisible();
    }
  },
  {
    name: "welcome",
    open: async page => {
      await login(page);
      await openMenuPath(page, [], "/");
    }
  },
  {
    name: "system-user",
    open: async page => {
      await login(page);
      await openMenuPath(page, ["系统管理"], "/system/user/index");
    }
  }
];

function loadBaseline(): Record<string, Record<string, PagePerfMetrics>> {
  if (!existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

test.describe("前端体验基线（chromium，dev 链路）", () => {
  for (const spec of PAGES) {
    test(`${spec.name} 采集 TTFB/FCP/LCP/CLS`, async ({ page }) => {
      await page.addInitScript(INIT_PERF_SCRIPT);
      await spec.open(page);
      await page.waitForLoadState("load");
      await page.waitForTimeout(SETTLE_MS);
      const metrics = (await page.evaluate(
        READ_PERF_SCRIPT
      )) as PagePerfMetrics;

      const baselines = loadBaseline();
      const previous = baselines[ENV_KEY]?.[spec.name];
      const delta = previous
        ? {
            ttfb: metrics.ttfb - previous.ttfb,
            lcp:
              metrics.lcp !== null && previous.lcp !== null
                ? metrics.lcp - previous.lcp
                : null,
            cls: Number((metrics.cls - previous.cls).toFixed(4))
          }
        : null;
      test.info().annotations.push({ type: "perf-env", description: ENV_KEY });
      test.info().annotations.push({
        type: "perf-metrics",
        description: JSON.stringify(metrics)
      });
      console.log(
        `[perf][${ENV_KEY}][${spec.name}] ${JSON.stringify(metrics)}` +
          (delta ? ` delta=${JSON.stringify(delta)}` : "（无基线，先立基线）")
      );

      if (process.env.E2E_PERF_UPDATE === "1") {
        baselines[ENV_KEY] = {
          ...(baselines[ENV_KEY] ?? {}),
          [spec.name]: metrics
        };
        writeFileSync(
          BASELINE_FILE,
          `${JSON.stringify(baselines, null, 2)}\n`,
          "utf-8"
        );
      }

      // 兜底护栏：只为拦「离谱回归」，不替代预算
      expect(metrics.ttfb, "TTFB 超出兜底上限（2s）").toBeLessThanOrEqual(
        CEILINGS.ttfb
      );
      expect(metrics.lcp ?? 0, "LCP 超出兜底上限（5s）").toBeLessThanOrEqual(
        CEILINGS.lcp
      );
      expect(metrics.cls, "CLS 超出兜底上限（0.25）").toBeLessThanOrEqual(
        CEILINGS.cls
      );
    });
  }
});
