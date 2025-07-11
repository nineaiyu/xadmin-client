<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import type { UploadProps, UploadUserFile } from "element-plus";
import defaultFile from "../assets/defaultFile.png";
import { formatBytes } from "@pureadmin/utils";

defineOptions({ name: "UploadFile" });
const value = defineModel<string | object | any>();
const props = defineProps({
  disabled: Boolean,
  isImageFile: Boolean
});
const emit = defineEmits<{
  change: [...args: any];
}>();

const fileList = ref<UploadUserFile[]>([]);
if (value.value) {
  fileList.value = [
    {
      name: value.value,
      url: props.isImageFile ? defaultFile : value.value
    }
  ];
  emit("change", undefined);
}
const fileAccept = () => {
  if (props.isImageFile) {
    return "";
  }
  return "image/*";
};
watch(
  () => fileList.value,
  () => {
    if (fileList.value.length > 1) {
      fileList.value.shift();
    }
    if (fileList.value.length === 1) {
      emit("change", fileList.value[0]?.raw);
    }
  }
);

const dialogFile = ref();
const dialogVisible = ref(false);

const handleRemove: UploadProps["onRemove"] = () => {
  // emit("change", ""); //form-data 需要设置 ""
  emit("change", null); // json 需要设置null
};

const handlePictureCardPreview: UploadProps["onPreview"] = uploadFile => {
  dialogFile.value = uploadFile;
  dialogVisible.value = true;
};
const handleChange: UploadProps["onChange"] = uploadFile => {
  if (!props.isImageFile) {
    uploadFile.url = defaultFile;
  }
};
const disableShowAdd = computed(() => {
  return fileList.value.length > 0;
});
</script>

<template>
  <div>
    <el-upload
      v-model:file-list="fileList"
      :accept="fileAccept()"
      :auto-upload="false"
      :class="{ hideUploadBtn: disableShowAdd }"
      :disabled="disabled"
      :limit="1"
      :on-change="handleChange"
      :on-preview="handlePictureCardPreview"
      :on-remove="handleRemove"
      :show-file-list="true"
      action="#"
      list-type="picture-card"
    >
      <el-icon>
        <Plus />
      </el-icon>
    </el-upload>

    <el-dialog v-model="dialogVisible">
      <div class="flex flex-col items-center justify-center">
        <img :src="dialogFile.url" alt="Preview Image" class="max-w-full" />
        <div v-if="dialogFile?.size">{{ formatBytes(dialogFile.size) }}</div>
        <div v-if="dialogFile?.name" class="truncate">
          {{ dialogFile.name }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>
<style lang="scss" scoped>
:deep(.hideUploadBtn .el-upload--picture-card) {
  display: none !important;
}
</style>
