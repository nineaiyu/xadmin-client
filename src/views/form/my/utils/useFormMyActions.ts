import type { Ref } from "vue";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import { createSubmissionFormOpener } from "./formMyFormDialog";
import { createSubmissionActions } from "./formMySubmissionActions";
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

  const openEdit = (row: SubmissionItem) => {
    const form = forms.value.find(item => item.pk === row.form);
    if (!form) {
      // 表单不在「可填清单」里：多为表单已停用被过滤，点击编辑必须给出反馈
      message(t("dform.formUnavailable"), { type: "warning" });
      return;
    }
    openForm(form, row);
  };

  const { openDetail, remove, submitDraft, resubmit } = createSubmissionActions(
    { t, refresh, confirm }
  );

  return {
    openFill,
    openEdit,
    openDetail,
    remove,
    submitDraft,
    resubmit
  };
}
