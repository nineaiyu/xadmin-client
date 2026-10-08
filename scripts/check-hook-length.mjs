#!/usr/bin/env node
// hook 超长门禁（≥120 行的 hook 形态文件禁止新增、存量只减不增）。
//
// 口径：`src` 下文件名形如 `useXxx.ts` / `useXxx.tsx` / `hook.tsx`（排除 `.spec.`、
// `__tests__`、`.d.ts`）。行数 ≥ 120 计入。行数门禁（check-file-length 的 500 行）
// 管不到该区间，此前存量从 45 增长到 80+，本门禁用于防回潮 + 存量逐步下沉。
//
// 用法：
//   node scripts/check-hook-length.mjs            # 门禁（CI 用）
//   node scripts/check-hook-length.mjs --report   # 仅报告分布，恒不失败
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIR = "src";
const THRESHOLD = 120;
const HOOK_PATTERN = /^(use[A-Z].*|hook)\.(ts|tsx)$/;

// 存量基线：相对路径 -> 行数（只减不增；拆到 <120 即从此表移除）。
// 2026-10-08：初始登记（此前 R3 滚动债余量 45 个后又自然增长，门禁首次覆盖 120 线）。
const BASELINE = {
  "src/components/RePlusPage/src/utils/hook.tsx": 243,
  "src/components/RePlusPage/src/utils/usePlusPageButtons.ts": 251,
  "src/components/RePlusPage/src/utils/usePlusPageColumns.ts": 129,
  "src/components/RePlusPage/src/utils/usePlusPageData.ts": 218,
  "src/components/RePlusPage/src/utils/usePlusPageForm.ts": 217,
  "src/components/RePureTableBar/src/useTablePrefs.ts": 136,
  "src/hooks/useMfaVerify.ts": 154,
  "src/hooks/useSplitPaneConfig.ts": 122,
  "src/hooks/useWebAuthn.ts": 136,
  "src/layout/components/lay-search/useCommandPalette.ts": 250,
  "src/layout/components/lay-tag/hooks/useTagActions.ts": 283,
  "src/layout/components/lay-tag/hooks/useTagScroll.ts": 143,
  "src/layout/hooks/useDataThemeChange.ts": 155,
  "src/layout/hooks/useNav.ts": 183,
  "src/layout/hooks/useTag.ts": 265,
  "src/views/analysis/report/utils/hook.tsx": 234,
  "src/views/analysis/report/utils/useDesignMutations.ts": 148,
  "src/views/analysis/screen/utils/hook.tsx": 230,
  "src/views/analysis/screen/utils/useScreenDisplay.ts": 188,
  "src/views/approval/flow/utils/hook.tsx": 160,
  "src/views/approval/instance/utils/hook.tsx": 120,
  "src/views/approval/instance/utils/useInstanceBatchActions.tsx": 168,
  "src/views/approval/instance/utils/useInstanceButtons.ts": 313,
  "src/views/approval/instance/utils/useInstanceNodeActions.tsx": 162,
  "src/views/approval/leave/utils/hook.tsx": 279,
  "src/views/approval/utils/hook.tsx": 131,
  "src/views/approval/utils/useApprovalRowActions.ts": 178,
  "src/views/chat/hooks/useChat.ts": 299,
  "src/views/chat/hooks/useChatSocket.ts": 150,
  "src/views/chat/hooks/useRooms.ts": 158,
  "src/views/dashboard/dataset/utils/hook.tsx": 349,
  "src/views/demo/book/utils/hook.tsx": 216,
  "src/views/form/data/utils/hook.tsx": 167,
  "src/views/form/designer/utils/hook.tsx": 295,
  "src/views/form/my/utils/useFormMyActions.ts": 208,
  "src/views/form/my/utils/useFormMyColumns.ts": 165,
  "src/views/integration/ai/hooks/useAiConsole.ts": 184,
  "src/views/integration/ai/hooks/useAiConsoleStream.ts": 187,
  "src/views/integration/ai/mcp/utils/hook.tsx": 201,
  "src/views/integration/ai/utils/useAiProfiles.tsx": 224,
  "src/views/integration/api-app/utils/hook.tsx": 211,
  "src/views/integration/knowledge/utils/hook.tsx": 161,
  "src/views/integration/knowledge/utils/useKnowledgeActions.ts": 222,
  "src/views/integration/knowledge/utils/useKnowledgeBuild.ts": 131,
  "src/views/integration/subscription/utils/hook.tsx": 195,
  "src/views/login/useLoginFlow.ts": 265,
  "src/views/settings/login-policy/utils/hook.tsx": 121,
  "src/views/system/celery/logs/utils/hook.tsx": 263,
  "src/views/system/celery/task/utils/useTaskRowActions.ts": 152,
  "src/views/system/celery/task/utils/useTaskToolbar.ts": 136,
  "src/views/system/components/useTagAssign.tsx": 124,
  "src/views/system/config/system/utils/hook.tsx": 120,
  "src/views/system/dict/utils/hook.tsx": 216,
  "src/views/system/file/utils/hook.tsx": 258,
  "src/views/system/logs/operation/utils/hook.tsx": 214,
  "src/views/system/mask/utils/hook.tsx": 236,
  "src/views/system/menu/utils/hook.tsx": 224,
  "src/views/system/menu/utils/useMenuData.ts": 149,
  "src/views/system/menu/utils/useMenuDrawer.ts": 296,
  "src/views/system/menu/utils/useMenuFilter.ts": 148,
  "src/views/system/menu/utils/useMenuMutations.ts": 175,
  "src/views/system/module/utils/hook.ts": 213,
  "src/views/system/monitor/utils/hook.ts": 266,
  "src/views/system/notice/read/hook.tsx": 123,
  "src/views/system/notice/utils/useNoticeFormOptions.tsx": 143,
  "src/views/system/online/utils/hook.tsx": 149,
  "src/views/system/permission/components/useTrialPanel.ts": 241,
  "src/views/system/permission/utils/usePermissionFormOptions.ts": 136,
  "src/views/system/post/utils/hook.tsx": 208,
  "src/views/system/role/utils/hook.tsx": 125,
  "src/views/system/tag/utils/hook.tsx": 137,
  "src/views/system/user/utils/hook.tsx": 279,
  "src/views/system/user/utils/useUserButtons.ts": 136,
  "src/views/system/user/utils/useUserFormOptions.ts": 146,
  "src/views/system/user/utils/useUserListColumns.tsx": 175,
  "src/views/system/user/utils/useUserResetPassword.tsx": 159,
  "src/views/user/notice/utils/hook.tsx": 245,
  "src/views/welcome/hook.tsx": 215
};

