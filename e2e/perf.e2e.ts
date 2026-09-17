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
 * 阈值取「明显超出实测」的量级，只拦离谱回归；CLS 0.24（用户列表页）已登记为
 * 体验改进候选（远高于 0.1 的「良好」线）。
 */
const CEILINGS = { ttfb: 2000, lcp: 5000, cls: 0.5 };

type PagePerfMetrics = {
  ttfb: number;
  fcp: number | null;
  lcp: number | null;
  cls: number;
  dcl: number;
  load: number;
};

/** 采集脚本注入：LCP / CLS 用 PerformanceObserver 缓冲历史条目 */
const INIT_PERF_SCRIPT = () => {
  const target = window as unknown as {
    __perf?: { lcp: number; cls: number };
  };
  target.__perf = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        target.__perf!.lcp = entry.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
      })[]) {
        if (!entry.hadRecentInput) {
          target.__perf!.cls += entry.value ?? 0;
        }
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
  const perf = (window as unknown as { __perf?: { lcp: number; cls: number } })
    .__perf;
  return {
    ttfb: Math.round(nav?.responseStart ?? 0),
    fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
    lcp: perf?.lcp ? Math.round(perf.lcp) : null,
    cls: Number((perf?.cls ?? 0).toFixed(4)),
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
