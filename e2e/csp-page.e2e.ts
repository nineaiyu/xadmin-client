import { expect, test, type Page } from "@playwright/test";

import { ADMIN, openMenuPath } from "./helpers";

/**
 * 页面层 CSP 隔离验证（发布门禁 T3「CSP 页面层 enforce」的判据可判化）。
 *
 * 按需运行：`pnpm test:e2e:csp`（E2E_CSP=1；脚本内先 `pnpm build`）
 *
 * 口径：构建产物 + **强制** CSP 头（`scripts/csp-page-server.mjs`，串与
 * `xadmin-web/default.conf` 强制头、`xadmin-server` `_CSP_DIRECTIVES` 三处同源）
 * + 真实浏览器（chromium/webkit）逐页采集 `securitypolicyviolation`：
 *
 * 1. 核心页面（登录壳 / 首页 / 列表 / 图表 / WS 聊天 / 富文本编辑器 / 设计器）
 *    必须**零违规**——这是「去掉 Report-Only」的直接前置证据；
 * 2. `/__csp_probe` 负对照页的内联脚本必须被拦截并采集到（证明采集链路有效，
 *    避免「零违规」其实是「采集没生效」的假绿）。
 *
 * 说明：
 * - 当前测试服不可达时无法靠真实流量累计「连续 7 天零违规」，本验证以
 *   「全量归因 + 隔离验证」替代观察窗口（与 2026-09-16 CSP 服务端切换同口径）；
 * - 双浏览器：生产构建的认证 Cookie 带 Secure（src/utils/auth.ts 的
 *   `import.meta.env.PROD` 分支），http 下 WebKit 拒收 Secure Cookie 无法登录——
 *   因此跑批默认 `E2E_CSP_TLS=1`（验证服务以 HTTPS 提供，openssl 自签 +
 *   ignoreHTTPSErrors 放行），复现 HTTPS 部署形态后 chromium 与 webkit 都可登录；
 *   http 兜底形态（E2E_CSP_TLS 未设）仅 chromium 可登录，此时双浏览器跑批中
 *   webkit 的页面会因无法登录而失败，属预期（勿据此判定 CSP 回归）。
 */

const CSP_TLS = process.env.E2E_CSP_TLS === "1";
const CSP_BASE = `${CSP_TLS ? "https" : "http"}://127.0.0.1:${
  process.env.E2E_CSP_PORT ?? "18899"
}`;

test.skip(
  process.env.E2E_CSP !== "1",
  "页面层 CSP 验证按需运行：pnpm test:e2e:csp"
);
test.skip(
  ({ browserName }) => browserName !== "chromium" && !CSP_TLS,
  "http 形态下 WebKit 拒收 Secure Cookie 无法登录（跑批默认 E2E_CSP_TLS=1）；" +
    "TLS 形态下 chromium 与 webkit 都参与验证（策略本身与引擎无关）"
);
// 本 spec 走「构建产物 + 强制 CSP 头」的独立服务（模拟 xadmin-web 形态），
// 覆盖 baseURL 后 helpers 的相对导航（login/openMenuPath）自动落到该服务
test.use({ baseURL: CSP_BASE });

type Violation = { directive: string; blocked: string; source: string };

/** 逐文档采集 CSP 违规（init script 在每次导航的新文档里重新挂载） */
const COLLECT_VIOLATIONS = () => {
  const target = window as unknown as { __cspViolations?: Violation[] };
  target.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", event => {
    target.__cspViolations!.push({
      directive: event.effectiveDirective,
      blocked: event.blockedURI,
      source: `${event.sourceFile ?? ""}:${event.lineNumber ?? 0}`
    });
  });
};

const readViolations = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __cspViolations: Violation[] }).__cspViolations
  );

/** 核心页面清单：覆盖外壳资源、列表页、图表、WS、富文本、设计器 */
const PAGES: Array<{ name: string; dirs: string[]; path: string }> = [
  { name: "welcome", dirs: [], path: "/" },
  { name: "system-user", dirs: ["系统管理"], path: "/system/user/index" },
  {
    name: "analysis-dashboard",
    dirs: ["数据分析"],
    path: "/analysis/dashboard/index"
  },
  { name: "chat", dirs: [], path: "/default/chat/index" },
  { name: "ai-knowledge", dirs: ["集成管理"], path: "/integration/ai/index" },
  {
    name: "dform-designer",
    dirs: ["表单采集"],
    path: "/form-collection/designer/index"
  }
];

/** 富文本编辑器所在页（编辑器在新增弹窗内初始化，单独一步） */
const EDITOR_PAGE = {
  name: "notice-editor",
  dirs: ["系统管理", "通知公告"],
  path: "/system/notice/index"
};

