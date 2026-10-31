import type { Page } from "@playwright/test";

import {
  captureAiState,
  collectCreatedResources,
  deleteCreatedResources,
  restoreAiState,
  type AiStateSnapshot,
  type CreatedResource
} from "./helpers";

/**
 * AI spec 的站点级共享态隔离：
 * - 用例内创建的档案 / 知识文档 / 动态表单 / 用户登记后统一删除；
 * - 用例开始时的激活档案与 AI 开关在 afterEach 写回（失败路径同样执行）。
 */

const DEFAULT_PATTERNS = [
  /\/api\/ai\/profiles$/,
  /\/api\/ai\/knowledge-documents$/,
  /\/api\/dataset\/dynamic-forms$/,
  /\/api\/identity\/user$/
];

let aiState: AiStateSnapshot | null = null;
let created: CreatedResource[] = [];

export function resetAiIsolation() {
  aiState = null;
  created = [];
}

export async function startAiIsolation(
  page: Page,
  patterns: RegExp[] = DEFAULT_PATTERNS
) {
  aiState = await captureAiState(page);
  created = collectCreatedResources(page, patterns);
}

export async function cleanupAiIsolation(page: Page) {
  await deleteCreatedResources(page, created);
  if (aiState) {
    await restoreAiState(page, aiState);
  }
  resetAiIsolation();
}
