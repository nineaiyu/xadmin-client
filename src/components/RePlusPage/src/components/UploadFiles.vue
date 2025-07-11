<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { Delete, Plus, ZoomIn } from "@element-plus/icons-vue";
import type {
  UploadFile,
  UploadProgressEvent,
  UploadProps,
  UploadRawFile,
  UploadRequestOptions,
  UploadUserFile as ElEUploadUserFile
} from "element-plus";
import defaultFile from "../assets/defaultFile.png";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { systemUploadFileApi } from "@/api/system/file";
import { message } from "@/utils/message";
import { formatBytes } from "@pureadmin/utils";

defineOptions({ name: "UploadFiles" });
const value = defineModel<string | object | any>();
const props = defineProps({
  disabled: Boolean,
  multiple: Boolean,
  isImageFile: Boolean
});
const emit = defineEmits<{
  change: [...args: any];
}>();

interface UploadUserFile extends ElEUploadUserFile {
  pk?: number;
}

const fileList = ref<UploadUserFile[]>([]);
const colors = [
  { color: "#f56c6c", percentage: 20 },
  { color: "#e6a23c", percentage: 40 },
  { color: "#5cb87a", percentage: 60 },
  { color: "#1989fa", percentage: 80 },
  { color: "#6f7ad3", percentage: 100 }
];
if (value.value) {
  if (props.multiple) {
    fileList.value = value.value.map(item => {
      return {
        name: item.filename ?? item.label,
        size: item.filesize,
        pk: item.pk,
        url: props.isImageFile ? item.filepath : defaultFile
      };
    });
  } else {
    fileList.value = [
      {
        name: value.value.filename ?? value.value.label,
        size: value.value.filesize,
        pk: value.value.pk,
        url: props.isImageFile ? value.value.filepath : defaultFile
      }
    ];
  }
}
const fileAccept = () => {
  if (props.isImageFile) {
    return "image/*";
  }
  return "";
};

const dialogFile = ref();
const dialogVisible = ref(false);

const handleRemove = (file: UploadFile) => {
  fileList.value.splice(fileList.value.indexOf(file), 1);
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

const { t } = useI18n();
const uploadConfig = ref({ file_upload_size: 1048576 });

onMounted(() => {
  if (hasAuth("config:SystemUploadFile")) {
    systemUploadFileApi.config().then(res => {
      if (res.code === 1000) {
        uploadConfig.value = res.data;
      }
    });
  }
});

const uploadRequest = (option: UploadRequestOptions) => {
  const data = new FormData();
  data.append("file", option.file);
  return systemUploadFileApi.upload(data, {
    onUploadProgress: (event: any) => {
      const progressEvt = event as UploadProgressEvent;
      progressEvt.percent =
        event.total > 0 ? (event.loaded / event.total) * 100 : 0;
      option.onProgress(progressEvt);
    }
  });
};

watch(
  () => fileList,
  () => {
    const pks = fileList.value.map(item => {
      return { pk: item.pk };
    });
    if (props.multiple) {
      emit("change", pks);
    } else {
      emit("change", pks.length == 1 ? pks[0] : null);
    }
  },
  {
    deep: true
  }
);

const uploadSuccess = (response: any, uploadFile: UploadUserFile) => {
  if (response.code === 1000 && response?.data.length == 1) {
    const data = response.data[0];
    uploadFile.pk = data.pk;
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

const disableShowAdd = computed(() => {
  return props.multiple != true && fileList.value.length > 0;
});
</script>

<template>
  <div>
    <el-upload
      v-model:file-list="fileList"
      :accept="fileAccept()"
      :before-upload="beforeUpload"
      :class="{ hideUploadBtn: disableShowAdd }"
      :disabled="disabled"
      :http-request="uploadRequest"
      :limit="multiple ? 99 : 1"
      :multiple="multiple"
      :on-change="handleChange"
      :on-preview="handlePictureCardPreview"
      :on-success="uploadSuccess"
      :show-file-list="true"
      action="#"
      list-type="picture-card"
    >
      <el-icon>
        <Plus />
      </el-icon>
      <template #tip>
        <div class="el-upload__tip">
          {{ t("systemUploadFile.uploadTip") }}
          {{ formatBytes(uploadConfig.file_upload_size) }}
        </div>
      </template>
      <template #file="{ file }">
        <div class="w-[100%] flex flex-col items-center justify-center">
          <div class="h-[50%] w-[50%]">
            <div v-if="file.status === 'uploading'">
              <el-progress
                :color="colors"
                :percentage="file.percentage"
                type="dashboard"
              />
            </div>
            <img v-else :src="file.url" alt="" />
          </div>
          <span v-if="file?.size">{{ formatBytes(file.size) }}</span>
          <span v-if="file?.name" class="truncate">{{ file.name }}</span>
          <span class="el-upload-list__item-actions">
            <span
              class="el-upload-list__item-preview"
              @click="handlePictureCardPreview(file)"
            >
              <el-icon><ZoomIn /></el-icon>
            </span>
            <span
              v-if="!disabled"
              class="el-upload-list__item-delete"
              @click="handleRemove(file)"
            >
              <el-icon><Delete /></el-icon>
            </span>
          </span>
        </div>
      </template>
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
