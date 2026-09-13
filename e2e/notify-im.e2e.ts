import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 消息设置页 IM 渠道三页签（ADR-019 改进）：钉钉/企微/飞书各自独立页签，仅渲染
 * 自己的字段（SettingItem fields 白名单）——消除「一个表单三家字段 + 单个测试
 * 按钮测的是哪家」的歧义，测试按钮经 ?channel= 只测本渠道（后端单测覆盖）。
 *
 * 用例内不点击「测试」（会真实请求外部 IM API token 端点，无外网/无凭据必然
 * 等待超时），只验收页签结构与字段隔离。面板用 role 定位而非 .el-tab-pane 索引：
 * 懒加载页签未激活即不挂载，DOM 索引随访问路径漂移（曾因此误判找不到飞书字段）。
 */

const TAB = {
  dingtalk: "钉钉",
  wecom: "企业微信",
  feishu: "飞书"
};

test("消息设置：IM 渠道三页签字段隔离与独立测试按钮", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统设置"], "/settings/message");

  const tab = (name: string) => page.getByRole("tab", { name, exact: true });
  const pane = (name: string) => page.getByRole("tabpanel", { name });

  // 三页签渲染（钉钉/企微/飞书平铺，替代原「IM 消息渠道」单页签）
  await expect(tab(TAB.dingtalk)).toBeVisible({ timeout: 15_000 });
  await expect(tab(TAB.wecom)).toBeVisible();
  await expect(tab(TAB.feishu)).toBeVisible();
  await expect(page.getByRole("tab", { name: "IM 消息渠道" })).toHaveCount(0);

  // 钉钉页签：只渲染钉钉字段（懒加载页签未激活不挂载，其他渠道字段不出现）
  await tab(TAB.dingtalk).click();
  const dingPane = pane(TAB.dingtalk);
  await expect(
    dingPane.locator(".el-form-item:has-text('钉钉 AppKey')")
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(".el-form-item:has-text('飞书 App ID')")
  ).toHaveCount(0);
  await expect(
    page.locator(".el-form-item:has-text('企业微信 CorpId')")
  ).toHaveCount(0);
  await expect(
    dingPane.getByRole("button", { name: "测试", exact: true })
  ).toBeVisible();

  // 必填口径：非密文凭据（AppKey / AgentId）带必填标记；空表单点「测试」被后端
  // 必填校验拦下（错误提示）——既不会误报"测试完成"，也不会发起任何外部请求
  await expect(
    dingPane.locator(".el-form-item:has-text('钉钉 AppKey')")
  ).toHaveClass(/is-required/);
  await expect(
    dingPane.locator(".el-form-item:has-text('钉钉 AgentId')")
  ).toHaveClass(/is-required/);
  await dingPane.getByRole("button", { name: "测试", exact: true }).click();
  await expect(page.locator(".el-message--error").last()).toBeVisible({
    timeout: 15_000
  });

  // 飞书页签：只渲染飞书字段；隐藏面板中的测试按钮不参与可见匹配（仅本页签 1 个）
  await tab(TAB.feishu).click();
  const feishuPane = pane(TAB.feishu);
  await expect(
    feishuPane.locator(".el-form-item:has-text('飞书 App ID')")
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    feishuPane.getByRole("button", { name: "测试", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "测试", exact: true })
  ).toHaveCount(1);
});
