/**
 * 交互式验证码 E2E：滑动拼图 / 旋转回正 / 文字点选三题型
 * 走真实登录表单 → 挑战弹层 → 受控 inspect 端点取答案 → 驱动鼠标 → ticket → 登录成功。
 *
 * 配置切换：用例开始前以管理员身份把验证码模式改为 interactive 并打开登录验证码，
 * 结束后恢复 image / 关闭（workers=1，不影响其他套件）。inspect 端点仅在
 * tests/settings_e2e.py 的 CAPTCHA_INSPECT_ENABLED=True 时挂载。
 */

import { expect, test, type Page } from "@playwright/test";

import { ADMIN, FRONT_URL, login } from "./helpers";

const TYPES = ["slide", "rotate", "click"] as const;
type CaptchaType = (typeof TYPES)[number];

async function patchSetting(page: Page, path: string, data: object) {
  const resp = await page.request.patch(`${FRONT_URL}${path}`, { data });
  expect(resp.ok(), `${path} PATCH ${resp.status()}`).toBeTruthy();
}

async function waitForTypes(page: Page, types: string[]) {
  await expect
    .poll(
      async () => {
        const resp = await page.request.get(
          `${FRONT_URL}/api/identity/auth/capabilities`
        );
        const body = await resp.json().catch(() => ({}));
        return body?.data?.basic?.captcha_types;
      },
      { timeout: 15_000 }
    )
    .toEqual(types);
}

async function enableInteractive(
  page: Page,
  type: CaptchaType,
  imageFallback = false
) {
  await patchSetting(page, "/api/settings/captcha/general", {
    CAPTCHA_ENABLED: true
  });
  await patchSetting(page, "/api/settings/captcha/interactive", {
    CAPTCHA_ENABLED_TYPES: [type],
    CAPTCHA_TRACK_CHECK_ENABLED: true,
    CAPTCHA_IMAGE_FALLBACK_ENABLED: imageFallback
  });
  await patchSetting(page, "/api/settings/login/auth", {
    SECURITY_LOGIN_CAPTCHA_ENABLED: true
  });
  await waitForTypes(page, imageFallback ? [type, "image"] : [type]);
  // 两个设置键经 Redis 热更异步生效：等回退开关也到位，避免首屏拿到旧能力
  await expect
    .poll(
      async () => {
        const resp = await page.request.get(
          `${FRONT_URL}/api/identity/auth/capabilities`
        );
        const body = await resp.json().catch(() => ({}));
        return body?.data?.basic?.captcha_image_fallback;
      },
      { timeout: 15_000 }
    )
    .toBe(imageFallback);
}

async function restoreDefaults(page: Page) {
  await patchSetting(page, "/api/settings/captcha/general", {
    CAPTCHA_ENABLED: true
  });
  await patchSetting(page, "/api/settings/captcha/interactive", {
    CAPTCHA_ENABLED_TYPES: [...TYPES],
    CAPTCHA_IMAGE_FALLBACK_ENABLED: false
  });
  await patchSetting(page, "/api/settings/login/auth", {
    SECURITY_LOGIN_CAPTCHA_ENABLED: false
  });
  await waitForTypes(page, [...TYPES]);
}

/** 从挑战面板读取题目元数据（答案不落 DOM） */
async function readChallenge(page: Page) {
  const panel = page.getByTestId("captcha-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  const meta = await panel.evaluate(el => ({
    id: el.getAttribute("data-challenge-id") ?? "",
    type: el.getAttribute("data-challenge-type") ?? "",
    width: Number(el.getAttribute("data-width") ?? 320),
    height: Number(el.getAttribute("data-height") ?? 180),
    pieceSize: Number(el.getAttribute("data-piece-size") ?? 56)
  }));
  const resp = await page.request.get(
    `${FRONT_URL}/api/identity/auth/captcha/inspect?challenge_id=${meta.id}`,
    { headers: { "X-Captcha-Inspect-Token": "e2e-captcha-inspect-token" } }
  );
  expect(resp.ok(), "inspect 端点应仅在 E2E 档挂载且 token 匹配").toBeTruthy();
  const body = await resp.json();
  return { ...meta, answer: body.data.answer as Record<string, unknown> };
}

/** 拖动滑块到指定比例（0~1）；先停顿 120ms 保证轨迹时长下限 */
async function dragSlider(page: Page, fraction: number) {
  const slider = page.locator(".re-captcha-panel .re-slider-captcha").first();
  const box = await slider.boundingBox();
  const handle = page.locator(".re-slider-captcha__action").first();
  const handleBox = await handle.boundingBox();
  if (!box || !handleBox) throw new Error("滑块未渲染");
  // 组件用 ResizeObserver 的 contentRect 计算轨道宽度（不含边框）；
  // clientWidth 与之同口径，避免边框宽度把答案推偏 2px
  const contentWidth = await slider.evaluate(
    el => (el as HTMLElement).clientWidth
  );
  const maxMove = Math.max(contentWidth - 40 - 6, 0);
  const startX = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  const targetX = startX + Math.max(0, Math.min(fraction, 1)) * maxMove;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  // 分段慢速移动：相邻采样速度必须低于服务端 4px/ms 的瞬移阈值
  const steps = 20;
  for (let index = 1; index <= steps; index += 1) {
    await page.mouse.move(startX + ((targetX - startX) * index) / steps, y);
    await page.waitForTimeout(6);
  }
  await page.waitForTimeout(40);
  await page.mouse.up();
}