function walk(dir) {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      rows.push(...walk(full));
    } else if (HOOK_PATTERN.test(entry) && !entry.includes(".spec.")) {
      rows.push(full);
    }
  }
  return rows;
}

const rows = walk(join(ROOT, SCAN_DIR)).map(file => {
  const rel = relative(ROOT, file).split("\\").join("/");
  // 行数与 `wc -l` / 逐行读取口径一致：末尾换行不额外计行
  const content = readFileSync(file, "utf-8");
  const lines = content.replace(/\n$/, "").split("\n").length;
  return { rel, lines };
});

const found = rows
  .filter(({ lines }) => lines >= THRESHOLD)
  .sort((a, b) => b.lines - a.lines);
console.log(
  `hook 超长门禁：扫描 ${rows.length} 个 hook 文件，≥${THRESHOLD} 行 ${found.length} 个（基线 ${Object.keys(BASELINE).length} 个）。`
);

if (process.argv.includes("--report")) {
  for (const { rel, lines } of found) {
    console.log(`  ${String(lines).padStart(4)}  ${rel}`);
  }
  process.exit(0);
}

const violations = [];
for (const { rel, lines } of found) {
  if (BASELINE[rel] === undefined) {
    violations.push(
      `${rel}: ${lines} 行（未登记的超长 hook 新增——请拆分或登记基线）`
    );
  } else if (lines > BASELINE[rel]) {
    violations.push(
      `${rel}: ${lines} 行（超过基线 ${BASELINE[rel]}，只减不增）`
    );
  }
}
const cleared = Object.keys(BASELINE).filter(
  rel => !found.some(({ rel: r }) => r === rel)
);
if (cleared.length > 0) {
  console.log("以下文件已降到阈值内，可从 BASELINE 移除：");
  for (const rel of cleared.sort()) console.log(`  ${rel}`);
}

if (violations.length > 0) {
  console.error("\nhook 超长门禁失败（未登记新增 / 存量禁止增长）：");
  for (const item of violations) console.error(`  ${item}`);
  process.exit(1);
}
console.log("hook 超长门禁通过（基线均未增长）。");
