// 首屏画像采集（体积之外的第二张表）：资源瀑布 + Long Task / TBT / LCP。
//
// 与 check-bundle-size.mjs 互补：体积门禁只看「静态闭包多少 KB」，本脚本看
// 「这些字节何时到、主线程被阻塞多久」——回答“首屏是否真的更快”。
//
// 运行前提：E2E 栈已在跑（vite dev + tests.settings_e2e 后端），
//   cd xadmin-client && E2E_API_PORT=18896 pnpm dev --port 8848 --strictPort
//   cd xadmin-server && DJANGO_SETTINGS_MODULE=tests.settings_e2e .venv/bin/python \
//     -m daphne -b 127.0.0.1 -p 18896 server.asgi:application
//
// 用法：
//   node scripts/firstscreen-profile.mjs                 # 打印读数
//   node scripts/firstscreen-profile.mjs --update        # 写入 e2e/perf-baseline.json 的 firstscreen 键
//   node scripts/firstscreen-profile.mjs --pages welcome # 只采一页
//
// 口径：chromium + 本机 dev 链路，与 e2e/perf.e2e.ts 同环境（数字只看同环境趋势）。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const BASELINE_FILE = join(root, "e2e", "perf-baseline.json");
const ENV_KEY = `${process.platform}-${process.env.CI ? "ci" : "local"}`;

const args = process.argv.slice(2);
const shouldUpdate = args.includes("--update");
const pagesFilter = args.includes("--pages")
  ? args[args.indexOf("--pages") + 1].split(",")
  : null;
const baseURL =
  process.env.E2E_BASE_URL ??
  `http://localhost:${process.env.E2E_FRONT_PORT ?? "8848"}`;
const ADMIN = {
  username: "xadmin",
  password: process.env.E2E_ADMIN_PASSWORD ?? "E2E-Admin-2026!"
};
/** 采集后稳定等待：懒加载卡片 / 图表动画仍会继续影响 LCP 与长任务 */
const SETTLE_MS = Number(process.env.PROFILE_SETTLE ?? "2500");

/** 采集候选页：入口（登录后落地）与最重的列表页（整页直达，口径=真实首屏） */
const PAGES = [
  { name: "welcome", path: "/" },
  { name: "system-user", path: "/system/user/index" }
].filter(p => !pagesFilter || pagesFilter.includes(p.name));

/** 注入到页面的采集器：LCP / Long Task / 导航与资源条目 */
const INIT_SCRIPT = () => {
  const w = window;
  w.__firstscreen = { lcp: 0, longtasks: [] };
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries())
        w.__firstscreen.lcp = Math.max(w.__firstscreen.lcp, e.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => {
      for (const e of list.getEntries())
        w.__firstscreen.longtasks.push({
          start: Math.round(e.startTime),
          duration: Math.round(e.duration),
          name: e.name,
          attribution:
            e.attribution?.[0]?.containerName ||
            e.attribution?.[0]?.containerType ||
            ""
        });
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* 不支持时保持零值，不阻断采集 */
  }
};

/** 从页面读取汇总读数（FCP / LCP / TBT 近似 / 长任务明细） */
const READ_SCRIPT = () => {
  const nav = performance.getEntriesByType("navigation")[0];
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  const fs = window.__firstscreen;
  // TBT 近似：FCP 之后、load 之前的 Long Task 超出 50ms 的累计
  const loadEnd = nav?.loadEventEnd ?? 0;
  const fcpTime = fcp?.startTime ?? 0;
  const blocking = (fs?.longtasks ?? []).filter(
    t => t.start >= fcpTime && (loadEnd === 0 || t.start <= loadEnd)
  );
  const tbt = blocking.reduce(
    (sum, t) => sum + Math.max(0, t.duration - 50),
    0
  );
  return {
    ttfb: Math.round(nav?.responseStart ?? 0),
    fcp: fcp ? Math.round(fcp.startTime) : null,
    lcp: fs?.lcp ? Math.round(fs.lcp) : null,
    dcl: Math.round(nav?.domContentLoadedEventEnd ?? 0),
    load: Math.round(loadEnd),
    tbt: Math.round(tbt),
    longTaskCount: fs?.longtasks?.length ?? 0,
    longTasks: [...(fs?.longtasks ?? [])]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
  };
};

