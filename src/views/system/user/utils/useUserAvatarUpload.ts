import type { useI18n } from "vue-i18n";
import type { Ref, UnwrapNestedRefs } from "vue";
import type { RecordType } from "plus-pro-components";
import type { userApi } from "@/api/identity/user";
import { useAvatarCropUpload } from "@/hooks/useAvatarCropUpload";
import { picturePng } from "@/views/system/hooks";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 用户管理头像裁剪上传弹窗。 */
export function useUserAvatarUpload({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  tableRef: Ref;
}) {
  return useAvatarCropUpload({
    title: (row: RecordType) =>
      t("systemUser.updateAvatar", { user: row.username }),
    imgSrc: (row: RecordType) => picturePng(row?.avatar) ?? "",
    upload: (row, formData) => api.upload(row.pk, formData),
    onSuccess: () => tableRef.value.handleGetData()
  });
}
