#!/usr/bin/env node
// `as unknown as` 双重断言基线门禁（类型逃逸防回潮）。
//
// `as unknown as T` 绕过编译器的双向类型检查，是比 `as T` 更彻底的逃逸 hatch：
// 数量随迭代自然漂移（layout 路由类型互转 tabDetail.ts / tree.ts 是存量热点），
// 没有基线时无法区分「必要增量」与「随手逃逸」。本门禁按文件建立基线：
//
// - 新文件出现 `as unknown as` 即失败（禁止未登记新增）；
// - 已登记文件超过基线数即失败（只减不增）；
// - 数量降到 0 时提示移除基线条目。
//
// 用法：
//   node scripts/check-as-unknown.mjs            # 门禁（CI 用）
//   node scripts/check-as-unknown.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const EXTENSIONS = new Set([".ts", ".tsx", ".vue"]);
const PATTERN = /\bas\s+unknown\s+as\b/g;

// 存量基线：相对路径 -> 基线出现次数（只减不增；降到 0 即可从此表移除）
// 2026-10-01：R3 hook 拆分后净减 4 处（form/my、api-app、knowledge 三文件的 hook.tsx
// 归零移除，useMenuData 4→3；搬迁过程中新子模块均以单层 as 收窄，未新增逃逸）。
// 2026-10-01（第二批）：R3 滚动债第二批拆分后净减 6 处（permission hook.tsx 归零移除，
// normalize.spec 7→8 又回落至 8-1=7 实际持平；form/data hook.tsx 1 处随搬迁收窄，
// approval/instance 同步收窄；新子模块均以单层 as 或直接赋值替代双逃逸）。
// 2026-10-02：O6 收口，router/index.ts 清零移除基线（当前 94 处 / 65 文件）。
// 2026-09-30：初始登记 109 处 / 70 文件（热点：menu normalize.spec 7、router/index 6、
// useMenuData 4——多为 element-plus 泛型组件与路由元数据互转的既有债务）
const BASELINE = {
  "src/api/system/search.ts": 1,
  "src/components/ReCropper/src/index.tsx": 2,
  "src/components/RePlusPage/__tests__/advancedFilter.spec.ts": 1,
  "src/components/RePlusPage/__tests__/registry.spec.ts": 1,
  "src/components/RePlusPage/__tests__/renders.spec.ts": 1,
  "src/components/RePlusPage/__tests__/savedViewSummary.spec.ts": 1,
  "src/components/RePlusPage/src/components/ChangeHistoryDialog.vue": 1,
  "src/components/RePlusPage/src/components/ImportData.vue": 1,
  "src/components/RePlusPage/src/components/SavedViewForm.vue": 1,
  "src/components/RePlusPage/src/components/SavedViewMenu.vue": 1,
  "src/components/RePlusPage/src/index.vue": 2,
  "src/components/RePlusPage/src/utils/__tests__/renderers-pairing.spec.ts": 4,
  "src/components/RePlusPage/src/utils/usePlusPageForm.ts": 2,
  "src/components/ReQrcode/src/index.tsx": 2,
  "src/components/ReTreeLine/index.ts": 1,
  "src/layout/components/lay-content/index.vue": 1,
  "src/layout/components/lay-setting/components/SettingDisplay.vue": 1,
  "src/layout/components/lay-sidebar/components/SidebarBreadCrumb.vue": 2,
  "src/router/utils/route-tree.ts": 1,
  "src/store/modules/__tests__/settings.spec.ts": 1,
  "src/store/modules/permission.ts": 1,
  "src/utils/__tests__/webauthn.spec.ts": 3,
  "src/utils/fetchAllRows.spec.ts": 2,
  "src/utils/http/errorStrategies.spec.ts": 1,
  "src/utils/http/index.spec.ts": 1,
  "src/utils/http/index.ts": 2,
  "src/utils/localforage/index.ts": 1,
  "src/utils/tabDetail.ts": 2,
  "src/utils/tree.ts": 3,
  "src/views/account/components/AccessToken.vue": 1,
  "src/views/account/utils/hook.tsx": 1,
  "src/views/analysis/report/components/ReportTablePreview.vue": 1,
  "src/views/approval/components/ApprovalStats.vue": 1,
  "src/views/approval/instance/components/StartInstanceDialog.vue": 1,
  "src/views/chat/components/ChatSidebar.vue": 1,
  "src/views/dashboard/components/ChartCard.vue": 2,
  "src/views/dashboard/dataset/utils/hook.tsx": 1,
  "src/views/dashboard/index.vue": 3,
  "src/views/form/data/utils/hook.tsx": 2,
  "src/views/integration/ai/config.vue": 1,
  "src/views/integration/ai/index.vue": 2,
  "src/views/integration/ai/utils/__tests__/aiProfileActions.spec.ts": 1,
  "src/views/integration/api-app/utils/__tests__/apiAppActions.spec.ts": 1,
  "src/views/integration/knowledge/components/KnowledgePanel.vue": 1,
  "src/views/integration/knowledge/utils/__tests__/knowledgeActions.spec.ts": 1,
  "src/views/login/components/Basic.vue": 1,
  "src/views/oauth/callback.vue": 1,
  "src/views/settings/components/settings/SettingItem.vue": 1,
  "src/views/settings/message/components/MessageTemplatePanel.vue": 2,
  "src/views/settings/security/index.vue": 1,
  "src/views/settings/sms.vue": 1,
  "src/views/system/directory/components/DirectoryAside.vue": 1,
  "src/views/system/menu/components/MenuDrawerForm.vue": 1,
  "src/views/system/menu/components/MenuFormPermission.vue": 1,
  "src/views/system/menu/utils/menuActions.spec.ts": 1,
  "src/views/system/menu/utils/normalize.spec.ts": 7,
  "src/views/system/menu/utils/useMenuData.ts": 3,
  "src/views/system/menu/utils/useMenuFilter.spec.ts": 1,
  "src/views/system/menu/utils/useMenuTree.ts": 1,
  "src/views/system/monitor/utils/hook.ts": 1,
  "src/views/system/permission/components/RuleFieldPicker.vue": 1,
  "src/views/system/permission/components/ScopeSelect.vue": 2,
  "src/views/system/permission/components/useTrialPanel.ts": 1,
  "src/views/system/role/components/MenuPermissionTree.vue": 1,
  "src/views/system/user/utils/__tests__/userActions.spec.ts": 1
};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      rows.push(...walk(full));
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      rows.push(full);
    }
  }
  return rows;
}

