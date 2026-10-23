import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import type { userInfoApi } from "@/api/user/userinfo";
import { useAvatarCropUpload } from "@/hooks/useAvatarCropUpload";
import { picturePng } from "@/views/system/hooks";

/** 账户设置头像上传（裁剪 → 上传 → 回刷资料）。 */
export function useAvatarUpload({
  api,
  onUploaded
}: {
  api: { upload: typeof userInfoApi.upload };
  /** 上传成功后的回刷（资料重新拉取） */
  onUploaded: () => void;
}) {
  const { t } = useI18n();
  return useAvatarCropUpload({
    title: (row: RecordType) =>
      t("userinfo.updateAvatar", { user: row.username }),
    imgSrc: (row: RecordType) => picturePng(row?.avatar) ?? "",
    upload: (_row, formData) => api.upload(formData),
    onSuccess: () => onUploaded()
  });
}
