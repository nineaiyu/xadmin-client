import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElSwitch, ElTag, ElTooltip } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { buildScopeIndex, formatScopeLines } from "@/utils/scopeDisplay";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import {
  apiApplicationApi,
  loadScopeCatalog,
  type ApiApplicationCredential,
  type ApiApplicationItem,
  type ApplicationUsageStats,
  type CallbackProbeResult
} from "@/api/system/open";
import ApiApplicationForm from "../components/ApiApplicationForm.vue";

/**
 * API 应用（开放平台）：CRUD + 重置密钥 + 回调测试。
 *
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + ApiApplicationForm；
 * - 一次性明文密钥弹窗为只读展示场景（C5 既定保留手写），状态在本 hook 内维护，
 *   由页面模板渲染；
 * - 删除按钮保持关闭（现状页面不提供删除入口，迁移不改行为）；
 * - is_active 自定义开关渲染：默认编辑按钮关闭（auth.partialUpdate=false）会连带
 *   禁用框架 boolean 列开关，故在列渲染层接管，失败回滚行内值。
 */
export function useApiApplication(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(apiApplicationApi);
  const auth = reactive({
    ...getDefaultAuths("IntegrationApiApp"),
    create: false,
    update: false,
    partialUpdate: false,
    destroy: false
  });
  const canCreate = hasAuth("create:IntegrationApiApp");
  const canEdit = hasAuth("partialUpdate:IntegrationApiApp");
  const canRegenerate = hasAuth("regenerateSecret:IntegrationApiApp");
  const canTestCallback = hasAuth("testCallback:IntegrationApiApp");
  const canStats = hasAuth("stats:IntegrationApiApp");

  const refresh = () => tableRef.value?.handleGetData();

  /* ---------------- 一次性密钥展示 ---------------- */
  const credentialDialog = ref(false);
  const credential = ref<ApiApplicationCredential | null>(null);
  const probeResults = ref<CallbackProbeResult[]>([]);

  const openCredential = (data: ApiApplicationCredential) => {
    credential.value = data;
    credentialDialog.value = true;
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message(t("apiApp.copied"), { type: "success" });
    } catch {
      message(t("apiApp.copyFailed"), { type: "warning" });
    }
  };

  /* ---------------- 行内启停 / 重置密钥 / 回调测试 ---------------- */
  const toggleActive = async (row: ApiApplicationItem, value: boolean) => {
    row.is_active = value;
    const res = await apiApplicationApi
      .partialUpdate(row.pk, { is_active: value })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) return;
    row.is_active = !value;
    message(String(res.detail ?? t("apiApp.saveFailed")), { type: "warning" });
  };

  const regenerateSecret = async (row: ApiApplicationItem) => {
    const res = await apiApplicationApi.regenerateSecret(row.pk);
    if (res.code === SUCCESS_CODE) {
      openCredential(res.data);
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const testCallback = async (row: ApiApplicationItem) => {
    const res = await apiApplicationApi.testCallback(row.pk);
    if (res.code === SUCCESS_CODE) {
      probeResults.value = res.data?.results ?? [];
      const failed = probeResults.value.filter(item => !item.success).length;
      message(
        failed
          ? t("apiApp.callbackFailed", { count: failed })
          : t("apiApp.callbackOk"),
        { type: failed ? "warning" : "success" }
      );
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /* ---------------- 用量报表（抽屉） ---------------- */
  const usageVisible = ref(false);
  const usageLoading = ref(false);
  const usageRow = ref<ApiApplicationItem | null>(null);
  const usage = ref<ApplicationUsageStats | null>(null);

  const openUsage = async (row: ApiApplicationItem) => {
    usageRow.value = row;
    usage.value = null;
    usageVisible.value = true;
    usageLoading.value = true;
    // 异常归一：抽屉 loading 不悬挂
    const res = await apiApplicationApi.stats(row.pk, 7).catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    usageLoading.value = false;
    if (res.code === SUCCESS_CODE) {
      usage.value = res.data as unknown as ApplicationUsageStats;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /* ---------------- 接口范围展示 ---------------- */
  // 目录只用于「把锚定正则还原成人可读路径」：拉取失败仅退回条目原文，不影响列表
  const scopeIndex = shallowRef(buildScopeIndex());
  loadScopeCatalog()
    .then(res => {
      if (res.code !== SUCCESS_CODE) return;
      scopeIndex.value = buildScopeIndex(res.data?.groups);
    })
    .catch(() => undefined);

  /* ---------------- 列渲染 ---------------- */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "scopes":
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
          break;
        case "is_active":
          column["cellRenderer"] = ({ row }) =>
            h(ElSwitch, {
              modelValue: (row as ApiApplicationItem).is_active,
              disabled: !canEdit,
              "onUpdate:modelValue": (value: boolean) =>
                toggleActive(row as ApiApplicationItem, value)
            });
          break;
        case "client_id":
          column["minWidth"] = 220;
          break;
      }
    });
    return columns;
  };

  /* ---------------- 新建 / 编辑（ReDialog + ApiApplicationForm） ---------------- */
  const formRef = ref<InstanceType<typeof ApiApplicationForm>>();

  const openDialog = (row: ApiApplicationItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("apiApp.edit") : t("apiApp.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(ApiApplicationForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? apiApplicationApi.partialUpdate(row.pk, payload)
            : apiApplicationApi.create(payload)
        ).catch(error => ({
          code: -1,
          data: null,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          // 资源授权为独立端点（全量替换）：加载失败时跳过，绝不覆盖为空
          const grants = formRef.value?.getGrants();
          const targetPk =
            row?.pk ?? (res.data as { pk?: string } | null)?.pk ?? "";
          if (grants === null) {
            message(t("apiApp.grant.loadFailed"), { type: "warning" });
          } else if (targetPk) {
            const grantRes = await apiApplicationApi
              .updateGrants(targetPk, grants)
              .catch(error => ({
                code: -1,
                detail: String((error as { detail?: string })?.detail ?? error)
              }));
            if (grantRes.code !== SUCCESS_CODE && grantRes.detail) {
              message(String(grantRes.detail), { type: "warning" });
            }
          }
          message(t("apiApp.saveOk"), { type: "success" });
          // 先关表单弹窗，一次性密钥弹窗紧接展示（列表/详情不回传明文）
          done();
          const created = res.data as unknown as
            ApiApplicationCredential | undefined;
          if (!row && created?.client_secret) {
            openCredential(created);
          }
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  /* ---------------- 按钮装配 ---------------- */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 360,
    buttons: [
      {
        text: t("apiApp.usage.title"),
        code: "usage",
        props: { type: "info", link: true },
        onClick: ({ row }) => openUsage(row as ApiApplicationItem),
        show: canStats && 10
      },
      {
        text: t("apiApp.regenerate"),
        code: "regenerate",
        props: { type: "primary", link: true },
        onClick: ({ row }) => regenerateSecret(row as ApiApplicationItem),
        show: canRegenerate && 20
      },
      {
        text: t("apiApp.testCallback"),
        code: "testCallback",
        props: { type: "success", link: true },
        onClick: ({ row }) => testCallback(row as ApiApplicationItem),
        show: canTestCallback && 30
      },
      {
        text: t("apiApp.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as ApiApplicationItem),
        show: canEdit && 5
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
    probeResults,
    copyText,
    usageVisible,
    usageLoading,
    usageRow,
    usage
  };
}