/** 资源瀑布：CDP 事件按 requestId 归并出分类 / 大小 / 时序 */
function createNetworkCollector(cdp) {
  const byId = new Map();
  cdp.on("Network.requestWillBeSent", e => {
    byId.set(e.requestId, {
      url: e.request.url,
      type: e.type,
      start: Math.round(e.timestamp * 1000),
      priority: e.initialPriority ?? "",
      size: 0,
      status: 0,
      end: 0
    });
  });
  cdp.on("Network.responseReceived", e => {
    const r = byId.get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    r.mime = e.response.mimeType;
  });
  cdp.on("Network.loadingFinished", e => {
    const r = byId.get(e.requestId);
    if (!r) return;
    r.size = e.encodedDataLength ?? 0;
    r.end = Math.round(e.timestamp * 1000);
  });
  return {
    /** 按资源类型汇总（块数 / 总字节 / 最晚结束时刻） */
    summary() {
      const rows = [...byId.values()].filter(r => r.end > 0);
      const byType = new Map();
      for (const r of rows) {
        const key = r.type || "Other";
        const cur = byType.get(key) ?? { count: 0, bytes: 0, lastEnd: 0 };
        cur.count += 1;
        cur.bytes += r.size;
        cur.lastEnd = Math.max(cur.lastEnd, r.end);
        byType.set(key, cur);
      }
      return [...byType.entries()]
        .map(([type, v]) => ({
          type,
          count: v.count,
          kb: Math.round((v.bytes / 1024) * 10) / 10,
          lastEnd: v.lastEnd
        }))
        .sort((a, b) => b.bytes - a.bytes);
    },
    /** 首屏最重的 20 个请求（按字节） */
    heaviest(limit = 20) {
      return [...byId.values()]
        .filter(r => r.end > 0)
        .sort((a, b) => b.size - a.size)
        .slice(0, limit)
        .map(r => ({
          type: r.type,
          kb: Math.round((r.size / 1024) * 10) / 10,
          status: r.status,
          start: r.start,
          end: r.end,
          url: r.url.replace(baseURL, "").slice(0, 120)
        }));
    }
  };
}

async function collectPage(context, pageDef) {
  const page = await context.newPage();
  await page.addInitScript(INIT_SCRIPT);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const network = createNetworkCollector(cdp);

  // 整页直达（hash 路由整页 goto 才能真正采集「首屏」：资源瀑布从导航起算）
  await page.goto(pageDef.path === "/" ? "/" : `/#${pageDef.path}`);
  await page.waitForSelector("#main-content", { timeout: 20_000 });
  await page.waitForLoadState("load").catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);

  const metrics = await page.evaluate(READ_SCRIPT);
  const result = {
    ...metrics,
    waterfall: network.summary(),
    heaviest: network.heaviest()
  };
  await page.close();
  return result;
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL,
    locale: "zh-CN",
    // 与 e2e/helpers.ts 对齐：UA 影响后端临时 Token 与限流指纹
    userAgent: "e2e-test"
  });
  const page = await context.newPage();
  // 登录一次，后续页面复用同一 context（Cookie 生效）
  await page.goto("/#/login");
  await page.getByPlaceholder("账号").fill(ADMIN.username);
  await page.getByPlaceholder("密码").fill(ADMIN.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(u => !/#\/login/.test(u.href), { timeout: 30_000 });
  await page.goto("/");
  await page.waitForSelector("#main-content", { timeout: 20_000 });
  await page.close();

  const out = {};
  for (const def of PAGES) {
    const r = await collectPage(context, def);
    out[def.name] = r;
    console.log(
      `[firstscreen][${ENV_KEY}][${def.name}] ttfb=${r.ttfb} fcp=${r.fcp} ` +
        `lcp=${r.lcp} dcl=${r.dcl} load=${r.load} tbt=${r.tbt}ms ` +
        `longtasks=${r.longTaskCount}`
    );
    console.log("  瀑布:", JSON.stringify(r.waterfall));
    console.log("  最重请求:", JSON.stringify(r.heaviest.slice(0, 6)));
  }

  if (shouldUpdate) {
    const baseline = existsSync(BASELINE_FILE)
      ? JSON.parse(readFileSync(BASELINE_FILE, "utf-8"))
      : {};
    baseline.firstscreen = {
      ...(baseline.firstscreen ?? {}),
      [ENV_KEY]: out
    };
    writeFileSync(
      BASELINE_FILE,
      `${JSON.stringify(baseline, null, 2)}\n`,
      "utf-8"
    );
    console.log(
      `[firstscreen] 已写入 ${BASELINE_FILE} → firstscreen.${ENV_KEY}`
    );
  }

  await browser.close();
}

main().catch(err => {
  console.error("[firstscreen] 采集失败：", err);
  process.exit(1);
});
