import type { Page } from "@playwright/test";

import { collectCreatedResources, type CreatedResource } from "./helpers";

/**
 * 审批 spec 的在途资源清理：实例先 cancel（申请人身份）再 DELETE，流程最后删。
 * afterEach 无条件执行，失败路径也不会给共享库留下 PENDING 待办。
 */

let created: CreatedResource[] = [];

export function resetApprovalIsolation() {
  created = [];
}

export async function startApprovalIsolation(page: Page) {
  created = collectCreatedResources(page, [
    /\/api\/approval\/approval-instances$/,
    /\/api\/approval\/approval-flows$/,
    /\/api\/approval\/leave$/
  ]);
}

export async function cleanupApprovalIsolation(page: Page) {
  const items = [...created].reverse();
  for (const item of items) {
    if (item.path.endsWith("/approval-instances")) {
      await page.request
        .post(`/api/approval/approval-instances/${item.pk}/cancel`, {
          data: {}
        })
        .catch(() => undefined);
    }
    await page.request.delete(`${item.path}/${item.pk}`).catch(() => undefined);
  }
  resetApprovalIsolation();
}
