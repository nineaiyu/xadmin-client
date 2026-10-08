import { h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { createFormData, delay, deviceDetection } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import type { userInfoApi } from "@/api/user/userinfo";
import { addDialog } from "@/components/ReDialog/index";
import { handleOperation } from "@/components/RePlusPage";
import { picturePng } from "@/views/system/hooks";
import croppingUpload from "@/components/RePictureUpload";
import type { CropperPayload } from "@/components/RePictureUpload";

/** 头像上传弹窗（裁剪 → 上传 → 回刷资料；自 useUserProfileForm 拆出，行为不变） */
export function useAvatarUpload({
  api,
  onUploaded
}: {
  api: { upload: typeof userInfoApi.upload };
  /** 上传成功后的回刷（资料重新拉取） */
  onUploaded: () => void;
}) {
  const { t } = useI18n();
  const avatarInfo = ref();
  const cropRef = ref();

  const handleUpload = (row: RecordType) => {
    addDialog({
      title: t("userinfo.updateAvatar", { user: row.username }),
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      // destroyOnClose: true,
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: picturePng(row?.avatar) ?? "",
          onCropper: (info: CropperPayload) => (avatarInfo.value = info),
          circled: true,
          quality: 1,
          ref: cropRef,
          canvasOption: { width: 512, height: 512 }
        }),
      beforeSure: (done, { closeLoading }) => {
        const formData = createFormData({
          file: new File([avatarInfo.value.blob], "avatar.png", {
            type: avatarInfo.value.blob.type,
            lastModified: Date.now()
          })
        });
        handleOperation({
          t,
          apiReq: api.upload(formData),
          success() {
            onUploaded();
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      },
      beforeClose: done => {
        cropRef.value.hidePopover();
        delay(200).then(() => {
          done();
        });
      }
    });
  };

  return { handleUpload };
}
