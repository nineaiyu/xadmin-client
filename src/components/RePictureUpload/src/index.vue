<script lang="tsx" setup>
import { ref } from "vue";
import { formatBytes } from "@pureadmin/utils";
import ReCropper from "@/components/ReCropper";
import avatar from "@/assets/avatar.png";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "RePictureUpload"
});

defineProps({
  imgSrc: String,
  errSrc: String,
  type: String,
  quality: Number,
  circled: Boolean,
  options: Object,
  canvasOption: Object
});

const emit = defineEmits(["cropper"]);
const { t } = useI18n();
const infos = ref();
const popoverRef = ref();
const refCropper = ref();
const showPopover = ref(false);
const cropperImg = ref<string>("");

function onCropper({ base64, blob, info }) {
  infos.value = info;
  cropperImg.value = base64;
  emit("cropper", { base64, blob, info });
}

function hidePopover() {
  popoverRef.value.hide();
}

defineExpose({ hidePopover });
</script>

<template>
  <div v-loading="!showPopover" element-loading-background="transparent">
    <el-popover
      ref="popoverRef"
      :visible="showPopover"
      placement="right"
      width="18vw"
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
          />
          <p v-show="showPopover" class="mt-1 text-center">
            {{ t("avatarUpload.tips") }}
          </p>
        </div>
      </template>
      <div class="flex flex-wrap justify-center items-center text-center">
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
                x: parseInt(infos.width),
                y: parseInt(infos.height)
              })
            }}
          </p>
          <p>
            {{
              t("avatarUpload.fileSize", {
                x: formatBytes(infos.size),
                y: infos.size
              })
            }}
          </p>
        </div>
      </div>
    </el-popover>
  </div>
</template>
