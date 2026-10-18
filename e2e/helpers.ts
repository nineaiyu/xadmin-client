import {
  expect,
  type BrowserContext,
  type Locator,
  type Page
} from "@playwright/test";

/**
 * E2E 公共助手：凭据与登录/登出/菜单导航。
 * 凭据与 xadmin-server/scripts/e2e_seed.py 的种子数据保持一致。
 */

/** 后端直连地址（page.request 越权断言用）；与 playwright.config.ts 的 E2E_API_PORT 对齐 */
export const BACKEND_URL =
  process.env.E2E_API_URL ??
  `http://127.0.0.1:${process.env.E2E_API_PORT ?? "8896"}`;

/**
 * 前端同源地址（携带浏览器 Cookie 的 API 断言必须走同源）。
 * 跨域直连 BACKEND_URL 不会带 Cookie，无 Authorization 头的请求一律 401，
 * 越权断言另见 BACKEND_URL（显式带 Bearer token）。
 */
export const FRONT_URL =
  process.env.E2E_BASE_URL ??
  `http://localhost:${process.env.E2E_FRONT_PORT ?? "8848"}`;

/** 应用 WebSocket 路径（vite dev 的 HMR 也会建 ws，断言前需按此前缀过滤） */
const APP_WS_PATTERN = /\/ws\/message\//;

/**
 * E2E 统一 User-Agent：后端限流与临时 Token 的 request ident 均含 UA，
 * 同一链路内必须保持一致，否则会被判为不同客户端。
 */
export const E2E_USER_AGENT = "e2e-test";

export const ADMIN = { username: "xadmin", password: "E2E-Admin-2026!" };
/** 审批人（第二超管）：申请人不能自审，审批中心用例以其身份通过审批单 */
export const APPROVER = {
  username: "e2e_approver",
  password: "E2E-Approver-2026!"
};
export const PLAIN_USER = {
  username: "e2e_user",
  /** 显示名快照断言用（轨迹/审批人列等按昵称展示，见 e2e_seed 种子） */
  nickname: "E2E普通用户",
  password: "E2E-User-2026!"
};
export const SCOPED_USER = {
  username: "e2e_scoped",
  password: "E2E-Scoped-2026!"
};
/** 数据权限场景：用户列表仅可见本人（种子 DataPermission「E2E-仅本人用户数据」） */
export const DP_USER = { username: "e2e_dp", password: "E2E-DataPerm-2026!" };
/** 部门主管场景：用户列表可见本人 + 主管部门成员（种子 DataPermission「E2E-主管部门成员」） */
export const LEADER_USER = {
  username: "e2e_leader",
  password: "E2E-Leader-2026!"
};
/** e2e_leader 主管测试部门的成员（列表可见性断言对象） */
export const LEADER_MEMBER_USERNAME = "e2e_member";
/** 字段权限场景：用户列表隐藏邮件列（种子 FieldPermission，角色 e2e_fp） */
export const FP_USER = { username: "e2e_fp", password: "E2E-FieldPer-2026!" };
/** 登录锁定场景专用账号（用例内会连续输错密码） */
export const LOCK_USER = { username: "e2e_lock", password: "E2E-Lock-2026!" };

export type Credentials = { username: string; password: string };

/**
 * 高负载档：CI（`CI=1`）或并行分片跑批（`E2E_PARALLEL>1`）。
 *
 * 这两档下登录、导出下载等链路会显著变慢，历史上有「仅 webkit 失败、retries 内重跑即过」
 * 的负载型瞬态记录（见 e2e/README.md「历史教训速查」）。本地串行跑批不启用本档，
 * 保持严格上限，让真回归第一时间暴露。
 */
export const HIGH_LOAD = Boolean(process.env.CI || process.env.E2E_PARALLEL);

/** 下载事件（导出 xlsx/CSV）等待上限：高负载档放宽，避免把「机器忙」记成回归。 */
export const DOWNLOAD_TIMEOUT = HIGH_LOAD ? 90_000 : 30_000;