const rows = walk(join(ROOT, SCAN_DIR)).map(file => {
  const hits = readFileSync(file, "utf-8").match(PATTERN)?.length ?? 0;
  return { rel: relative(ROOT, file).split("\\").join("/"), hits };
});

const found = rows
  .filter(({ hits }) => hits > 0)
  .sort((a, b) => b.hits - a.hits);
const total = found.reduce((sum, { hits }) => sum + hits, 0);
console.log(
  `as-unknown-as 门禁：扫描 ${rows.length} 个源文件，共 ${total} 处 / ${found.length} 文件（基线 ${Object.keys(BASELINE).length} 文件）。`
);

if (process.argv.includes("--report")) {
  for (const { rel, hits } of found) {
    console.log(`  ${String(hits).padStart(3)} 处  ${rel}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, hits } of found) {
  if (BASELINE[rel] === undefined) {
    violations.push(
      `${rel}: ${hits} 处（未登记的新增类型逃逸——请用具体类型收窄或登记基线并说明）`
    );
  } else if (hits > BASELINE[rel]) {
    violations.push(
      `${rel}: ${hits} 处（超过基线 ${BASELINE[rel]}，只减不增）`
    );
  }
}

const cleared = Object.keys(BASELINE).filter(rel => {
  const row = found.find(({ rel: r }) => r === rel);
  return !row || row.hits === 0;
});
if (cleared.length > 0) {
  console.log("以下文件已清零，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error("\nas-unknown-as 门禁失败（未登记新增 / 存量禁止增长）：");
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}

console.log("as-unknown-as 门禁通过（基线均未增长）。");
