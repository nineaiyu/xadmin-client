<script lang="ts" setup>
import { reactive, ref } from "vue";
import { createFormData } from "@pureadmin/utils";

import UploadIcon from "@iconify-icons/ri/upload-2-line";
import { UploadProps } from "element-plus";
import { useI18n } from "vue-i18n";

defineOptions({ name: "searchUsers" });

const emit = defineEmits<{
  (e: "change", ...args: any): void;
}>();

const { t, te } = useI18n();

const selectValue = defineModel<Array<any>>({ default: [] });

const uploadRef = ref();

const submitForm = (_, uploadFiles) => {
  emit(
    "change",
    uploadFiles.map(file => file.raw)
  );
  // formEl.validate(valid => {
  //   if (valid) {
  //     // 多个 file 在一个接口同时上传
  //     const formData = createFormData({
  //       files: selectValue.value.map(file => ({ raw: file.raw })) // file 文件
  //     });
  //     console.log(formData);
  //     // formUpload(formData)
  //     //   .then(({ success }) => {
  //     //     if (success) {
  //     //       message("提交成功", { type: "success" });
  //     //     } else {
  //     //       message("提交失败");
  //     //     }
  //     //   })
  //     //   .catch(error => {
  //     //     message(`提交异常 ${error}`, { type: "error" });
  //     //   });
  //   } else {
  //     return false;
  //   }
  // });
};
const dialogImageUrl = ref("");
const dialogVisible = ref(false);
const resetForm = formEl => {
  if (!formEl) return;
  formEl.resetFields();
};
const handleRemove: UploadProps["onRemove"] = (uploadFile, uploadFiles) => {
  console.log(uploadFile, uploadFiles);
};

const handlePictureCardPreview: UploadProps["onPreview"] = uploadFile => {
  dialogImageUrl.value = uploadFile.url!;
  dialogVisible.value = true;
};
</script>

<template>
  <el-dialog v-model="dialogVisible">
    <img class="w-full" :src="dialogImageUrl" alt="Preview Image" />
  </el-dialog>
  <el-upload
    ref="uploadRef"
    v-model:file-list="selectValue"
    drag
    multiple
    :limit="1"
    action="#"
    :auto-upload="false"
    list-type="picture-card"
    :on-preview="handlePictureCardPreview"
    :on-remove="handleRemove"
    :on-change="submitForm"
  >
    <div class="el-upload__text">
      <IconifyIconOffline :icon="UploadIcon" width="26" class="m-auto mb-2" />
      可点击或拖拽上传
    </div>
  </el-upload>
</template>
