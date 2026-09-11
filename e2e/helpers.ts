import { expect, type Page } from "@playwright/test";

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
export const PLAIN_USER = { username: "e2e_user", password: "E2E-User-2026!" };
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

export async function login(page: Page, creds: Credentials = ADMIN) {
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
  await accountInput.fill(creds.username);
  await page.getByPlaceholder("密码").fill(creds.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  // hash 路由：登录成功后离开 #/login。上限给足 30s：并行分片（e2e-parallel）
  // 高负载下登录 POST + 路由拉取可能超过 15s（auto-retry 断言的上界，非盲等）
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 30_000 });
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
  /**
   * 逐级展开目录，并等待每级真正展开后再进下一级：避免链路后半段元素未稳定/
   * 被遮挡导致 webkit 下点击偶发失败（intercepts pointer events）。
   *
   * el-menu **不暴露展开状态属性**（`aria-expanded` 读到的一直是 null，据此判断会
   * 恒定走「未展开」分支），但折叠时子级元素不可见（`isVisible()` 为 false），
   * 故统一以「下一级标题（最后一级用目标链接）已可见」作为本级已展开的判据（web-first）：
   * 既替代了固定 300ms 延时，也保证重复调用幂等（已展开则跳过点击，不会误折叠）。
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
      const next = i + 1 < dirs.length ? dirTitle(dirs[i + 1]) : link;
      if (await next.isVisible().catch(() => false)) continue;
      await title.click({ timeout: 8_000 });
    }
  };
  await openDirs();
  await link.scrollIntoViewIfNeeded().catch(() => undefined);
  // 目标链接最终仍不可见（某级展开被遮挡失败）时，整段重开一次
  for (let i = 0; i < 3 && !(await link.isVisible().catch(() => false)); i++) {
    // 等目标链接出现（web-first）后再重开目录，替代固定 300ms 延时；超时进入下一轮
    await link
      .waitFor({ state: "visible", timeout: 2_000 })
      .catch(() => undefined);
    await openDirs();
    await link.scrollIntoViewIfNeeded().catch(() => undefined);
  }
  // 点击后必须确认路由真的切走了：偶发情况下点击落在菜单重渲染前的旧节点上
  // （登录后权限/菜单数据仍在异步刷新），hash 不变、页面停在 welcome，
  // 后续 `expect(table)` 才报「element(s) not found」——历史上被当成时序 flaky
  const arrived = () =>
    page
      .waitForURL(url => url.hash.includes(path), { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
  await link.click({ timeout: 10_000 });
  if (!(await arrived())) {
    // arrived() 内部已等待 5s，登录后的菜单异步刷新必然已结束，直接重开目录补点一次；
    // 不再插入固定延时（web-first：以 arrived() 的 waitForURL 重试为准）
    await openDirs();
    await link.click({ timeout: 10_000 }).catch(() => undefined);
    await arrived();
  }
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
  // 搜索项多时默认折叠，展开后条件输入与「搜索」按钮才可见
  const expandBtn = page.getByRole("button", { name: /展开/ });
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
  }
  const input = page.getByPlaceholder(filter.placeholder).first();
  await input.fill(filter.value);
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
    `${FRONT_URL}/api/system/auth/token`,
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
