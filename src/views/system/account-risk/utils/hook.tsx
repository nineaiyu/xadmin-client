import { getCurrentInstance, h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ElAlert,
  ElDescriptions,
  ElDescriptionsItem,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
  ElTag
} from "element-plus";
import {
  accountRiskApi,
  type AccountRiskHandleAction
} from "@/api/system/security";
import { getDefaultAuths } from "@/router/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { addDrawer } from "@/components/ReDrawer";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Search from "~icons/ep/search";
import Edit from "~icons/ep/edit";

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

export function useAccountRisk(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(accountRiskApi);
  const auth = reactive({
    scan: false,
    handle: false,
    batchHandle: false,
    stats: false,
    ...getDefaultAuths(getCurrentInstance(), [
      "scan",
      "handle",
      "batchHandle",
      "stats"
    ])
  });

  const actionOptions = shallowRef<
    Array<{ value: AccountRiskHandleAction; label: string }>
  >([]);
  actionOptions.value = [
    { value: "notify", label: t("accountRisk.actionNotify") },
    {
      value: "force_change_password",
      label: t("accountRisk.actionForcePassword")
    },
    { value: "force_logout", label: t("accountRisk.actionForceLogout") },
    { value: "disable", label: t("accountRisk.actionDisable") },
    { value: "ignore", label: t("accountRisk.actionIgnore") },
    { value: "resolve", label: t("accountRisk.actionResolve") }
  ];

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

  const handleDialog = (pks: Array<string | number>) => {
    const form = reactive<{ action: AccountRiskHandleAction; remark: string }>({
      action: "notify",
      remark: ""
    });
    addDialog({
      title: t("accountRisk.handleTitle", { count: pks.length }),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ElForm, { labelWidth: "90px" }, () => [
          h(
            ElFormItem,
            { label: t("accountRisk.action"), required: true },
            () =>
              h(
                ElSelect,
                {
                  modelValue: form.action,
                  class: "w-full",
                  "onUpdate:modelValue": (value: AccountRiskHandleAction) =>
                    (form.action = value)
                },
                () =>
                  actionOptions.value.map(item =>
                    h(ElOption, {
                      key: item.value,
                      label: item.label,
                      value: item.value
                    })
                  )
              )
          ),
          h(ElFormItem, { label: t("accountRisk.remark") }, () =>
            h(ElInput, {
              modelValue: form.remark,
              type: "textarea",
              rows: 3,
              maxlength: 200,
              showWordLimit: true,
              "onUpdate:modelValue": (value: string) => (form.remark = value)
            })
          )
        ]),
      beforeSure: (done, { closeLoading }) => {
        const request =
          pks.length > 1
            ? api.batchHandle(pks, form.action, form.remark)
            : api.handle(pks[0], form.action, form.remark);
        handleOperation({
          t,
          apiReq: request.catch(error => ({
            code: -1,
            data: null,
            detail: String(error?.message ?? error)
          })),
          success() {
            done();
            tableRef.value?.handleGetData?.();
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
            h(ElDescriptionsItem, { label: t("accountRisk.metrics") }, () =>
              JSON.stringify(detail.metrics ?? {}, null, 2)
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
      }
    });
  };

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
        show: () =>
          Boolean(auth.batchHandle && tableRef.value?.getSelectPks?.()?.length)
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

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "risk_type":
          column["cellRenderer"] = scope => {
            const { value, label } = pick(scope.row?.risk_type);
            const key = RISK_TYPE_KEYS[value];
            return h(ElTag, { type: "info", effect: "plain" }, () =>
              key ? t(key) : label || value
            );
          };
          break;
        case "level":
          column["cellRenderer"] = scope =>
            renderTag(scope.row, "level", LEVEL_TAG);
          break;
        case "status":
          column["cellRenderer"] = scope =>
            renderTag(scope.row, "status", STATUS_TAG);
          break;
        case "handled_at":
        case "created_time":
          column["cellRenderer"] = scope => {
            const value = scope.row?.[column.prop as string];
            return h(
              "span",
              value ? String(value).replace("T", " ").slice(0, 19) : "-"
            );
          };
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    tableBarButtonsProps,
    operationButtonsProps,
    listColumnsFormat
  };
}
