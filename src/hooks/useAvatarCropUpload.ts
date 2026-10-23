import { h, ref } from "vue";
import { createFormData, delay, deviceDetection } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import type { DataEnvelope } from "@/api/types";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import croppingUpload from "@/components/RePictureUpload";
import type { CropperPayload } from "@/components/RePictureUpload";
import { useDialogForm } from "@/hooks/useDialogForm";

/**
 * 头像裁剪上传弹窗（账户设置与用户管理共用）。
 *
 * 只保留「裁剪弹窗 + FormData 组装 + 上传」三件事；提交状态机（校验守卫 /
 * 异常归一 / done / closeLoading）复用 `useDialogForm`，不再手写第二套 beforeSure。
 */
export function useAvatarCropUpload(options: {
  title: (row: RecordType) => string;
  imgSrc: (row: RecordType) => string;
  upload: (row: RecordType, formData: FormData) => Promise<DataEnvelope>;
  onSuccess?: (row: RecordType) => void;
  successText?: string;
}) {
  const avatarInfo = ref<CropperPayload>();
  const cropRef = ref();

  function handleUpload(row: RecordType) {
    avatarInfo.value = undefined;
    const { beforeSure } = useDialogForm<FormData>({
      readPayload: () => {
        const blob = avatarInfo.value?.blob;
        if (!blob) return null;
        return createFormData({
          file: new File([blob], "avatar.png", {
            type: blob.type,
            lastModified: Date.now()
          })
        });
      },
      submit: payload => options.upload(row, payload),
      successText: options.successText,
      onSuccess: () => options.onSuccess?.(row)
    });

    addDialog({
      title: options.title(row),
      width: dialogSize("sm"),
      draggable: true,
      fullscreen: deviceDetection(),
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: options.imgSrc(row),
          onCropper: (info: CropperPayload) => (avatarInfo.value = info),
          circled: true,
          quality: 1,
          ref: cropRef,
          canvasOption: { width: 512, height: 512 }
        }),
      beforeSure,
      beforeClose: done => {
        cropRef.value?.hidePopover();
        delay(200).then(() => done());
      }
    });
  }

  return { handleUpload };
}
