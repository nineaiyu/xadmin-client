import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { tagApi, type TagItem } from "@/api/system/tag";
import TagForm from "../components/TagForm.vue";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 标签新建/编辑弹窗（ReDialog + TagForm），提交异常归一避免 loading 悬挂 */
export function openTagDialog({
  t,
  refresh,
  row
}: {
  t: TFunction;
  refresh: () => void;
  row: TagItem | null;
}) {
  const formRef = ref<InstanceType<typeof TagForm>>();

  addDialog({
    title: row ? t("tag.edit") : t("tag.create"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(TagForm, { ref: formRef, row }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免 beforeSure 抛错导致弹窗 loading 悬挂
      const res = await (
        row ? tagApi.partialUpdate(row.pk, payload) : tagApi.create(payload)
      ).catch(normalizeError);
      if (res.code === SUCCESS_CODE) {
        message(t("tag.saveOk"), { type: "success" });
        done();
        refresh();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
}
