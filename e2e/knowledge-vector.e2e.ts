import { expect, test } from "@playwright/test";

import { BACKEND_URL, FRONT_URL, getAccessToken, login } from "./helpers";

/**
 * 知识库向量化链路：配置 embedding 档案 → 构建向量 → 状态可查、可增量补齐。
 *
 * 依赖 E2E 桩 LLM 的 `/v1/embeddings`（scripts/stub_llm.py，确定性假向量）；
 * 用例自建档案与文档并在结束时清理，避免影响其它 spec 的检索口径。
 */

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

test("知识库向量：embedding 档案 → 构建向量 → 状态更新", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  let profilePk = "";
  let docPk = "";

  try {
    // 1) 向量化档案（用途=embedding，指向桩 LLM 的 /v1/embeddings）
    const profileRes = await page.request.post(
      `${BACKEND_URL}/api/ai/profiles`,
      {
        headers: headers(token),
        data: {
          name: `E2E向量档案-${suffix}`,
          base_url: "http://127.0.0.1:18897/v1",
          api_key: "stub-key",
          model: "stub-embed",
          purpose: "embedding",
          is_active: true,
          timeout: 20
        }
      }
    );
    expect(profileRes.ok(), await profileRes.text()).toBeTruthy();
    profilePk = (await profileRes.json()).data.pk;

    // 2) 上传一篇两段式文档（切成 2 块，便于断言构建条数）
    const docRes = await page.request.post(
      `${BACKEND_URL}/api/ai/knowledge-documents`,
      {
        headers: headers(token),
        data: {
          name: `E2E向量文档-${suffix}`,
          content:
            "## 备份\n数据库备份与恢复演练说明。\n\n## 审批\n审批流程会签与或签规则说明。"
        }
      }
    );
    expect(docRes.ok(), await docRes.text()).toBeTruthy();
    docPk = (await docRes.json()).data.pk;

    const before = await page.request.get(
      `${BACKEND_URL}/api/ai/knowledge-documents/vector-status`,
      { headers: headers(token) }
    );
    const beforeBody = (await before.json()).data;
    expect(beforeBody.enabled).toBe(true);
    expect(beforeBody.model).toBe("stub-embed");

    // 3) 页面「构建向量」：确认弹窗 → 成功提示
    await page.goto(`${FRONT_URL}/#/integration/knowledge/index`);
    await expect(page.getByRole("button", { name: "构建向量" })).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole("button", { name: "构建向量" }).click();
    const confirmBox = page.locator(".el-message-box");
    await expect(confirmBox).toContainText("增量构建向量索引");
    await confirmBox.getByRole("button", { name: "确定" }).click();
    await expect(
      page.locator(".el-message").filter({ hasText: "向量构建完成" }).first()
    ).toBeVisible({ timeout: 20_000 });

    // 4) 状态：已有可用向量（fresh > 0），维度来自桩（16 维）
    const after = await page.request.get(
      `${BACKEND_URL}/api/ai/knowledge-documents/vector-status`,
      { headers: headers(token) }
    );
    const afterBody = (await after.json()).data;
    expect(afterBody.fresh).toBeGreaterThan(0);
    expect(afterBody.dim).toBe(16);
    expect(afterBody.stale).toBe(0);
  } finally {
    if (docPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/ai/knowledge-documents/${docPk}`, {
          headers: headers(token)
        })
        .catch(() => undefined);
    }
    if (profilePk) {
      await page.request
        .delete(`${BACKEND_URL}/api/ai/profiles/${profilePk}`, {
          headers: headers(token)
        })
        .catch(() => undefined);
    }
  }
});
