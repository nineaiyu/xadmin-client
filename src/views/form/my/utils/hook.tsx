import { SUCCESS_CODE } from "@/api/types";
import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  shallowRef
} from "vue";
import { useI18n } from "vue-i18n";
import { ElButton, ElMessageBox, ElTag } from "element-plus";
import type { DialogOptions } from "@/components/ReDialog";
import { addDialog, closeDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { addDrawer } from "@/components/ReDrawer";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import {
  submissionApi,
  type FillableFormItem,
  type SubmissionItem
} from "@/api/system/dform";
import SubmissionForm from "../components/SubmissionForm.vue";
import SubmissionDetail from "../components/SubmissionDetail.vue";

/** 提交状态（审批回写）语义色兜底：字典未配 color 时按审批结果取 EP 语义色，
 * tag props 统一经 `statusTagProps`（与列表/详情同口径，禁止页面自建映射函数） */
const SUBMISSION_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  DRAFT: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info"
};

/** 提交数据展示：非标量值 JSON 化，避免附件/日期范围/明细行渲染成 [object Object] */
export const submissionDataText = (data: Record<string, unknown>) =>
  Object.entries(data ?? {})
    .map(([key, value]) => {
      const text =
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : ((value ?? "-") as string);
      return `${key}: ${text}`;
    })
    .join(" | ") || "-";

/**
 * 我的填报（FormMySubmission）页面装配。
 *
 * 列表迁 RePlusPage 后本页只保留两处页面级形态：
 * - 顶部「可填表单」卡片区（填报入口，非表格工具栏语义）；
 * - 表格区由框架统一接管搜索、分页、列设置与行操作收敛。
 *
 * 提交数据（`data` JSON）不在后端 table_fields 里，由 `listColumnsFormat` 注入一列摘要；
 * 状态列覆写为语义色 tag（字典未配 color 时兜底），无状态的提交显示「无需审批」。
 */