/**
 * 抽屉/面板内交互的「可见且稳定」等待上限：面板内容异步渲染（权限分区、试算结果）
 * 期间元素持续位移，默认 10s 会被高负载档打穿（2026-09-25 全量并行 preview 实测：
 * 点击 `.el-select` 稳定等待超时、隔离复跑通过）。
 */
export const PANEL_ACTION_TIMEOUT = HIGH_LOAD ? 30_000 : 10_000;

/** 站点配置列表接口：语言（Locale）等跨用例共享状态的自愈/还原用 */
const SITE_CONFIG_LIST_API = `${FRONT_URL}/api/system/config/system`;

/**
 * 语言自愈：站点配置的 Locale 是跨用例共享状态，locale 用例一旦失败（还原链路
 * 被 token/防抖时序打断）可能把英文留给后续 spec，后续中文定位器（菜单/按钮/
 * placeholder）会成批失配（曾被误判为 webkit flaky）。登录后统一校正为中文：
 * 仅在检测到非中文时写回并 reload，让当前页面按中文重新挂载。失败静默不阻塞用例。
 */
async function healSharedLocale(page: Page) {
  try {
    const resp = await page.request.get(
      `${SITE_CONFIG_LIST_API}?key=WEB_SITE_CONFIG`
    );
    const rows = (await resp.json())?.data?.results ?? [];
    const row = Array.isArray(rows)
      ? rows.find(item => item.key === "WEB_SITE_CONFIG")
      : undefined;
    if (!row) return;
    const value =
      typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    if (!value || value.Locale === "zh") return;
    await page.request.patch(`${SITE_CONFIG_LIST_API}/${row.pk}`, {
      data: { value: { ...value, Locale: "zh" } }
    });
    // 写回后当前页面仍是旧语言渲染，reload 让 ensureLocale 以中文重新挂载
    await page.reload();
    await expect(page.locator("#header-translation")).toBeVisible({
      timeout: 15_000
    });
  } catch {
    // 自愈失败不阻塞用例（真实问题由用例断言暴露）
  }
}

/**
 * 会话复用（跑批提速）：以 API 取号 + 注入凭据 Cookie 代替每个用例的表单登录。
 *
 * 背景：全量档 648 条结果、每条都要走「表单填写 → 登录 POST → 跳转 → 拉路由」约
 * 1.6~3.2s（CI 高负载下更久），累计占跑批时长的三成以上；而且登录链路本身是负载
 * 抖动的高发点（历史 flaky 多数卡在「登录后未离开 #/login」）。
 *
 * 实现：
 * - `POST /api/identity/login/basic` 直接取 token（E2E 档关加密与验证码，
 *   真实登录接口、真实会话登记）；
 * - 注入 `X-Token` / `X-Refresh-Token` / `multiple-tabs` 三枚 Cookie（与
 *   `src/utils/auth.ts::setToken` 同口径，缺少 multiple-tabs 路由守卫不会认已登录）；
 * - token 在进程内缓存复用（access 1h / refresh 15 天），超过 45 分钟重新取号，
 *   避免「每个用例一次登录请求」撞登录限流；
 * - 任何一步失败（接口异常 / 会话被逐出 / 页面没进应用壳）都回落到真实表单登录，
 *   保证用例语义不变；`E2E_SESSION_REUSE=0` 可整体关闭以便隔离排查登录链路。
 */
const SESSION_REUSE_ENABLED = process.env.E2E_SESSION_REUSE !== "0";
/** 取号缓存有效期：access token 1h，留足余量（refresh 15 天照常兜底续期） */
const SESSION_CACHE_MS = 45 * 60 * 1000;
type CachedAdminAuth = {
  access: string;
  refresh: string;
  accessLifetime: number;
  refreshLifetime: number;
  at: number;
};
/**
 * 取号缓存按浏览器上下文隔离。
 *
 * 进程级共享 refresh token 时，同一 shard 内任一 context 触发刷新都会轮换并
 * 拉黑旧 refresh token，其他 context 随后拿着旧 token 续期，日志里表现为成批
 * 「令牌已被加入黑名单」+ 跳登录页（全量并行下的登录类 flaky）。按 context
 * 缓存后每个用例拿到独立会话；同一 context 内重复 login() 仍复用，不增加
 * 登录请求数量级。
 */
