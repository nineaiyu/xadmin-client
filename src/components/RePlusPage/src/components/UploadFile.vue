<script lang="ts" setup>
import { ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import type { UploadProps, UploadUserFile } from "element-plus";
import defaultFile from "../assets/defaultFile.png";

defineOptions({ name: "UploadFile" });
const value = defineModel<string | object | any>();
const props = defineProps({
  disabled: Boolean,
  isFile: Boolean
});
const emit = defineEmits<{
  (e: "change", ...args: any): void;
}>();

const fileList = ref<UploadUserFile[]>([]);
if (value.value) {
  fileList.value = [
    {
      name: value.value,
      url: props.isFile ? defaultFile : value.value
    }
  ];
  emit("change", undefined);
}
const fileAccept = () => {
  if (props.isFile) {
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

const dialogImageUrl = ref("");
const dialogVisible = ref(false);

const handleRemove: UploadProps["onRemove"] = () => {
  // emit("change", ""); //form-data 需要设置 ""
  emit("change", null); // json 需要设置null
};

const handlePictureCardPreview: UploadProps["onPreview"] = uploadFile => {
  dialogImageUrl.value = uploadFile.url!;
  dialogVisible.value = true;
};
const handleChange: UploadProps["onChange"] = uploadFile => {
  if (props.isFile) {
    uploadFile.url = defaultFile;
  }
};
</script>

<template>
  <el-upload
    v-model:file-list="fileList"
    :disabled="disabled"
    action="#"
    :limit="2"
    :show-file-list="true"
    list-type="picture-card"
    :on-preview="handlePictureCardPreview"
    :on-remove="handleRemove"
    :on-change="handleChange"
    :auto-upload="false"
    :accept="fileAccept()"
  >
    <el-icon>
      <Plus />
    </el-icon>
  </el-upload>

  <el-dialog v-model="dialogVisible">
    <img :src="dialogImageUrl" alt="Preview Image" class="max-w-[100%]" />
  </el-dialog>
</template>
