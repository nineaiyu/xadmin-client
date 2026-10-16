import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { postApi, type PostItem } from "@/api/identity/post";
import PostForm from "../components/PostForm.vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 岗位新建/编辑弹窗（ReDialog + PostForm；提交底座见 useDialogForm） */
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
  // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
  const { beforeSure } = useDialogForm<Record<string, unknown>>({
    formRef,
    submit: payload =>
      row ? postApi.partialUpdate(row.pk, payload) : postApi.create(payload),
    successText: t("post.saveOk"),
    onSuccess: refresh
  });

  addDialog({
    title: row ? t("post.edit") : t("post.create"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(PostForm, { ref: formRef, row }),
    beforeSure
  });
}
