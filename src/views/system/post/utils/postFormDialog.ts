import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { postApi, type PostItem } from "@/api/system/post";
import PostForm from "../components/PostForm.vue";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 岗位新建/编辑弹窗（ReDialog + PostForm），提交异常归一避免 loading 悬挂 */
export function openPostFormDialog({
  t,
  refresh,
  row
}: {
  t: TFunction;
  refresh: () => void;
  row: PostItem | null;
}) {
  const formRef = ref<InstanceType<typeof PostForm>>();

  addDialog({
    title: row ? t("post.edit") : t("post.create"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(PostForm, { ref: formRef, row }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免 beforeSure 抛错导致弹窗 loading 悬挂
      const res = await (
        row ? postApi.partialUpdate(row.pk, payload) : postApi.create(payload)
      ).catch(normalizeError);
      if (res.code === SUCCESS_CODE) {
        message(t("post.saveOk"), { type: "success" });
        done();
        refresh();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
}
