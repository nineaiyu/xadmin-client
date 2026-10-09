import { reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { buildScopeIndex } from "@/utils/scopeDisplay";
import { SUCCESS_CODE } from "@/api/types";
import { apiApplicationApi, loadScopeCatalog } from "@/api/identity/open";
import { useApiAppCredential } from "./useApiAppCredential";
import { useApiAppActions } from "./useApiAppActions";
import { useApiAppUsage } from "./useApiAppUsage";
import { useApiAppDialog } from "./useApiAppDialog";
import { useApiAppPanel } from "./useApiAppPanel";
import { useApiAppColumns } from "./useApiAppColumns";
import { useApiAppButtons } from "./useApiAppButtons";

/**
 * API 应用（开放平台）：CRUD + 重置密钥 + 回调测试 + 统一「管理」抽屉。
 *
 * - 行操作收敛进抽屉：操作列只留编辑 / 管理，应用名与「管理」同为抽屉入口；
 *   抽屉内按「接入与密钥 / 联调与验证 / 应用配置」分组承载用量、重置密钥（含
 *   二次确认）、回调测试与编辑，回调测试结果在抽屉内即时回显；
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + ApiApplicationForm；
 * - 一次性明文密钥弹窗为只读展示场景（C5 既定保留手写），状态在本 hook 内维护，
 *   由页面模板渲染；
 * - 删除按钮保持关闭（现状页面不提供删除入口，迁移不改行为）；
 * - is_active 自定义开关渲染：默认编辑按钮关闭（auth.partialUpdate=false）会连带
 *   禁用框架 boolean 列开关，故在列渲染层接管，失败回滚行内值（启停的唯一入口，
 *   抽屉内不再重复提供）。
 *
 * 职责拆分：credential / actions / usage / dialog / panel 见同名子模块，
 * 列渲染见 useApiAppColumns、按钮装配见 useApiAppButtons。
 */
export function useApiApplication(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(apiApplicationApi);
  const auth = usePageAuth("IntegrationApiApp");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  auth.destroy = false;
  const canCreate = hasAuth("create:IntegrationApiApp");
  const canEdit = hasAuth("partialUpdate:IntegrationApiApp");
  const canRegenerate = hasAuth("regenerateSecret:IntegrationApiApp");
  const canTestCallback = hasAuth("testCallback:IntegrationApiApp");
  const canStats = hasAuth("stats:IntegrationApiApp");

  const refresh = () => tableRef.value?.handleGetData();

  const { credentialDialog, credential, openCredential, copyText } =
    useApiAppCredential();

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

  const { openDialog } = useApiAppDialog({ t, refresh, openCredential });

  /* ---------------- 接口范围展示 ---------------- */
  // 目录只用于「把锚定正则还原成人可读路径」：拉取失败仅退回条目原文，不影响列表
  const scopeIndex = shallowRef(buildScopeIndex());
  loadScopeCatalog()
    .then(res => {
      if (res.code !== SUCCESS_CODE) return;
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

  const { operationButtonsProps, tableBarButtonsProps } = useApiAppButtons({
    t,
    flags: { canCreate, canEdit },
    openDialog,
    openApiAppPanel
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps,
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
