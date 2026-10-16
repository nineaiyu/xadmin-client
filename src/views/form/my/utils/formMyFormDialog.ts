import { h, ref } from "vue";
import { ElButton } from "element-plus";
import { isSuccess } from "@/api/types";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { useDialogForm } from "@/hooks/useDialogForm";
import { submissionApi } from "@/api/dataset/dform";
import SubmissionForm from "../components/SubmissionForm.vue";
import type { FillableFormItem, SubmissionItem } from "@/api/dataset/dform";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 填报 / 编辑提交弹窗（自 useFormMyActions.ts 抽出，动态字段渲染在 SubmissionForm 中）。
 *
 * 草稿：新建填报或编辑既有草稿时附「保存草稿」（轻校验、跳过审批）；
 * 编辑已生效/已驳回的提交不提供草稿入口（避免把已生效数据改回草稿态）。
 */
export function createSubmissionFormOpener({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const submissionFormRef = ref<InstanceType<typeof SubmissionForm>>();

  return (form: FillableFormItem, submission: SubmissionItem | null = null) => {
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
        .catch(normalizeError)
        .finally(() => (savingDraft.value = false));
      if (isSuccess(res)) {
        message(t("dform.draftSaved"), { type: "success" });
        closeDialog(options, 0);
        refresh();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
    };

    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      readPayload: () => {
        // 客户端必填预检（联动显隐后的可见字段）：缺失时定位提示并中止提交；
        // 类型/格式等规则仍以服务端按 schema 校验为准（草稿保存不做必填预检）
        const missing = submissionFormRef.value?.validateRequired();
        if (missing) {
          message(t("dform.requiredFieldMissing", { name: missing.label }), {
            type: "warning"
          });
          return null;
        }
        return submissionFormRef.value?.getPayload();
      },
      submit: payload =>
        submission
          ? submissionApi.partialUpdate(submission.pk, payload)
          : submissionApi.create(payload),
      successText: t("dform.saveOk"),
      // 先关弹窗再刷新列表（避免刷新耗时导致弹窗滞留；useDialogForm 内 done 先于回调）
      onSuccess: refresh
    });

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
      beforeSure
    };
    addDialog(options);
  };
}
