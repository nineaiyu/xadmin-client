import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { aiProfileApi, type AiProfileItem } from "@/api/ai/ai";
import AiProfileForm from "../components/AiProfileForm.vue";

/** 新建/编辑弹窗（ReDialog + AiProfileForm）：api_key 留空沿用的语义收敛在表单内 */
export function useAiProfileDialog({
  t,
  refresh
}: {
  t: ReturnType<typeof useI18n>["t"];
  refresh: () => void;
}) {
  const formRef = ref<InstanceType<typeof AiProfileForm>>();

  const openDialog = (row: AiProfileItem | null) => {
    formRef.value = undefined;
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        row
          ? aiProfileApi.partialUpdate(row.pk, payload)
          : aiProfileApi.create(payload),
      successText: t("aiConfig.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: refresh
    });
    addDialog({
      title: row ? t("aiConfig.edit") : t("aiConfig.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(AiProfileForm, { ref: formRef, row }),
      beforeSure
    });
  };

  return { openDialog };
}
