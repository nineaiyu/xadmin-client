import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { buildScopeIndex } from "@/utils/scopeDisplay";
import { isSuccess } from "@/api/types";
import {
  apiApplicationApi,
  loadScopeCatalog,
  type ApiApplicationItem
} from "@/api/identity/open";
import { useApiAppCredential } from "./useApiAppCredential";
import { useApiAppActions } from "./useApiAppActions";
import { useApiAppUsage } from "./useApiAppUsage";
import { useApiApplicationFormOptions } from "./useApiApplicationFormOptions";
import { useApiAppPanel } from "./useApiAppPanel";
import { useApiAppColumns } from "./useApiAppColumns";
import { useApiAppButtons } from "./useApiAppButtons";

/**
 * API 应用（开放平台）：CRUD + 重置密钥 + 回调测试 + 统一「管理」抽屉。
 *
 * - 行操作收敛进抽屉：操作列只留编辑 / 管理，应用名与「管理」同为抽屉入口；
 *   抽屉内按「接入与密钥 / 联调与验证 / 应用配置」分组承载用量、重置密钥（含
 *   二次确认）、回调测试与编辑，回调测试结果在抽屉内即时回显；
 * - 新增/编辑走框架元数据表单：基础字段由后端元数据装配，页面在
 *   `useApiApplicationFormOptions` 里把接口范围换成勾选器、清单字段换成逗号文本，
 *   并把「资源授权」注入为扩展字段（独立端点 + 全量替换 + 加载失败跳过保存）；
 * - 一次性明文密钥弹窗为只读展示场景（既定保留手写），状态在本 hook 内维护，
 *   由页面模板渲染；
 * - 删除按钮保持关闭（现状页面不提供删除入口，迁移不改行为）；
 * - is_active 自定义开关渲染：页面接管启停的唯一入口，失败回滚行内值。
 */
export function useApiApplication(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(apiApplicationApi);
  const auth = usePageAuth("IntegrationApiApp");
  auth.destroy = false;
  const canEdit = hasAuth("partialUpdate:IntegrationApiApp");
  const canRegenerate = hasAuth("regenerateSecret:IntegrationApiApp");
  const canTestCallback = hasAuth("testCallback:IntegrationApiApp");
  const canStats = hasAuth("stats:IntegrationApiApp");

  const refresh = () => tableRef.value?.handleGetData();

  const { credentialDialog, credential, openCredential, copyText } =
    useApiAppCredential();

  const { addOrEditOptions } = useApiApplicationFormOptions({
    t,
    openCredential
  });

  const { toggleActive, confirmRegenerate, runCallbackProbe } =
    useApiAppActions({ refresh, openCredential });

  const {
    usageVisible,
    usageLoading,
    usageRow,
    usageDays,
    usage,
    openUsage,
    setUsageDays
  } = useApiAppUsage();

  /** 抽屉内「编辑」与工具栏默认「新增」共用框架表单入口 */
  const openDialog = (row: ApiApplicationItem | null) => {
    if (row) tableRef.value?.handleAddOrEdit?.(false, row);
    else tableRef.value?.handleAddOrEdit?.(true);
  };

  /* ---------------- 接口范围展示 ---------------- */
  // 目录只用于「把锚定正则还原成人可读路径」：拉取失败仅退回条目原文，不影响列表
  const scopeIndex = shallowRef(buildScopeIndex());
  loadScopeCatalog()
    .then(res => {
      if (!isSuccess(res)) return;
      scopeIndex.value = buildScopeIndex(res.data?.groups);
    })
    .catch(() => undefined);

  const { openApiAppPanel } = useApiAppPanel({
    t,
    scopeIndex,
    copyText,
    openUsage,
    confirmRegenerate,
    runCallbackProbe,
    openDialog,
    flags: { canStats, canRegenerate, canTestCallback, canEdit }
  });

  const { listColumnsFormat } = useApiAppColumns({
    t,
    canEdit,
    scopeIndex,
    toggleActive,
    openApiAppPanel
  });

  const { operationButtonsProps } = useApiAppButtons({ t, openApiAppPanel });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps,
    credentialDialog,
    credential,
    copyText,
    usageVisible,
    usageLoading,
    usageRow,
    usageDays,
    usage,
    setUsageDays
  };
}
