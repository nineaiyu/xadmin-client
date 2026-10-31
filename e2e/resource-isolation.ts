import type { Page } from "@playwright/test";

import {
  collectCreatedResources,
  deleteCreatedResources,
  type CreatedResource
} from "./helpers";

/**
 * 通用业务资源隔离：用例内 POST 创建的常见资源在 afterEach 逆序删除。
 * 只登记明确可删除的业务资源；聊天消息 / 日志等追加型数据不纳入。
 */

const DEFAULT_PATTERNS = [
  /\/api\/identity\/(user|role|dept|post|tags?)$/,
  /\/api\/identity\/api-applications$/,
  /\/api\/identity\/personal-access-tokens$/,
  /\/api\/system\/(config(\/[^/]+)?|tags?|saved-views|permission)$/,
  /\/api\/system\/dict(\/[^/]+)?$/,
  /\/api\/dataset\/(datasets?|dashboards?|screens?|reports?|dynamic-forms?)$/,
  /\/api\/task\/(crontab|interval|periodic|tasks?)$/,
  /\/api\/task\/(import|export)[^/]*$/,
  /\/api\/file\/file(\/upload)?$/,
  /\/api\/notifications\/message-templates$/,
  /\/api\/audit\/mask-rules$/
];

let created: CreatedResource[] = [];

export function resetResourceIsolation() {
  created = [];
}

export async function startResourceIsolation(
  page: Page,
  patterns: RegExp[] = DEFAULT_PATTERNS
) {
  created = collectCreatedResources(page, patterns);
}

export async function cleanupResourceIsolation(page: Page) {
  await deleteCreatedResources(page, created);
  resetResourceIsolation();
}
