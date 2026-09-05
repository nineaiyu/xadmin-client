import { ref } from "vue";

import { addDialog } from "@/components/ReDialog";
import croppingUpload from "@/components/RePictureUpload";
import { createFormData, deviceDetection } from "@pureadmin/utils";
import { h } from "vue";
import { handleOperation } from "@/components/RePlusPage";
import { picturePng } from "@/views/system/hooks";
import type { useI18n } from "vue-i18n";
import type { Ref, UnwrapNestedRefs } from "vue";
import type { userApi } from "@/api/system/user";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 用户视图头像裁剪上传弹窗 */
export function useUserAvatarUpload({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  tableRef: Ref;
}) {
  const cropRef = ref();
  const avatarInfo = ref();

  /** 上传头像 */
  function handleUpload(row) {
    addDialog({
      title: t("systemUser.updateAvatar", { user: row.username }),
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: picturePng(row?.avatar) ?? "",
          onCropper: info => (avatarInfo.value = info),
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
          apiReq: api.upload(row.pk, formData),
          success() {
            tableRef.value.handleGetData();
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      },
      closeCallBack: () => cropRef.value.hidePopover()
    });
  }

  return { cropRef, avatarInfo, handleUpload };
}
