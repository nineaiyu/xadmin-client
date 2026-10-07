import { computed, h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ElAlert,
  ElDescriptions,
  ElDescriptionsItem,
  ElTag
} from "element-plus";
import {
  accountRiskApi,
  type AccountRiskHandleAction,
  type AccountRiskStats
} from "@/api/system/security";
import { SUCCESS_CODE } from "@/api/types";
import { usePageAuth } from "@/router/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { addDrawer } from "@/components/ReDrawer";
import { message } from "@/utils/message";
import type { StatsGroup, StatsChip } from "./stats";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn,
  formatPageColumns
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Search from "~icons/ep/search";
import Edit from "~icons/ep/edit";
import RiskHandleForm from "../components/RiskHandleForm.vue";

/** 处置表单实例（getPayload 契约；动作取服务端枚举，备注自由文本） */
type RiskHandleFormInstance = {
  getPayload: () => { action: AccountRiskHandleAction; remark: string };
};

type TagType = "primary" | "success" | "warning" | "info" | "danger";

/** 风险等级 / 状态 → ElTag type 映射（与后端 RISK_LEVEL_COLORS 同语义） */
const LEVEL_TAG: Record<string, TagType> = {
  high: "danger",
  medium: "warning",
  low: "info"
};
const STATUS_TAG: Record<string, TagType> = {
  pending: "warning",
  resolved: "success",
  ignored: "info"
};

/** 风险类型 → i18n label（后端 choices 的英文 label 仅兜底） */
const RISK_TYPE_KEYS: Record<string, string> = {
  password_expired: "accountRisk.typePasswordExpired",
  password_stale: "accountRisk.typePasswordStale",
  login_stale: "accountRisk.typeLoginStale",
  never_logged_in: "accountRisk.typeNeverLoggedIn",
  superuser_no_mfa: "accountRisk.typeSuperuserNoMfa",
  superuser_count: "accountRisk.typeSuperuserCount"
};

/** 风险明细指标键 → i18n label（后端 detail 的量化字段；未知键回退原键名） */
const METRIC_LABEL_KEYS: Record<string, string> = {
  days: "accountRisk.metricDays",
  count: "accountRisk.metricCount",
  threshold: "accountRisk.metricThreshold",
  date_password_updated: "accountRisk.metricPasswordUpdatedAt"
};

/**
 * 风险明细的指标条目：metrics 子对象优先；后端当前为平铺结构
 * （量化字段与 description/suggestion 同级），回退取 detail 除去
 * 已单独渲染的说明/建议后的其余键。
 */
export function metricEntriesOf(detail: RecordType): Array<[string, unknown]> {
  const metrics = detail.metrics;
  if (metrics && typeof metrics === "object") {
    return Object.entries(metrics as RecordType);
  }
  return Object.entries(detail).filter(
    ([key]) =>
      key !== "description" && key !== "suggestion" && key !== "metrics"
  );
}

/** 指标值统一文本化：标量直出，复合值 JSON 序列化（避免 [object Object]） */
export function metricText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** 统计面板的等级 / 状态展示顺序（后端字典值之外的 key 追加在后） */
const LEVEL_ORDER = ["high", "medium", "low"];
const STATUS_ORDER = ["pending", "resolved", "ignored"];
const LEVEL_LABEL_KEYS: Record<string, string> = {
  high: "accountRisk.levelHigh",
  medium: "accountRisk.levelMedium",
  low: "accountRisk.levelLow"
};
const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "accountRisk.statusPending",
  resolved: "accountRisk.statusResolved",
  ignored: "accountRisk.statusIgnored"
};

