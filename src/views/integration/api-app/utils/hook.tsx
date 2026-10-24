import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { apiApplicationApi } from "@/api/identity/open";
import { useApiAppCredential } from "./useApiAppCredential";
import { useApiAppActions } from "./useApiAppActions";
import { useApiAppUsage } from "./useApiAppUsage";
import { useApiApplicationFormOptions } from "./useApiApplicationFormOptions";
import { useApiAppPanel } from "./useApiAppPanel";
import { useApiAppGrantsDialog } from "./useApiAppGrantsDialog";
import { useApiAppColumns } from "./useApiAppColumns";
import { useApiAppButtons } from "./useApiAppButtons";
import { useApiAppScopeIndex } from "./useApiAppScopeIndex";
import { useApiAppOpenDialog } from "./useApiAppOpenDialog";

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
 * - 删除入口按 destroy:IntegrationApiApp 显示（带二次确认；删除会级联失效凭证）；
 * - is_active 自定义开关渲染：页面接管启停的唯一入口，失败回滚行内值。
 */
export function useApiApplication(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(apiApplicationApi);
  const auth = usePageAuth("IntegrationApiApp");
  const canEdit = hasAuth("partialUpdate:IntegrationApiApp");
  const canRegenerate = hasAuth("regenerateSecret:IntegrationApiApp");
  const canTestCallback = hasAuth("testCallback:IntegrationApiApp");
  const canStats = hasAuth("stats:IntegrationApiApp");
  const canManageGrants =
    hasAuth("listGrants:IntegrationApiApp") &&
    hasAuth("updateGrants:IntegrationApiApp");

  const refresh = () => tableRef.value?.handleGetData();

  const credentialState = useApiAppCredential();
  const { openCredential, copyText } = credentialState;

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

  const { openDialog } = useApiAppOpenDialog(tableRef);

  const { openGrants } = useApiAppGrantsDialog({ t, refresh });

  const { scopeIndex } = useApiAppScopeIndex();

  const { openApiAppPanel } = useApiAppPanel({
    t,
    scopeIndex,
    copyText,
    openUsage,
    confirmRegenerate,
    runCallbackProbe,
    openDialog,
    openGrants,
    flags: {
      canStats,
      canRegenerate,
      canTestCallback,
      canEdit,
      canManageGrants
    }
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
    ...credentialState,
    usageVisible,
    usageLoading,
    usageRow,
    usageDays,
    usage,
    setUsageDays
  };
}
