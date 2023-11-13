<script setup lang="tsx">
import { ref } from "vue";
import { formatBytes } from "@pureadmin/utils";
import ReCropper from "@/components/ReCropper";
import avatar from "./avatar.png";
import { useI18n } from "vue-i18n";

const props = defineProps({
  imgSrc: String,
  errSrc: String
});

const emit = defineEmits(["cropper"]);
const { t } = useI18n();
const infos = ref();
const refCropper = ref();
const showPopover = ref(false);
const cropperImg = ref<string>("");
function onCropper({ base64, blob, info }) {
  infos.value = info;
  cropperImg.value = base64;
  emit("cropper", { base64, blob, info });
}
</script>

<template>
  <div v-loading="!showPopover" element-loading-background="transparent">
    <el-popover :visible="showPopover" placement="right" width="18vw">
      <template #reference>
        <div class="w-[18vw]">
          <ReCropper
            ref="refCropper"
            :src="props.imgSrc && props.imgSrc !== '' ? props.imgSrc : avatar"
            :errSrc="
              props.errSrc && props.errSrc !== '' ? props.errSrc : avatar
            "
            circled
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
          :src="cropperImg"
          :preview-src-list="Array.of(cropperImg)"
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