const adminAuthCache = new WeakMap<BrowserContext, CachedAdminAuth>();

async function acquireAdminAuth(page: Page) {
  const cached = adminAuthCache.get(page.context());
  if (cached && Date.now() - cached.at < SESSION_CACHE_MS) {
    return cached;
  }
  // 临时令牌与登录两步的客户端指纹必须完全一致（UA + Accept + IP 参与 ident 计算），
  // 因此两请求显式带同一组头；临时令牌一次性消费，每次取号都要重新申请
  const headers = { "User-Agent": E2E_USER_AGENT, Accept: "application/json" };
  const tempResp = await page.request.get(
    `${FRONT_URL}/api/identity/auth/token`,
    { headers }
  );
  const tempBody = (await tempResp.json().catch(() => ({}))) as {
    token?: string;
    data?: { token?: string };
  };
  const tempToken = tempBody?.token ?? tempBody?.data?.token ?? "";
  if (!tempResp.ok() || !tempToken) {
    throw new Error(
      `临时令牌获取失败：HTTP ${tempResp.status()} ${JSON.stringify(tempBody).slice(0, 200)}`
    );
  }
  const resp = await page.request.post(
    `${FRONT_URL}/api/identity/login/basic`,
    {
      headers,
      data: {
        username: ADMIN.username,
        password: ADMIN.password,
        token: tempToken
      }
    }
  );
  const body = (await resp.json().catch(() => ({}))) as {
    data?: {
      access?: string;
      refresh?: string;
      access_token_lifetime?: number;
      refresh_token_lifetime?: number;
    };
  };
  const data = body?.data ?? {};
  if (!resp.ok() || !data.access || !data.refresh) {
    throw new Error(
      `会话取号失败：HTTP ${resp.status()} ${JSON.stringify(body).slice(0, 200)}`
    );
  }
  const auth: CachedAdminAuth = {
    access: data.access,
    refresh: data.refresh,
    accessLifetime: data.access_token_lifetime ?? 3600,
    refreshLifetime: data.refresh_token_lifetime ?? 15 * 24 * 3600,
    at: Date.now()
  };
  adminAuthCache.set(page.context(), auth);
  return auth;
}

/** 注入登录 Cookie 并引导至应用壳；会话不可用返回 false（由调用方回落表单登录） */
async function trySessionLogin(page: Page): Promise<boolean> {
  try {
    const cookies = await page.context().cookies();
    const hasAccess = cookies.some(cookie => cookie.name === "X-Token");
    const hasRefresh = cookies.some(
      cookie => cookie.name === "X-Refresh-Token"
    );
    if (!hasAccess || !hasRefresh) {
      const auth = await acquireAdminAuth(page);
      const now = Math.floor(Date.now() / 1000);
      await page.context().addCookies([
        {
          name: "X-Token",
          value: auth.access,
          url: FRONT_URL,
          expires: now + Math.max(auth.accessLifetime - 10, 60),
          sameSite: "Lax"
        },
        {
          name: "X-Refresh-Token",
          value: auth.refresh,
          url: FRONT_URL,
          expires: now + Math.max(auth.refreshLifetime - 10, 3600),
          sameSite: "Lax"
        },
        // 路由守卫以该 Cookie 判定「已登录」（见 src/router/index.ts）
        { name: "multiple-tabs", value: "true", url: FRONT_URL }
      ]);
    } else if (
      !cookies.some(
        cookie => cookie.name === "multiple-tabs" && cookie.value === "true"
      )
    ) {
      // 应用可能在用例内轮换过 token：只补路由守卫标记，不覆盖已轮换的凭据
      await page
        .context()
        .addCookies([{ name: "multiple-tabs", value: "true", url: FRONT_URL }]);
    }
    await page.goto("/");
    const shell = page.locator("#header-translation");
    const loginForm = page.getByPlaceholder("账号");
    await expect(shell.or(loginForm).first()).toBeVisible({ timeout: 30_000 });
    if (!(await shell.isVisible())) return false;
    await healSharedLocale(page);
    return true;
  } catch (error) {
    console.warn(
      `[e2e] 会话复用登录失败，回落表单登录：${String(error).slice(0, 200)}`
    );
    return false;
  }
}

