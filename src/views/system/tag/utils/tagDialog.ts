import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import { tagApi, type TagItem } from "@/api/system/tag";
import TagForm from "../components/TagForm.vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 标签新建/编辑弹窗（ReDialog + TagForm；提交底座见 useDialogForm） */
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
  // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
  const { beforeSure } = useDialogForm<Record<string, unknown>>({
    formRef,
    submit: payload =>
      row ? tagApi.partialUpdate(row.pk, payload) : tagApi.create(payload),
    successText: t("tag.saveOk"),
    onSuccess: refresh
  });

  addDialog({
    title: row ? t("tag.edit") : t("tag.create"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(TagForm, { ref: formRef, row }),
    beforeSure
  });
}
