<script lang="ts" setup>
import { onMounted, ref } from "vue";
import type {
  UploadFile,
  UploadProgressEvent,
  UploadRawFile,
  UploadRequestOptions
} from "element-plus";
import { uploadFileApi } from "@/api/system/upload";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import { UploadFilled } from "@element-plus/icons-vue";
import { FieldValues, PlusColumn } from "plus-pro-components";
import { formatBytes, throttle } from "@pureadmin/utils";

interface AddOrEditFormProps {
  formInline: FieldValues;
  formProps?: object;
  columns: PlusColumn[];
  tableRef?: any;
}

const props = withDefaults(defineProps<AddOrEditFormProps>(), {
  formInline: () => ({}),
  formProps: () => ({}),
  columns: () => [],
  tableRef: undefined
});

defineOptions({ name: "UploadFile" });

const { t } = useI18n();
const fileList = ref([]);
const uploadConfig = ref({ file_upload_size: 1048576 });

onMounted(() => {
  uploadFileApi.config().then(res => {
    if (res.code === 1000) {
      uploadConfig.value = res.data;
    }
  });
});

const uploadRequest = (option: UploadRequestOptions) => {
  const data = new FormData();
  data.append("file", option.file);
  return uploadFileApi.upload({}, data, {
    onUploadProgress: (event: any) => {
      const progressEvt = event as UploadProgressEvent;
      progressEvt.percent =
        event.total > 0 ? (event.loaded / event.total) * 100 : 0;
      option.onProgress(progressEvt);
    }
  });
};
const refreshData = throttle(props.tableRef?.handleGetData, 2000);
const uploadSuccess = (response: any, uploadFile: UploadFile) => {
  if (response.code === 1000) {
    refreshData();
    message(`${uploadFile.name} ${t("results.success")}`, { type: "success" });
  } else {
    uploadFile.status = "fail";
    message(`${uploadFile.name} ${t("results.failed")}，${response.detail}`, {
      type: "error"
    });
  }
};
const beforeUpload = (rawFile: UploadRawFile) => {
  if (rawFile.size > uploadConfig.value.file_upload_size) {
    message(
      `${rawFile.name} ${t("systemUploadFile.uploadTip")} ${formatBytes(uploadConfig.value.file_upload_size)}!`,
      { type: "warning" }
    );
    return false;
  }
  return true;
};
</script>

<template>
  <el-scrollbar max-height="600px">
    <el-upload
      v-model:file-list="fileList"
      :http-request="uploadRequest"
      :on-success="uploadSuccess"
      :before-upload="beforeUpload"
      class="p-2"
      drag
      multiple
    >
      <el-icon class="el-icon--upload">
        <UploadFilled />
      </el-icon>
      <div class="el-upload__text">
        {{ t("systemUploadFile.dropFile") }}
        <em>{{ t("systemUploadFile.clickUpload") }}</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          {{ t("systemUploadFile.uploadTip") }}
          {{ formatBytes(uploadConfig.file_upload_size) }}
        </div>
      </template>
    </el-upload>
  </el-scrollbar>
</template>