test("页面层 CSP：核心页面零违规 + 探针负对照命中", async ({ page }) => {
  await page.addInitScript(COLLECT_VIOLATIONS);

  // 服务端头形态自检：必须是强制头（无 Report-Only），否则本验证口径不成立
  const head = await page.request.get(`${CSP_BASE}/`);
  expect(
    head.headers()["content-security-policy"],
    "缺少强制 CSP 头"
  ).toBeTruthy();
  expect(
    head.headers()["content-security-policy-report-only"],
    "不应再有 Report-Only 头"
  ).toBeFalsy();

  const collected: Array<{ page: string; items: Violation[] }> = [];
  let seen = 0;
  const record = async (name: string) => {
    const all = await readViolations(page);
    collected.push({ page: name, items: all.slice(seen) });
    seen = all.length;
  };

  // 登录页（外壳：全部 vendor 资源 / 字体 / 图标）
  await page.goto("/#/login");
  await expect(page.getByPlaceholder("账号")).toBeVisible();
  await page.waitForTimeout(800);
  await record("login");

  // 登录：不复用 helpers.login（其内部再次 goto 登录页会让「同页二次登录」复用
  // 已消费的临时 Token，触发既有竞态，见 e2e/README），在当前文档内直接提交
  await page.getByPlaceholder("账号").fill(ADMIN.username);
  await page.getByPlaceholder("密码").fill(ADMIN.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  await record("after-login");

  for (const spec of PAGES) {
    await openMenuPath(page, spec.dirs, spec.path);
    await page.waitForTimeout(1200);
    await record(spec.name);
  }

  // 离线图标（2026-09-18）：菜单图标必须由本地注册表渲染——严格 CSP 下 connect-src
  // 不含任何外部主机，渲染出 SVG 即证明图标来自本地产物（随包注册 / 同源懒加载 chunk），
  // 而不是在线 Iconify API。
  if (PAGES.length) {
    // 侧边栏菜单图标由 `useRenderIcon(menu.meta.icon)` → LocalIcon → 离线图标组件渲染
    // （iconify v5 的 svg 不带 .iconify 类，用图标容器 .sub-menu-icon 定位）
    const sidebarIcons = page.locator(".sidebar-container .sub-menu-icon svg");
    await expect
      .poll(() => sidebarIcons.count(), {
        timeout: 10_000,
        message: "侧边栏菜单图标未渲染（离线图标注册/懒加载失效？）"
      })
      .toBeGreaterThan(0);
  }

  // 富文本编辑器（wangEditor）在弹窗内初始化：真实渲染一遍再收集
  await openMenuPath(page, EDITOR_PAGE.dirs, EDITOR_PAGE.path);
  await page.waitForTimeout(1000);
  await record(EDITOR_PAGE.name);
  await page.getByRole("button", { name: "新增" }).first().click();
  await expect(
    page.locator('[data-menu-key="uploadAttachment"]').first()
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await record("notice-editor-dialog");
  await page.keyboard.press("Escape");

  // 图标选择器（菜单管理 → 图标字段）：按需加载**同源**图标集 chunk 后渲染网格，
  // 严格 CSP（script-src 'self'）下能渲染即证明选择器也走离线本地图标集。
  // 菜单新增/编辑统一走右侧抽屉（ReDrawer），选择器渲染在抽屉内。
  await page.keyboard.press("Escape");
  await openMenuPath(page, ["系统管理"], "/system/menu/index");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "新增", exact: true }).first().click();
  const menuDrawer = page.locator(".el-drawer:visible").first();
  await expect(menuDrawer).toBeVisible({ timeout: 15_000 });
  await menuDrawer.locator(".selector .cursor-pointer").first().click();
  await expect
    .poll(() => page.locator(".icon-item svg").count(), {
      timeout: 15_000,
      message: "图标选择器未渲染（本地图标集懒加载失败？）"
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await record("menu-icon-picker");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // 负对照：探针页的内联脚本必须被拦截（脚本被拦 + 采集到违规）
  // 顺带验证页面层 report-uri 可达：原 `/api/csp-report` 缺 `common` 前缀，打到后端是 404
  // （2026-09-18 修正为 `/api/common/api/csp-report`，上报不再丢失）
  const reportReceived = page.waitForResponse(
    res => res.url().includes("/api/common/api/csp-report"),
    { timeout: 10_000 }
  );
  await page.goto("/__csp_probe");
  const report = await reportReceived;
  expect(report.status(), "页面层 report-uri 未达后端（期望 204）").toBe(204);
  const probe = await readViolations(page);
  const probeRan = await page.evaluate(
    () => (window as unknown as { __cspProbeRan?: boolean }).__cspProbeRan
  );
  expect(probeRan, "探针内联脚本竟被执行：强制头未生效").toBeFalsy();
  expect(
    probe.length,
    "探针页应命中至少一条违规（采集链路无效）"
  ).toBeGreaterThan(0);
  // 内联 <script> 的 effectiveDirective 在 Chrome 为 script-src-elem（回落 script-src）
  expect(
    probe.some(item => item.directive.startsWith("script-src")),
    `探针违规未落在 script-src：${JSON.stringify(probe)}`
  ).toBeTruthy();

  const violations = collected.flatMap(entry =>
    entry.items.map(item => ({ ...item, page: entry.page }))
  );
  if (violations.length) {
    console.log(`[csp-page] 违规 ${violations.length} 条：`);
    for (const item of violations) {
      console.log(
        `[csp-page]   ${item.page} directive=${item.directive} blocked=${item.blocked} ${item.source}`
      );
    }
  } else {
    console.log("[csp-page] 核心页面零违规（探针负对照已命中）");
  }
  expect(violations, "核心页面出现 CSP 违规，不能切强制头").toEqual([]);
});
