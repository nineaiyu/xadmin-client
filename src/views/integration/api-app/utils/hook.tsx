import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElMessageBox, ElSwitch, ElTag, ElTooltip } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
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
import ApiAppPanel from "../components/ApiAppPanel.vue";
import { buildApiAppActionGroups } from "./apiAppActions";

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

  /**
   * 重置密钥：旧凭证立即失效、第三方集成需同步更新 —— 执行前二次确认。
   * （抽屉内触发，确认框为独立遮罩层，不依赖抽屉状态）
   */
  const confirmRegenerate = (row: ApiApplicationItem) => {
    ElMessageBox.confirm(
      t("apiApp.regenerateConfirm"),
      t("apiApp.regenerate"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning"
      }
    )
      .then(() => regenerateSecret(row))
      .catch(() => undefined);
  };

  /** 回调测试：state 由抽屉持有（测试结果在抽屉内即时展示） */
  const runCallbackProbe = async (
    row: ApiApplicationItem,
    state?: { loading: boolean; results: CallbackProbeResult[] }
  ) => {
    if (state) {
      state.loading = true;
      state.results = [];
    }
    const res = await apiApplicationApi.testCallback(row.pk).catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (state) state.loading = false;
    if (res.code === SUCCESS_CODE) {
      const results = res.data?.results ?? [];
      probeResults.value = results;
      if (state) state.results = results;
      const failed = results.filter(item => !item.success).length;
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
        case "name":
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
          break;
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
              "onUpdate:modelValue": (value: string | number | boolean) =>
                toggleActive(row as ApiApplicationItem, value as boolean)
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
          if (grants === null || grants === undefined) {
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

  /* ---------------- 管理抽屉（行操作收敛） ---------------- */
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
          flags: { canStats, canRegenerate, canTestCallback, canEdit },
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
        show: canEdit && -25
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
    probeResults,
    copyText,
    usageVisible,
    usageLoading,
    usageRow,
    usage
  };
}
