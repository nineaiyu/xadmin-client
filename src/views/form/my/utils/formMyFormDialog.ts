import { h, ref } from "vue";
import { ElButton } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
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
        ).catch(normalizeError);
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
}
