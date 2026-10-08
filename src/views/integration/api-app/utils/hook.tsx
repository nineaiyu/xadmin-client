import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElSwitch, ElTag, ElTooltip } from "element-plus";
import { hasAuth, usePageAuth } from "@/router/utils";
import {
  formatPageColumns,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { buildScopeIndex, formatScopeLines } from "@/utils/scopeDisplay";
import { SUCCESS_CODE } from "@/api/types";
import {
  apiApplicationApi,
  loadScopeCatalog,
  type ApiApplicationItem
} from "@/api/system/open";
import { useApiAppCredential } from "./useApiAppCredential";
import { useApiAppActions } from "./useApiAppActions";
import { useApiAppUsage } from "./useApiAppUsage";
import { useApiAppDialog } from "./useApiAppDialog";
import { useApiAppPanel } from "./useApiAppPanel";

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
 * 职责拆分：
 * - useApiAppCredential  一次性密钥展示状态与剪贴板；
 * - useApiAppActions     行内启停/重置密钥/回调测试；
 * - useApiAppUsage       用量报表（抽屉）；
 * - useApiAppDialog      新建/编辑弹窗（含资源授权同步）；
 * - useApiAppPanel       「管理」抽屉装配。
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

  /* ---------------- 列渲染 ---------------- */
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      name: column => {
        // 应用名同为「管理」抽屉入口：名称即实体标识，点击最直观
        column["cellRenderer"] = ({ row }) => {
          const item = row as ApiApplicationItem;
          return h(
            ElLink,
            {
              type: "primary",
              onClick: () => openApiAppPanel(item)
            },
            () => item.name
          );
        };
      },
      scopes: column => {
        // 明细走 tooltip：条目本体是锚定正则，列内只显示条数，hover 看到可读路径
        column["minWidth"] = 130;
        column["cellRenderer"] = ({ row }) => {
          const scopes = (row as ApiApplicationItem).scopes ?? [];
          if (!scopes.length) return t("apiApp.unlimited");
          return h(
            ElTooltip,
            { placement: "top" },
            {
              default: () =>
                h(ElTag, { type: "info", size: "small" }, () =>
                  t("apiApp.scopeCount", { n: scopes.length })
                ),
              content: () =>
                h(
                  "div",
                  {
                    class: "text-xs",
                    style: { maxWidth: "420px", whiteSpace: "pre-line" }
                  },
                  formatScopeLines(scopes, scopeIndex.value)
                )
            }
          );
        };
      },
      is_active: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElSwitch, {
            modelValue: (row as ApiApplicationItem).is_active,
            disabled: !canEdit,
            "onUpdate:modelValue": (value: string | number | boolean) =>
              toggleActive(row as ApiApplicationItem, value as boolean)
          });
      },
      client_id: column => {
        column["minWidth"] = 220;
      }
    });

  /* ---------------- 按钮装配 ---------------- */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 行操作收敛后操作列只需容纳编辑 / 管理两个按钮
    width: 200,
    // 应用资料由「管理」抽屉承载，关闭框架默认详情入口避免重复
    hideDetail: true,
    buttons: [
      {
        text: t("apiApp.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as ApiApplicationItem),
        index: -25,
        show: canEdit
      },
      {
        text: t("apiApp.manage"),
        code: "manage",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openApiAppPanel(row as ApiApplicationItem),
        show: -15
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("apiApp.create"),
        code: "create",
        props: { type: "primary", "data-testid": "api-app-create" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
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