async function solveChallenge(
  page: Page,
  meta: Awaited<ReturnType<typeof readChallenge>>
) {
  if (meta.type === "slide") {
    // 回归守护：拼块必须是整幅透明画布（与底图同宽），不能缩成一个小点
    const stage = page.locator(".re-captcha-puzzle__stage");
    const piece = page.locator(".re-captcha-puzzle__piece");
    await expect(piece).toBeVisible();
    const stageBox = await stage.boundingBox();
    const pieceBox = await piece.boundingBox();
    expect(stageBox && pieceBox).toBeTruthy();
    expect(pieceBox!.width).toBeGreaterThan(stageBox!.width * 0.95);
    const x = Number(meta.answer.x);
    await dragSlider(page, x / Math.max(meta.width - meta.pieceSize, 1));
    return;
  }
  if (meta.type === "rotate") {
    const angle = Number(meta.answer.angle);
    await dragSlider(page, (angle + 180) / 360);
    return;
  }
  const points = meta.answer.points as { x: number; y: number }[];
  const stage = page.locator(".re-word-click__stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("点选图画布未渲染");
  for (const point of points) {
    await page.mouse.click(
      box.x + (point.x / meta.width) * box.width,
      box.y + (point.y / meta.height) * box.height
    );
    // 三次点击总时长必须落在服务端 80ms~10s 窗口内
    await page.waitForTimeout(60);
  }
  await page.getByRole("button", { name: "确认", exact: true }).click();
}

test("交互式验证码：三种题型均可通过真实 UI 登录", async ({ page }) => {
  test.setTimeout(180_000);
  // 先以管理员身份登录，用于切换验证码设置；保存凭据 Cookie，
  // 用例中途清 Cookie 后仍能在 finally 恢复设置，避免污染后续套件
  await login(page);
  const adminCookies = await page.context().cookies();

  try {
    for (const type of TYPES) {
      await test.step(`题型 ${type}`, async () => {
        await enableInteractive(page, type);
        await page.context().clearCookies();
        await page.goto("/#/login");

        const account = page.getByPlaceholder("账号");
        await account.waitFor({ state: "visible", timeout: 15_000 });
        await account.fill(ADMIN.username);
        await page.getByPlaceholder("密码").fill(ADMIN.password);
        await page.getByRole("button", { name: "登录", exact: true }).click();

        const meta = await readChallenge(page);
        expect(meta.type).toBe(type);
        await solveChallenge(page, meta);

        // 挑战通过 → 自动提交登录 → 离开登录页
        await expect(page).not.toHaveURL(/#\/login/, { timeout: 30_000 });
      });
    }
  } finally {
    await page.context().addCookies(adminCookies);
    await restoreDefaults(page).catch(() => undefined);
  }
});

test("无障碍回退：开启后可从挑战切换到图片码", async ({ page }) => {
  await login(page);
  const adminCookies = await page.context().cookies();
  try {
    await enableInteractive(page, "slide", true);
    await page.context().clearCookies();
    await page.goto("/#/login");

    const account = page.getByPlaceholder("账号");
    await account.waitFor({ state: "visible", timeout: 15_000 });
    await account.fill(ADMIN.username);
    await page.getByPlaceholder("密码").fill(ADMIN.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();

    const panel = page.getByTestId("captcha-panel");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "使用图片验证码" }).click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-challenge-type", "image");
    await expect(page.getByAltText("图片验证码")).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByTestId("captcha-image-input")).toBeVisible();
  } finally {
    await page.context().addCookies(adminCookies);
    await restoreDefaults(page).catch(() => undefined);
  }
});

test("验证码设置页：总配置 + 图片题型/题型与难度分页签渲染", async ({
  page
}) => {
  await login(page);
  await page.goto("/#/settings/captcha");

  // 总配置：全局开关 + 验证码类型选择
  await expect(page.getByText("启用验证码").first()).toBeVisible({
    timeout: 15_000
  });

  // 图片题型页签：预览图自动加载
  await page.getByRole("tab", { name: "图片题型", exact: true }).click();
  await expect(page.getByText("图片算法模式").first()).toBeVisible();
  await expect(page.getByTestId("captcha-image-preview")).toBeVisible({
    timeout: 15_000
  });

  // 题型与难度页签：预览组件自动加载
  await page.getByRole("tab", { name: "题型与难度", exact: true }).click();
  await expect(page.getByTestId("captcha-interactive-preview")).toBeVisible();
  await expect(page.locator(".re-captcha-puzzle__stage")).toBeVisible();
  for (const label of [
    "交互式题型",
    "图片验证码回退",
    "滑动容差（像素）",
    "滑动底图尺寸（像素）",
    "旋转图片尺寸（像素）"
  ]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }

  // 行为验证新增题型：语序点选可预览
  await page.getByTestId("captcha-preview-type").click();
  await page.getByRole("option", { name: "语序点选" }).click();
  await expect(page.locator(".re-word-click__stage")).toBeVisible({
    timeout: 15_000
  });
});

test("验证码设置页：验证数据页签渲染大盘与日志列表", async ({ page }) => {
  await login(page);
  await page.goto("/#/settings/captcha");

  await page.getByRole("tab", { name: "验证数据", exact: true }).click();
  await expect(page.getByTestId("captcha-data-setting")).toBeVisible({
    timeout: 15_000
  });
  // 大盘聚合：策略快照 + 汇总卡片 + 日志列表（元数据协议）
  await expect(page.getByTestId("captcha-data-mode")).toBeVisible();
  await expect(page.getByTestId("captcha-data-summary")).toBeVisible();
  await expect(page.getByTestId("captcha-data-by-type")).toBeVisible();
  await expect(page.locator(".el-table").last()).toBeVisible({
    timeout: 15_000
  });
});