/** 真实表单登录（登录链路本身的用例应直调本函数，避免被会话复用绕过） */
export async function loginWithForm(page: Page, creds: Credentials = ADMIN) {
  // 复用态残留会让路由守卫把 /#/login 重定向回首页，先清凭据再走表单
  await page.context().clearCookies();
  const accountInput = page.getByPlaceholder("账号");
  await page.goto("/#/login");
  // 登录表单依赖站点配置：配置请求失败/被拖慢时登录页会落到「当前服务器不允许登录」
  // 分支（等价于 config 为空），此时重载一次重新拉取即可恢复——属已知瞬态，
  // 不在用例里硬等或多点一次（全量跑 + 一个页面内二次登录时概率升高）
  for (let attempt = 0; attempt < 2; attempt++) {
    const ready = await accountInput
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (ready) break;
    await page.reload();
  }
  const passwordInput = page.getByPlaceholder("密码");
  const submitButton = page.getByRole("button", { name: "登录", exact: true });

  const fillAndSubmit = async () => {
    await accountInput.fill(creds.username);
    await passwordInput.fill(creds.password);
    await submitButton.click();
  };

  await fillAndSubmit();
  // hash 路由：登录成功后离开 #/login。上限给足 30s：并行分片（e2e-parallel）
  // 高负载下登录 POST + 路由拉取可能超过 15s（auto-retry 断言的上界，非盲等）。
  //
  // 登录页可能在「填表」与「提交」之间被整页重载（站点配置/路由快照版本校验、
  // 并行高负载下的慢请求），表现为输入被清空、提交后只剩「请输入账号/密码」。
  // 检测到表单校验错误就重新填表提交；真实口令错误会再次失败并由最终断言暴露。
  await expect(async () => {
    const formReset = await page
      .locator(".el-form-item__error")
      .first()
      .isVisible()
      .catch(() => false);
    if (formReset) await fillAndSubmit();
    await expect(page).not.toHaveURL(/#\/login/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await healSharedLocale(page);
}

/**
 * 登录入口：默认走会话复用快路径（仅管理员账号），失败或指定其它账号时回落表单登录。
 * 用例语义不变（调用后即为已登录且处于应用壳），登录链路自身的用例请直调 loginWithForm。
 */
export async function login(page: Page, creds: Credentials = ADMIN) {
  if (
    SESSION_REUSE_ENABLED &&
    creds.username === ADMIN.username &&
    (await trySessionLogin(page))
  ) {
    return;
  }
  await loginWithForm(page, creds);
}

/**
 * 等待可见的 el-loading 遮罩退场。
 *
 * 框架的表/树在刷新期间挂 el-loading-mask，遮罩会拦截点击（高负载档下刷新更慢，
 * Playwright 的点击重试窗口被吃满就表现为「click timeout」。等待上限取
 * PANEL_ACTION_TIMEOUT；遮罩本就缺席或已退场时立即返回，不引入固定延时。
 */
export async function waitForLoadingMaskGone(page: Page) {
  await page
    .locator(".el-loading-mask:visible")
    .first()
    .waitFor({ state: "hidden", timeout: PANEL_ACTION_TIMEOUT })
    .catch(() => undefined);
}

export async function openMenu(page: Page, parent: string, child: string) {
  await page.getByRole("menuitem", { name: parent }).first().click();
  const item = page.getByRole("menuitem", { name: child }).first();
  await item.waitFor({ state: "visible" });
  await item.click();
}

export async function logout(page: Page) {
  await page.locator(".el-dropdown-link").first().click();
  await page.getByText("退出系统").first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await expect(page).toHaveURL(/#\/login/, { timeout: 15_000 });
}

/**
 * 菜单导航：先逐级展开目录（el-sub-menu 标题），再点击目标页面链接。
 *
 * 用链接 href 精确定位而非菜单名文本，原因有二：一是父级 menuitem 的
 * accessible name 会拼接全部子项文本，按名字子串匹配极易命中父级；二是
 * 受限角色仅授权单个页面时，pure-admin 会把该页面提升为顶级菜单（无目录可展开），
 * 此时 dirs 传空数组即可命中。
 */
export async function openMenuPath(page: Page, dirs: string[], path: string) {
  const link = page.locator(`a[href="#${path}"]`).first();
  const dirTitle = (dir: string) =>
    page.locator(".el-sub-menu__title", { hasText: dir }).first();
  /** 标题所属的 el-sub-menu 根节点（展开态 class 挂在它上面） */
  const dirItem = (title: Locator) =>
    title.locator("xpath=ancestor::li[contains(@class,'el-sub-menu')][1]");
  const isOpened = async (title: Locator) =>
    (
      await dirItem(title)
        .getAttribute("class")
        .catch(() => "")
    )?.includes("is-opened") ?? false;

  /**
   * 逐级展开目录，并等待每级真正展开后再进下一级。
   *
   * 展开态必须看父级 li 的 `is-opened`，不能用「子级可见」判断：手风琴切换时
   * `is-opened` 立即翻转，但子级仍在折叠动画中保持可见；此时若判定「已展开」
   * 而跳过点击，随后的链接点击会落在正在消失的节点上（全量并行 webkit 实测：
   * click 报 element is not visible / 被相邻菜单项拦截）。`aria-expanded` 不可用
   * （el-menu 读到的一直是 null）。
   */
  const openDirs = async () => {
    for (let i = 0; i < dirs.length; i++) {
      const title = dirTitle(dirs[i]);
      await title.scrollIntoViewIfNeeded().catch(() => undefined);
      // 上一级尚未展开时本级标题不可见：等其出现，超时交给外层重试兜底
      await title
        .waitFor({ state: "visible", timeout: 3_000 })
        .catch(() => undefined);
      if (!(await title.isVisible().catch(() => false))) continue;
      if (!(await isOpened(title))) {
        // 动画/重渲染期间点击可能落空，外层重试会再次展开
        await title.click({ timeout: 8_000 }).catch(() => undefined);
      }
      // 等本级展开动画结束（下一级标题或目标链接可见）再进入下一级
      const next = i + 1 < dirs.length ? dirTitle(dirs[i + 1]) : link;
      await next
        .waitFor({ state: "visible", timeout: 5_000 })
        .catch(() => undefined);
    }
  };

  // 点击后必须确认路由真的切走了：偶发情况下点击落在菜单重渲染前的旧节点上
  // （登录后权限/菜单数据仍在异步刷新），hash 不变、页面停在 welcome，
  // 后续 `expect(table)` 才报「element(s) not found」——历史上被当成时序 flaky。
  //
  // 顶层单页路由由后端 format_menu_data 套 `/default` 前缀（href 是
  // `#/default/chat/index`），但子路由是绝对路径 `/chat/index`，Vue Router 落地后
  // hash 不含 `/default`——只按传入 path 匹配会把「已到达」误判为失败。
  const routePath = path.replace(/^\/default(?=\/)/, "");
  const reached = () =>
    page.url().includes(path) || page.url().includes(routePath);
  const arrived = () =>
    reached() ||
    page
      .waitForURL(
        url => url.hash.includes(path) || url.hash.includes(routePath),
        { timeout: 5_000 }
      )
      .then(() => true)
      .catch(() => false);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (reached()) return;
    await openDirs();
    await link.scrollIntoViewIfNeeded().catch(() => undefined);
    const clicked = await link
      .click({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (clicked && (await arrived())) return;
    // 点击落空或路由未切换：重开目录再点一次（点击成功但路由慢时也复用该重试）
  }
  if (reached()) return;
  throw new Error(`openMenuPath 无法打开菜单：${dirs.join(" / ")} → ${path}`);
}

/**
 * 进入列表页（hash 路由）；传入 `filter` 时在搜索区填入条件并点「搜索」。
 *
 * **为什么断言具体行前必须过滤**：列表固定发 `ordering=-created_time`，默认
 * `pageSize=15`（RePlusPage 默认），E2E 一轮里靠前的用例会持续创建带时间戳的账号，
 * 早期种子账号（`xadmin` / `e2e_user` 等）会被挤出第一页 —— 直接
 * `locator(".el-table__row", { hasText: "xadmin" })` 就会「找不到行」。而 webkit 是
 * 第二个执行的浏览器阶段、用户累积最多，于是只在 webkit 上失败，历史上被误判为
 * 「时序 flaky」（真实原因与处理纪律见 e2e/README.md「列表断言陷阱」）。
 *
 * 注意**不要**用 `?username=xadmin` 这种 route.query 方式预置：RePlusPage 会把
 * route.query 合并进 searchFields 并回填搜索框，但首屏列表请求并未带上该条件
 * （实测：搜索框显示 xadmin、表格仍是未过滤的第一页），必须在页面上真实触发一次搜索。
 */
export async function openList(
  page: Page,
  path: string,
  filter?: { placeholder: string; value: string }
) {
  await page.goto(`/#${path}`);
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  if (!filter) return;
  await filterList(page, filter.placeholder, filter.value);
}

/**
 * 在当前列表页真实触发一次服务端搜索（定位目标行用）。
 *
 * 「列表断言陷阱」（见 README）：服务端分页下目标行可能不在第一页——webkit 是
 * 第二个执行的浏览器阶段，库里数据累积最多，首开即断言目标行可见会稳定失败
 * （曾误判 webkit flaky）。用例侧应先按唯一条件搜索过滤，再定位目标行。
 *
 * 搜索项多时默认折叠，展开后条件输入与「搜索」按钮才可见。单次「等任一形态 →
 * 判定 → 点击」会被中间态打穿（并行高负载下搜索区的响应式宽度可能被锁死，
 * 2026-09-17 zz-preview 五连挂），这里循环自愈：每轮等输入可见（8s），不可见
 * 则容错点「展开」，最多 3 轮；最坏 ~30s 有界。
 */
export async function filterList(
  page: Page,
  placeholder: string,
  value: string
) {
  const input = page.getByPlaceholder(placeholder).first();
  const expandBtn = page.getByRole("button", { name: /展开/ }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    const visible = await input
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (visible) break;
    await expandBtn.click({ timeout: 3_000 }).catch(() => null);
  }
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(value);
  await page.getByRole("button", { name: "搜索", exact: true }).first().click();
}

/**
 * 进入「用户管理」页，兼容两种菜单形态（受限角色仅授权单页时的形态差异）：
 * - 管理员：「系统管理」是 el-sub-menu（无 href），需展开目录后点页面链接；
 * - 受限角色（如 e2e_dp / e2e_fp）：被提升为顶级真链接（href=#/system），直接点击。
 */
export async function openUserManagement(page: Page) {
  const dir = page
    .locator(".el-sub-menu__title", { hasText: "系统管理" })
    .first();
  const table = page.locator(".el-table").first();
  if (await dir.isVisible().catch(() => false)) {
    await dir.click();
    await page.locator(`a[href="#/system/user/index"]`).first().click();
  } else {
    await page.locator(`a[href="#/system"]`).first().click();
  }
  await expect(table).toBeVisible({ timeout: 15_000 });
}

/**
 * 等待应用 WebSocket 建立（过滤 vite HMR 的 ws）。
 * 应用 ws 地址：/ws/message/{group}/{username}，见 src/utils/websocket.ts。
 */
export function waitAppWebSocket(page: Page, timeout = 20_000) {
  return page.waitForEvent("websocket", {
    predicate: ws => APP_WS_PATTERN.test(ws.url()),
    timeout
  });
}

/**
 * 登录握手用的一次性临时 Token（后端校验见 system/utils/auth.py::check_tmp_token）。
 *
 * 必须与后续登录请求保持同一 User-Agent：临时 Token 绑定
 * get_request_ident(request)（IP + UA 等），两端 UA 不一致会命中
 * 「临时Token校验失败」，登录请求根本走不到失败计数逻辑。
 */
export async function fetchTempToken(page: Page): Promise<string> {
  const response = await page.request.get(
    `${FRONT_URL}/api/identity/auth/token`,
    {
      headers: { "User-Agent": E2E_USER_AGENT }
    }
  );
  expect(response.status()).toBe(200);
  const payload = await response.json();
  return String(payload?.token ?? payload?.data?.token ?? "");
}

/** 从 cookie 读取 access token，供 page.request 越权断言使用（utils/auth.ts 口径） */
export async function getAccessToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const tokenCookie = cookies.find(cookie => cookie.name === "X-Token");
  return tokenCookie?.value ?? "";
}

/**
 * 打开用户管理抽屉（操作列「管理」按钮；行内头像与用户名同为入口）。
 * 用户页的行操作已收敛进抽屉，返回的 locator 供 clickUserAction 继续操作。
 */
export async function openUserPanel(page: Page, row: Locator) {
  await row.getByRole("button", { name: "管理" }).first().click();
  const drawer = page
    .locator(".el-drawer")
    .filter({ hasText: "管理用户" })
    .first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  return drawer;
}

/** 在已打开的用户抽屉内点击动作（按 data-action-code 精确定位，避免文案耦合） */
export async function clickUserAction(drawer: Locator, code: string) {
  return clickPanelAction(drawer, code);
}

/**
 * 打开行操作抽屉（通用）：点行内入口按钮（默认为「管理」）并返回抽屉 locator。
 * 页面侧入口文案不同则传 name（如知识库为「预览」）。
 */
export async function openEntityPanel(page: Page, row: Locator, name = "管理") {
  await row.getByRole("button", { name }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  return drawer;
}

/** 点击抽屉内的动作按钮（按 data-action-code 精确定位，与文案解耦） */
export async function clickPanelAction(panel: Locator, code: string) {
  const action = panel.locator(`[data-action-code="${code}"]`).first();
  await expect(action).toBeVisible({ timeout: 10_000 });
  await action.click();
}
/**
 * 打开「项目设置」面板：收起态只是 translate 出视口（DOM 仍在），
 * 因此按 boundingBox 判定开合并必要时点击顶栏齿轮打开。
 */
export async function openSettingPanel(page: Page) {
  // 仅在当前页面没有设置入口（非布局页，如账户设置）时回退到首页：
  // 多余的跳转会在 multiTagsCache 关闭时重置标签页，破坏「先开页签再改偏好」的用例
  const hasTrigger = await page
    .locator(".set-icon")
    .first()
    .isVisible()
    .catch(() => false);
  if (!hasTrigger) await page.goto("/#/welcome");
  await page.locator(".set-icon").first().waitFor({ timeout: 15_000 });
  const panel = page.locator(".right-panel").first();
  const width = page.viewportSize()?.width ?? 1280;
  const box = await panel.boundingBox();
  if (!box || box.x >= width - 20) {
    await page.locator(".set-icon").first().click();
  }
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

/** 切换「项目设置」面板页签（外观 / 布局 / 通用；非活动页签内容不可见） */
export async function switchSettingTab(page: Page, label: string | RegExp) {
  const tab = page.locator(".right-panel .el-tabs__item").filter({
    hasText: label
  });
  await tab.first().click();
  await expect(tab.first()).toHaveClass(/is-active/, { timeout: 10_000 });
}
