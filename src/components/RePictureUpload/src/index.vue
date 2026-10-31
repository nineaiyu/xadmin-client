<script lang="tsx" setup>
import { ref, watch } from "vue";
import { formatBytes } from "@pureadmin/utils";
import ReCropper from "@/components/ReCropper";
import avatar from "@/assets/avatar.png";
import { useI18n } from "vue-i18n";
import type { CropperPayload } from "../index";

defineOptions({
  name: "RePictureUpload"
});

const props = defineProps({
  imgSrc: String,
  errSrc: String,
  type: String,
  quality: Number,
  circled: Boolean,
  options: Object,
  canvasOption: Object
});

const emit = defineEmits<{ cropper: [payload: CropperPayload] }>();
const { t } = useI18n();
const infos = ref<Record<string, unknown>>();
const popoverRef = ref();
const refCropper = ref();
const showPopover = ref(false);
const cropperImg = ref<string>("");
/** 图片加载/裁剪器初始化失败：解除 loading 遮罩并给出失败提示 */
const loadFailed = ref(false);
/** 用户主动关闭过弹层：不再恢复 loading 遮罩（等待父级换图或再次触发） */
const dismissed = ref(false);

function onCropper({
  base64,
  blob,
  info
}: {
  base64: string;
  blob: Blob;
  info: Record<string, unknown>;
}) {
  infos.value = info;
  cropperImg.value = base64;
  emit("cropper", { base64, blob, info });
}

function hidePopover() {
  popoverRef.value?.hide();
  dismissed.value = true;
}

function onCropperError() {
  loadFailed.value = true;
}

// 换图（src / 兜底图变化）时复位失败与关闭态，重新给一次机会
watch(
  () => props.imgSrc,
  () => {
    loadFailed.value = false;
    dismissed.value = false;
    showPopover.value = false;
  }
);

defineExpose({ hidePopover });
</script>

<template>
  <div
    v-loading="!showPopover && !loadFailed && !dismissed"
    element-loading-background="transparent"
  >
    <el-popover
      ref="popoverRef"
      :visible="showPopover && !dismissed"
      placement="right"
      width="18vw"
      @update:visible="
        value => {
          if (!value) dismissed = true;
        }
      "
    >
      <template #reference>
        <div class="w-[18vw]">
          <ReCropper
            ref="refCropper"
            :canvasOption="canvasOption"
            :circled="circled"
            :errSrc="errSrc && errSrc !== '' ? errSrc : avatar"
            :options="options"
            :quality="quality"
            :src="imgSrc && imgSrc !== '' ? imgSrc : avatar"
            :type="type"
            @cropper="onCropper"
            @readied="showPopover = true"
            @error="onCropperError"
          />
          <p
            v-if="loadFailed"
            class="mt-1 text-center text-xs text-(--el-text-color-secondary)"
          >
            {{ t("avatarUpload.loadFailed") }}
          </p>
          <p v-show="showPopover" class="mt-1 text-center">
            {{ t("avatarUpload.tips") }}
          </p>
        </div>
      </template>
      <div class="flex-c flex-wrap text-center">
        <el-image
          v-if="cropperImg"
          :preview-src-list="Array.of(cropperImg)"
          :src="cropperImg"
          fit="cover"
        />
        <div v-if="infos" class="mt-1">
          <p>
            {{
              t("avatarUpload.imageSize", {
                x: parseInt(infos.width as string, 10),
                y: parseInt(infos.height as string, 10)
              })
            }}
          </p>
          <p>
            {{
              t("avatarUpload.fileSize", {
                x: formatBytes(infos.size as number),
                y: infos.size
              })
            }}
          </p>
        </div>
        <div class="mt-2 w-full text-center">
          <el-button size="small" @click="hidePopover">
            {{ t("buttons.close") }}
          </el-button>
        </div>
      </div>
    </el-popover>
  </div>
</template>