export function useAccountRisk(tableRef: Ref, selectedRows: Ref<RecordType[]>) {
  const { t } = useI18n();

  const api = reactive(accountRiskApi);
  const auth = usePageAuth(["scan", "handle", "batchHandle", "stats"]);

  /* ---------------- 统计面板（消费 stats 端点） ---------------- */
  const stats = ref<AccountRiskStats | null>(null);

  /** 计数分布 → 面板 chip（展示顺序固定，后端多出的枚举值追加在后） */
  const chipsOf = (
    source: Record<string, number>,
    order: string[],
    labelKeys: Record<string, string>,
    tagTypes: Record<string, TagType>
  ): StatsChip[] =>
    [...order, ...Object.keys(source).filter(key => !order.includes(key))]
      .filter(key => source[key] !== undefined)
      .map(key => ({
        key,
        label: labelKeys[key] ? t(labelKeys[key]) : key,
        type: tagTypes[key] ?? "info",
        count: source[key]
      }));

  const statsGroups = computed<StatsGroup[]>(() => {
    const data = stats.value;
    if (!data) return [];
    const groups: StatsGroup[] = [
      {
        key: "overview",
        title: t("accountRisk.statsOverview"),
        chips: [
          {
            key: "total",
            label: t("accountRisk.statsTotal"),
            type: "primary",
            count: data.total
          },
          {
            key: "pending",
            label: t("accountRisk.statusPending"),
            type: STATUS_TAG.pending,
            count: data.pending
          }
        ]
      },
      {
        key: "level",
        title: t("accountRisk.statsByLevel"),
        chips: chipsOf(
          data.by_level ?? {},
          LEVEL_ORDER,
          LEVEL_LABEL_KEYS,
          LEVEL_TAG
        )
      },
      {
        key: "status",
        title: t("accountRisk.statsByStatus"),
        chips: chipsOf(
          data.by_status ?? {},
          STATUS_ORDER,
          STATUS_LABEL_KEYS,
          STATUS_TAG
        )
      },
      {
        key: "type",
        title: t("accountRisk.statsByType"),
        chips: (data.by_type ?? []).map(item => ({
          key: item.risk_type,
          label: RISK_TYPE_KEYS[item.risk_type]
            ? t(RISK_TYPE_KEYS[item.risk_type])
            : item.risk_type,
          count: item.count
        }))
      }
    ];
    return groups.filter(group => group.chips.length > 0);
  });

  /** 刷新统计面板：仅 stats 权限内拉取；加载失败静默降级为不渲染（不提示、不阻断列表） */
  const refreshStats = () => {
    if (!auth.stats) return;
    api
      .stats()
      .then(res => {
        stats.value = res.code === SUCCESS_CODE ? (res.data ?? null) : null;
      })
      .catch(() => {
        stats.value = null;
      });
  };
  refreshStats();

  /** 取 LabeledChoiceField 的 value / label（兼容后端下发标量的情况） */
  const pick = (raw: unknown) => {
    if (raw && typeof raw === "object" && "value" in (raw as RecordType)) {
      const item = raw as { value: string; label?: string };
      return { value: item.value, label: item.label ?? item.value };
    }
    return { value: String(raw ?? ""), label: String(raw ?? "") };
  };

  const renderTag = (
    row: RecordType,
    key: string,
    mapping: Record<string, TagType>
  ) => {
    const { value, label } = pick(row?.[key]);
    if (!value) return h("span", "-");
    return h(
      ElTag,
      { type: mapping[value] ?? "info", effect: "light" },
      () => label || value
    );
  };

  /** 处置弹窗（单行/批量共用）：表单在 RiskHandleForm 内，载荷经 getPayload 取回 */
  const handleFormRef = ref<RiskHandleFormInstance>();
  const handleDialog = (pks: Array<string | number>) => {
    addDialog({
      title: t("accountRisk.handleTitle", { count: pks.length }),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(RiskHandleForm, { ref: handleFormRef }),
      beforeSure: (done, { closeLoading }) => {
        const payload = handleFormRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const request =
          pks.length > 1
            ? api.batchHandle(pks, payload.action, payload.remark)
            : api.handle(pks[0], payload.action, payload.remark);
        handleOperation({
          t,
          apiReq: request.catch(error => ({
            code: -1,
            data: null,
            detail: String(error?.message ?? error)
          })),
          success(res) {
            done();
            tableRef.value?.handleGetData?.();
            refreshStats();
            // 批量处置为逐项独立执行（code 成功也含失败项）：补逐条 pk+原因明细，
            // 与审批批量转交的部分失败提示同范式（明细最多展示 3 条防刷屏）
            const failures =
              (
                res?.data as {
                  failures?: Array<{ pk: string; reason: string }>;
                }
              )?.failures ?? [];
            if (pks.length > 1 && failures.length) {
              message(
                t("accountRisk.batchHandlePartial", {
                  n: failures.length,
                  detail: failures
                    .slice(0, 3)
                    .map(item => `${item.pk}: ${item.reason}`)
                    .join("；")
                }),
                { type: "warning" }
              );
            }
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  const openDetail = (row: RecordType) => {
    const detail = (row?.detail ?? {}) as RecordType;
    addDrawer({
      title: t("accountRisk.detailTitle", { name: row?.user_display || "-" }),
      size: "40%",
      destroyOnClose: true,
      hideFooter: true,
      props: { row },
      contentRenderer: () =>
        h("div", { class: "px-2" }, [
          h(ElAlert, {
            type: "info",
            closable: false,
            showIcon: true,
            title: String(detail.description ?? row?.remark ?? "-"),
            class: "mb-3"
          }),
          h(ElDescriptions, { column: 1, border: true }, () => [
            h(ElDescriptionsItem, { label: t("accountRisk.suggestion") }, () =>
              String(detail.suggestion ?? "-")
            ),
            // 量化指标逐键结构化展示（键名走 i18n，未知键回退原键）
            ...metricEntriesOf(detail).map(([key, value]) =>
              h(
                ElDescriptionsItem,
                {
                  label: METRIC_LABEL_KEYS[key]
                    ? t(METRIC_LABEL_KEYS[key])
                    : key
                },
                () => metricText(value)
              )
            )
          ])
        ])
    });
  };

  const scan = () => {
    handleOperation({
      t,
      apiReq: api.scan().catch(error => ({
        code: -1,
        data: null,
        detail: String(error?.message ?? error)
      })),
      success() {
        tableRef.value?.handleGetData?.();
        refreshStats();
      }
    });
  };

  /** 批量处置按钮显隐：由 selection-change 驱动的响应式选中态决定（点击时仍以
   * getSelectPks 实时取 pk，两处口径一致）；每行渲染回调查询选中数会随表格
   * 重渲染反复执行，收敛为 computed 后只在选择变化时重算 */
  const canBatchHandle = computed(() =>
    Boolean(auth.batchHandle && selectedRows.value.length)
  );

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("accountRisk.scan"),
        code: "scan",
        props: { type: "primary", icon: useRenderIcon(Search) },
        onClick: () => scan(),
        show: auth.scan
      },
      {
        text: t("accountRisk.batchHandle"),
        code: "batchHandle",
        props: { type: "warning", plain: true, icon: useRenderIcon(Edit) },
        onClick: () => {
          const pks = tableRef.value?.getSelectPks?.() ?? [];
          if (!pks.length) return;
          handleDialog(pks);
        },
        show: canBatchHandle
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 180,
    buttons: [
      {
        text: t("accountRisk.detail"),
        code: "detail",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDetail(row),
        show: true
      },
      {
        text: t("accountRisk.handle"),
        code: "handle",
        props: { type: "warning", link: true },
        onClick: ({ row }) => handleDialog([row.pk]),
        show: auth.handle
      }
    ]
  });

  const formathandledCamelatcreatedCameltimeColumn = (
    column: PageTableColumn
  ) => {
    column["cellRenderer"] = scope => {
      const value = scope.row?.[column.prop as string];
      return h(
        "span",
        value ? String(value).replace("T", " ").slice(0, 19) : "-"
      );
    };
  };

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      risk_type: column => {
        column["cellRenderer"] = scope => {
          const { value, label } = pick(scope.row?.risk_type);
          const key = RISK_TYPE_KEYS[value];
          return h(ElTag, { type: "info", effect: "plain" }, () =>
            key ? t(key) : label || value
          );
        };
      },
      level: column => {
        column["cellRenderer"] = scope =>
          renderTag(scope.row, "level", LEVEL_TAG);
      },
      status: column => {
        column["cellRenderer"] = scope =>
          renderTag(scope.row, "status", STATUS_TAG);
      },
      handled_at: formathandledCamelatcreatedCameltimeColumn,
      created_time: formathandledCamelatcreatedCameltimeColumn
    });

  return {
    api,
    auth,
    statsGroups,
    tableBarButtonsProps,
    operationButtonsProps,
    listColumnsFormat
  };
}