export function useFormMySubmissions() {
  const { t } = useI18n();
  const tableRef = ref();
  const forms = ref<FillableFormItem[]>([]);

  const api = reactive(submissionApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance(), [
      "submit",
      "resubmit",
      "exportData",
      "availableForms",
      "userOptions"
    ])
  });
  // 本页「新增」入口是顶部可填表单卡片（选择表单填报），关闭表格工具栏的默认新增
  auth.create = false;

  const canEdit = hasAuth("partialUpdate:FormMySubmission");
  const canDestroy = hasAuth("destroy:FormMySubmission");
  const canResubmit = hasAuth("resubmit:FormMySubmission");
  const canSubmit = hasAuth("submit:FormMySubmission");

  const asRow = (row: unknown) => row as SubmissionItem;
  const statusOf = (row: unknown) => asRow(row).status?.value ?? "";
  const refresh = () => tableRef.value?.handleGetData?.();

  /** 可填报表单（启用中）：填报卡片数据源 */
  const loadForms = async () => {
    const res = await submissionApi.availableForms().catch(() => null);
    if (res?.code === SUCCESS_CODE) {
      forms.value = (res.data ?? []) as FillableFormItem[];
    }
  };

  onMounted(loadForms);

  const submissionFormRef = ref<InstanceType<typeof SubmissionForm>>();

  /**
   * 填报 / 编辑提交弹窗（动态字段渲染在 SubmissionForm 中）。
   *
   * 草稿：新建填报或编辑既有草稿时附「保存草稿」（轻校验、跳过审批）；
   * 编辑已生效/已驳回的提交不提供草稿入口（避免把已生效数据改回草稿态）。
   */
  const openForm = (
    form: FillableFormItem,
    submission: SubmissionItem | null = null
  ) => {
    submissionFormRef.value = undefined;
    const draftMode = !submission || submission.status?.value === "DRAFT";
    const savingDraft = ref(false);

    const saveDraft = async (options: DialogOptions) => {
      const payload = submissionFormRef.value?.getPayload();
      if (!payload) return;
      savingDraft.value = true;
      const res = await (
        submission
          ? submissionApi.partialUpdate(submission.pk, payload)
          : submissionApi.create({ ...payload, as_draft: true })
      )
        .catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }))
        .finally(() => (savingDraft.value = false));
      if (res.code === SUCCESS_CODE) {
        message(t("dform.draftSaved"), { type: "success" });
        closeDialog(options, 0);
        refresh();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
    };

    const options: DialogOptions = {
      title: submission ? t("dform.editSubmission") : form.name,
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h("div", [
          h(SubmissionForm, { ref: submissionFormRef, form, submission }),
          draftMode
            ? h("div", { class: "mt-1 flex justify-end" }, [
                h(
                  ElButton,
                  {
                    size: "small",
                    loading: savingDraft.value,
                    "data-testid": "submission-save-draft",
                    onClick: () => saveDraft(options)
                  },
                  () => t("dform.saveDraft")
                )
              ])
            : null
        ]),
      beforeSure: async (done, { closeLoading }) => {
        const payload = submissionFormRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          submission
            ? submissionApi.partialUpdate(submission.pk, payload)
            : submissionApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("dform.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表（避免刷新耗时导致弹窗滞留）
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    };
    addDialog(options);
  };

  const openFill = (form: FillableFormItem) => openForm(form, null);

  const openEdit = (row: SubmissionItem) => {
    const form = forms.value.find(item => item.pk === row.form);
    if (!form) return;
    openForm(form, row);
  };

  /** 提交详情抽屉：字段明细 + 审批轨迹（只读） */
  const openDetail = (row: SubmissionItem) => {
    addDrawer({
      title: `${row.form_name} - ${String(row.pk).slice(0, 8).toUpperCase()}`,
      size: "45%",
      destroyOnClose: true,
      closeOnClickModal: true,
      hideFooter: true,
      props: { row },
      contentRenderer: () => h(SubmissionDetail)
    });
  };

  const remove = async (row: SubmissionItem) => {
    try {
      await ElMessageBox.confirm(
        t("dform.removeConfirm", { name: row.form_name }),
        {
          confirmButtonText: t("buttons.sure"),
          cancelButtonText: t("buttons.cancel"),
          type: "warning",
          confirmButtonClass: "el-button--danger",
          draggable: true
        }
      );
    } catch {
      return;
    }
    const res = await submissionApi.destroy(row.pk);
    if (res.code === SUCCESS_CODE) refresh();
  };

  /** 提交草稿（仅草稿态）：服务端按 schema 严格校验后进入审批/直接生效 */
  const submitDraft = async (row: SubmissionItem) => {
    const res = await submissionApi.submit(row.pk).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (res.code === SUCCESS_CODE) {
      message(t("dform.submitDraftOk"), { type: "success" });
      refresh();
      return;
    }
    message(String(res.detail || t("results.failed")), { type: "warning" });
  };

  /** 重新提交被驳回的填报（仅申请人、仅驳回态：按当前数据重新发起流程实例） */
  const resubmit = async (row: SubmissionItem) => {
    const res = await submissionApi.resubmit(row.pk).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (res.code === SUCCESS_CODE) {
      message(t("dform.resubmitOk"), { type: "success" });
      refresh();
      return;
    }
    message(String(res.detail || t("results.failed")), { type: "warning" });
  };

  /** 状态列：字典色优先、缺省按状态语义兜底；无状态（无需审批）不留空 */
  const renderStatus = (row: SubmissionItem) => {
    const status = row.status;
    if (!status?.value) {
      return h(
        "span",
        { class: "text-xs text-(--el-text-color-secondary)" },
        t("dform.noApprovalNeeded")
      );
    }
    return h(
      ElTag,
      {
        size: "small",
        "data-testid": "submission-status-tag",
        ...statusTagProps(status, SUBMISSION_STATUS_TAG_TYPE)
      },
      () => status.label
    );
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const formatted: PageTableColumn[] = [];
    columns.forEach(column => {
      const key = column._column?.key as string;
      // 个人页不展示提交人列（全部为本人），减少噪声
      if (key === "creator") return;
      if (key === "status") {
        column["width"] = 120;
        column["cellRenderer"] = ({ row }) =>
          renderStatus(row as SubmissionItem);
      }
      if (key === "created_time") column["width"] = 170;
      formatted.push(column);
      if (key === "form_name") {
        // 提交数据摘要列：后端 table_fields 不含 data，由页面注入
        formatted.push({
          _column: { key: "data" },
          label: t("dform.submissionData"),
          minWidth: 240,
          cellRenderer: ({ row }: { row: RecordType }) =>
            h(
              "span",
              { class: "text-xs" },
              submissionDataText((row as SubmissionItem).data ?? {})
            )
        } as unknown as PageTableColumn);
      }
    });
    return formatted;
  };

  /** 搜索区：提交人筛选对个人页无意义，移除 */
  const searchColumnsFormat = (columns: PageTableColumn[]) =>
    columns.filter(column => column._column?.key !== "creator");

  // 行操作全部自定义（详情/编辑/提交/重新提交/删除），故关闭框架默认的编辑与删除按钮；
  // 导出沿用框架工具栏默认按钮（api.exportData + 选中行/异步开关，由 auth.exportData 控制）
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 320,
    showNumber: 5,
    hideDetail: true,
    buttons: [
      { code: "update", show: false },
      { code: "delete", show: false },
      {
        text: t("dform.detail"),
        code: "my-detail",
        props: {
          type: "primary",
          link: true,
          "data-testid": "submission-detail"
        },
        show: () => -50,
        onClick: ({ row }) => openDetail(row as SubmissionItem)
      },
      {
        text: (row: RecordType) =>
          statusOf(row) === "DRAFT" ? t("dform.continueEdit") : t("dform.edit"),
        code: "my-edit",
        props: { type: "primary", link: true },
        show: (row: RecordType) =>
          canEdit && statusOf(row) !== "PENDING" ? -40 : false,
        onClick: ({ row }) => openEdit(row as SubmissionItem)
      },
      {
        text: t("dform.submitDraft"),
        code: "my-submit",
        props: {
          type: "success",
          link: true,
          "data-testid": "submission-submit-draft"
        },
        show: (row: RecordType) =>
          canSubmit && statusOf(row) === "DRAFT" ? -30 : false,
        onClick: ({ row }) => submitDraft(row as SubmissionItem)
      },
      {
        text: t("dform.resubmit"),
        code: "my-resubmit",
        props: {
          type: "primary",
          link: true,
          "data-testid": "submission-resubmit"
        },
        show: (row: RecordType) =>
          canResubmit && statusOf(row) === "REJECTED" ? -20 : false,
        onClick: ({ row }) => resubmit(row as SubmissionItem)
      },
      {
        text: t("dform.delete"),
        code: "my-delete",
        props: { type: "danger", link: true },
        show: (row: RecordType) =>
          canDestroy && statusOf(row) !== "PENDING" ? -10 : false,
        onClick: ({ row }) => remove(row as SubmissionItem)
      }
    ]
  });

  return {
    api,
    auth,
    tableRef,
    forms,
    listColumnsFormat,
    searchColumnsFormat,
    operationButtonsProps,
    openFill,
    loadForms
  };
}
