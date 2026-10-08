import { SUCCESS_CODE } from "@/api/types";
import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { aiProfileApi, type AiProfileItem } from "@/api/ai/ai";
import AiProfileForm from "../components/AiProfileForm.vue";
import { normalizeError } from "@/utils/apiError";

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
    addDialog({
      title: row ? t("aiConfig.edit") : t("aiConfig.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(AiProfileForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? aiProfileApi.partialUpdate(row.pk, payload)
            : aiProfileApi.create(payload)
        ).catch(normalizeError);
        if (res.code === SUCCESS_CODE) {
          message(t("aiConfig.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  return { openDialog };
}
