import type { Ref } from "vue";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import { createSubmissionFormOpener } from "./formMyFormDialog";
import { createSubmissionActions } from "./formMySubmissionActions";
import { submissionApi } from "@/api/dataset/dform";
import type { FillableFormItem, SubmissionItem } from "@/api/dataset/dform";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 我的填报行动作：填报/编辑弹窗、详情抽屉与删除/提交/重新提交。
 * 弹窗装配见 formMyFormDialog.ts，行级动作见 formMySubmissionActions.ts，
 * 列表列渲染（useFormMyColumns）与装配入口见同目录 hook.tsx。
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

  const openForm = createSubmissionFormOpener({ t, refresh });

  const openFill = (form: FillableFormItem) => openForm(form, null);

  const openEdit = async (row: SubmissionItem) => {
    const detailRes = await submissionApi.retrieve(row.pk).catch(() => null);
    const detail = detailRes?.data as SubmissionItem | null;
    const current = forms.value.find(item => item.pk === row.form);
    let form = current;
    if (detail?.form_schema) {
      // 编辑既有提交必须按**提交时的 schema 快照**渲染：服务端按快照校验，
      // 用当前 schema 渲染会让改版后的旧草稿出现「未知键 / 必填缺失」
      form = {
        ...(current ?? {
          pk: detail.form,
          name: detail.form_name,
          description: "",
          approval_required: false,
          approval_flow: null,
          approval_flow_pk: null
        }),
        pk: detail.form,
        name: detail.form_name || current?.name || "",
        schema: { fields: detail.form_schema }
      };
    }
    if (!form) {
      message(t("dform.formUnavailable"), { type: "warning" });
      return;
    }
    openForm(form, row);
  };

  const { openDetail, remove, submitDraft, resubmit, cancel } =
    createSubmissionActions({ t, refresh, confirm });

  return {
    openFill,
    openEdit,
    openDetail,
    remove,
    submitDraft,
    resubmit,
    cancel
  };
}
