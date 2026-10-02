import { h, reactive, type ShallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { type buildScopeIndex, formatScopeLines } from "@/utils/scopeDisplay";
import type {
  ApiApplicationItem,
  CallbackProbeResult
} from "@/api/system/open";
import ApiAppPanel from "../components/ApiAppPanel.vue";
import { buildApiAppActionGroups } from "./apiAppActions";

/** 「管理」抽屉（行操作收敛）：接入与密钥 / 联调与验证 / 应用配置三组动作装配 */
export function useApiAppPanel({
  t,
  scopeIndex,
  copyText,
  openUsage,
  confirmRegenerate,
  runCallbackProbe,
  openDialog,
  flags
}: {
  t: ReturnType<typeof useI18n>["t"];
  /** 接口范围目录索引（目录加载完成后更新，抽屉实时取当前值） */
  scopeIndex: ShallowRef<ReturnType<typeof buildScopeIndex>>;
  copyText: (text: string) => Promise<void>;
  openUsage: (row: ApiApplicationItem) => void;
  confirmRegenerate: (row: ApiApplicationItem) => void;
  runCallbackProbe: (
    row: ApiApplicationItem,
    state?: { loading: boolean; results: CallbackProbeResult[] }
  ) => Promise<void>;
  openDialog: (row: ApiApplicationItem | null) => void;
  flags: {
    canStats: boolean;
    canRegenerate: boolean;
    canTestCallback: boolean;
    canEdit: boolean;
  };
}) {
  const openApiAppPanel = (row: ApiApplicationItem) => {
    // 接口范围明细：锚定正则还原为可读路径（目录未加载时退回条目原文）
    const scopeLines = formatScopeLines(row.scopes ?? [], scopeIndex.value)
      .split("\n")
      .filter(Boolean);
    // 回调测试状态由抽屉持有：结果在抽屉内即时更新（无需关闭抽屉看消息提示）
    const probe = reactive({
      loading: false,
      results: [] as CallbackProbeResult[]
    });
    const options: DrawerOptions = {
      title: t("apiApp.panelTitle", { name: row.name }),
      size: "520px",
      destroyOnClose: true,
      hideFooter: true
    };
    // 动作执行前先收起抽屉再打开二级弹层（避免抽屉与弹窗叠加、焦点归属混乱）
    const withClosed = (run: () => void) => () => {
      closeDrawer(options, 0);
      run();
    };
    options.contentRenderer = () =>
      h(ApiAppPanel, {
        row,
        scopeLines,
        probe,
        copy: copyText,
        groups: buildApiAppActionGroups({
          t,
          flags,
          handlers: {
            openUsage: withClosed(() => openUsage(row)),
            regenerate: withClosed(() => confirmRegenerate(row)),
            // 回调测试结果在抽屉内展示：不收起抽屉
            testCallback: () => runCallbackProbe(row, probe),
            edit: withClosed(() => openDialog(row))
          }
        })
      });
    addDrawer(options);
  };

  return { openApiAppPanel };
}
