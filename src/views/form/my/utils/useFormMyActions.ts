import { SUCCESS_CODE } from "@/api/types";
import { h, ref, type Ref } from "vue";
import { ElButton } from "element-plus";
import { useConfirm } from "@/hooks/useConfirm";
import type { DialogOptions } from "@/components/ReDialog";
import { addDialog, closeDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { addDrawer } from "@/components/ReDrawer";
import { message } from "@/utils/message";
import {
  submissionApi,
  type FillableFormItem,
  type SubmissionItem
} from "@/api/dataset/dform";
import SubmissionForm from "../components/SubmissionForm.vue";
import SubmissionDetail from "../../components/SubmissionDetail.vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 我的填报行动作：填报/编辑弹窗、详情抽屉与删除/提交/重新提交。
 * 弹层装配与列表列渲染（useFormMyColumns）分离，装配入口见同目录 hook.tsx。
 */
export function useFormMyActions({
  t,
  tableRef,
  forms
}: {
  t: TFunction;
  tableRef: Ref;
  forms: Ref<FillableFormItem[]>;
}) {
  const confirm = useConfirm();
  const refresh = () => tableRef.value?.handleGetData?.();
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
        // 客户端必填预检（联动显隐后的可见字段）：缺失时定位提示并中止提交；
        // 类型/格式等规则仍以服务端按 schema 校验为准（草稿保存不做必填预检）
        const missing = submissionFormRef.value?.validateRequired();
        if (missing) {
          message(t("dform.requiredFieldMissing", { name: missing.label }), {
            type: "warning"
          });
          closeLoading();
          return;
        }
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
    if (!form) {
      // 表单不在「可填清单」里：多为表单已停用被过滤，点击编辑必须给出反馈
      message(t("dform.formUnavailable"), { type: "warning" });
      return;
    }
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
    if (
      !(await confirm(t("dform.removeConfirm", { name: row.form_name }), {
        confirmButtonClass: "el-button--danger",
        draggable: true
      }))
    ) {
      return;
    }
    // 异常归一为可读失败结果：请求异常不再产生 unhandled rejection
    const res = await submissionApi.destroy(row.pk).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (res.code === SUCCESS_CODE) {
      refresh();
      return;
    }
    // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式提示
    message(String(res.detail || t("results.failed")), { type: "warning" });
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

  return {
    openFill,
    openEdit,
    openDetail,
    remove,
    submitDraft,
    resubmit
  };
}
