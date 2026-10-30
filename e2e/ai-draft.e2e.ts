import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 代码生成器「AI 字段草案」UI 链路：
 *
 * 1) 开关关闭时生成 → 可读提示（不静默、不出结果表）；
 * 2) 开启后（激活指向桩 LLM 的档案）→ 生成草案 → 人审采纳 → 合并进字段配置。
 *
 * 桩 LLM 识别 `Field catalog:` 请求返回确定性草案（scripts/stub_llm.py）。
 * AI 设置是站点级共享态：用例结束恢复开关与档案激活状态，避免影响其他用例。
 */

const STUB_LLM_URL =
  process.env.E2E_STUB_LLM_URL ?? "http://127.0.0.1:18897/v1";
const MODEL_SELECT = '[data-testid="codegen-model-select"]';
const DRAFT_OPEN = '[data-testid="ai-draft-open"]';

async function jsonRequest(
  page: Page,
  method: "get" | "post" | "patch",
  path: string,
  data?: unknown
) {
  const response = await page.request[method](`${FRONT_URL}${path}`, {
    data: data ?? {}
  });
  return (await response.json()) as {
    code: number;
    data: Record<string, unknown> | null;
    detail?: string;
  };
}

async function setDraftEnabled(page: Page, enabled: boolean) {
  const saved = await jsonRequest(page, "patch", "/api/ai/assistant/config", {
    AI_CODEGEN_DRAFT_ENABLED: enabled
  });
  expect(saved.code).toBe(1000);
}

/** 当前激活档案主键（用例结束恢复用；无激活档案返回空串） */
async function activeProfilePk(page: Page): Promise<string> {
  const body = await jsonRequest(page, "get", "/api/ai/profiles?size=100");
  const rows = (body.data?.results ?? []) as {
    pk: string;
    is_active?: boolean;
  }[];
  return rows.find(row => row.is_active)?.pk ?? "";
}

/** 打开代码生成页并选定 demo.Book（E2E 种子内） */
async function openCodegenWithModel(page: Page) {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/codegen/index");
  const modelSelect = page.locator(MODEL_SELECT);
  await expect(modelSelect).toBeVisible({ timeout: 15_000 });
  await modelSelect.click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "demo.Book" })
    .first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(page.locator(DRAFT_OPEN)).toBeEnabled({ timeout: 15_000 });
}

/** 生成草案：填描述 → 点击生成（不等待结果，由调用方断言） */
async function runDraft(page: Page, description: string) {
  await page.locator(DRAFT_OPEN).click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByTestId("ai-draft-description").fill(description);
  await dialog.getByTestId("ai-draft-run").click();
  return dialog;
}

test("AI 字段草案：开关关闭时给出可读提示", async ({ page }) => {
  await login(page);
  await setDraftEnabled(page, false);
  await openCodegenWithModel(page);

  const dialog = await runDraft(page, "把名称字段设为必填");
  const alert = page
    .locator(".el-message")
    .filter({ hasText: "AI 字段草案未启用" })
    .first();
  await expect(alert).toBeVisible({ timeout: 20_000 });
  // 失败不产出结果表 / 采纳按钮不可用
  await expect(dialog.getByTestId("ai-draft-table")).toHaveCount(0);
  await expect(dialog.getByTestId("ai-draft-apply")).toBeDisabled();
});

test("AI 字段草案：生成 → 人审采纳 → 合并进字段配置", async ({ page }) => {
  await login(page);
  const previousProfile = await activeProfilePk(page);
  const suffix = `${Date.now()}`.slice(-7);
  let createdProfile = "";
  try {
    // 指向桩 LLM 的档案并激活（结构化链路按 chat 档案回落）
    const created = await jsonRequest(page, "post", "/api/ai/profiles", {
      name: `E2E-Codegen-${suffix}`,
      base_url: STUB_LLM_URL,
      model: "stub-llm",
      api_key: "sk-e2e-stub",
      is_active: true
    });
    expect(created.code).toBe(1000);
    createdProfile = String(created.data?.pk ?? "");
    expect(createdProfile).not.toBe("");
    await setDraftEnabled(page, true);

    await openCodegenWithModel(page);
    const dialog = await runDraft(
      page,
      "把名称字段改成必填，显示名用 E2E 草案字段"
    );

    // 桩返回确定性草案：摘要 + 行（默认全选）
    await expect(dialog.getByTestId("ai-draft-summary")).toContainText(
      "E2E 桩草案",
      { timeout: 20_000 }
    );
    await expect(
      dialog.locator('[data-testid="ai-draft-table"] .el-table__row')
    ).toHaveCount(1);
    await expect(dialog.getByTestId("ai-draft-table")).toContainText(
      "E2E 草案字段"
    );

    // 采纳：弹窗关闭 + 字段配置表回填显示名
    await dialog.getByTestId("ai-draft-apply").click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.locator(".el-message").first()).toBeVisible({
      timeout: 10_000
    });
    const labelInput = page
      .locator(".el-table__row")
      .filter({
        has: page.locator(".text-xs.font-medium", { hasText: "name" })
      })
      .first()
      .locator("input")
      .first();
    await expect(labelInput).toHaveValue("E2E 草案字段", { timeout: 10_000 });
  } finally {
    // 恢复站点级共享态：关开关、还回原激活档案（无则全部取消激活）
    await setDraftEnabled(page, false).catch(() => undefined);
    if (createdProfile) {
      await jsonRequest(
        page,
        "post",
        `/api/ai/profiles/${createdProfile}/deactivate`
      ).catch(() => undefined);
    }
    if (previousProfile) {
      await jsonRequest(
        page,
        "post",
        `/api/ai/profiles/${previousProfile}/activate`
      ).catch(() => undefined);
    }
  }
});
