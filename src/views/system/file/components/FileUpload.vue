<script lang="ts">
// 默认限制回退告警的模块级一次性标记：上传弹层可反复打开，
// 避免每次都重复提示同一条信息（<script setup> 的顶层变量是组件实例级的）
let defaultSizeWarned = false;
</script>

<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import type {
  UploadFile,
  UploadProgressEvent,
  UploadRawFile,
  UploadRequestOptions
} from "element-plus";
import type { AxiosProgressEvent } from "axios";
import { systemUploadFileApi } from "@/api/file/file";
import {
  DEFAULT_CHUNK_SIZE as CHUNK_UPLOAD_THRESHOLD,
  ChunkUploadBusinessError,
  uploadFileChunked,
  type ChunkUploadResult
} from "@/utils/upload/chunked";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import { UploadFilled } from "@element-plus/icons-vue";
import { FieldValues, PlusColumn } from "plus-pro-components";
import { formatBytes, throttle } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";

/** el-upload on-success 响应体（systemUploadFileApi.upload 返回结构，仅消费 code/detail） */
interface UploadResult {
  code: number;
  detail?: string;
}

interface AddOrEditFormProps {
  formInline?: FieldValues;
  formProps?: object;
  columns?: PlusColumn[];
  /** RePlusPage 组件实例（defineExpose 暴露的列表刷新方法） */
  tableRef?: {
    handleGetData: () => void;
  };
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
/** 上传大小默认限制：配置端点不可读（无权限/拉取失败）时的回退值 */
const DEFAULT_FILE_UPLOAD_SIZE = 1048576;
const uploadConfig = ref({ file_upload_size: DEFAULT_FILE_UPLOAD_SIZE });

const warnDefaultUploadSize = () => {
  if (defaultSizeWarned) return;
  defaultSizeWarned = true;
  message(
    t("systemUploadFile.defaultSizeTip", {
      size: formatBytes(DEFAULT_FILE_UPLOAD_SIZE)
    }),
    { type: "warning" }
  );
};

onMounted(() => {
  if (!hasAuth("config:SystemUploadFile")) {
    warnDefaultUploadSize();
    return;
  }
  systemUploadFileApi
    .config()
    .then(res => {
      if (res.code === SUCCESS_CODE && res.data) {
        uploadConfig.value = res.data;
      } else {
        warnDefaultUploadSize();
      }
    })
    .catch(() => warnDefaultUploadSize());
});

const uploadRequest = async (option: UploadRequestOptions) => {
  const onProgress = (event: AxiosProgressEvent | UploadProgressEvent) => {
    const progressEvt = event as UploadProgressEvent;
    progressEvt.percent =
      (event.total ?? 0) > 0
        ? (event.loaded / (event.total as number)) * 100
        : 0;
    option.onProgress?.(progressEvt);
  };
  // 大文件走分片/断点续传：抗网络抖动（单片失败只重传该片）、绕过反代单请求体限制；
  // 小文件维持单请求直传（少两次 init/complete 往返）。分片单片进度已汇总为整体进度。
  if (option.file.size <= CHUNK_UPLOAD_THRESHOLD) {
    const data = new FormData();
    data.append("file", option.file);
    return systemUploadFileApi.upload(data, { onUploadProgress: onProgress });
  }
  try {
    const result = await uploadFileChunked(option.file, {
      onProgress: percent =>
        onProgress({
          percent,
          loaded: (percent / 100) * option.file.size,
          total: option.file.size,
          bytes: 0,
          lengthComputable: true
        } as AxiosProgressEvent)
    });
    // el-upload on-success 只消费 code/detail：data 附带文件记录便于扩展消费
    return {
      code: SUCCESS_CODE,
      detail: undefined,
      data: [result]
    } as UploadResult & { data: ChunkUploadResult[] };
  } catch (error) {
    // 业务码失败 HTTP 层不 toast，这里补提示；网络错误由 http 层统一提示
    if (error instanceof ChunkUploadBusinessError) {
      message(`${option.file.name} ${t("results.failed")}，${error.message}`, {
        type: "error"
      });
    }
    throw error;
  }
};
const uploadError = (_error: unknown, uploadFile: UploadFile) => {
  // http 层已按错误策略提示；这里仅回填 el-upload 状态
  uploadFile.status = "fail";
};
const refreshData = throttle(() => props.tableRef?.handleGetData?.(), 2000);
const uploadSuccess = (response: UploadResult, uploadFile: UploadFile) => {
  if (response.code === SUCCESS_CODE) {
    refreshData();
    // 优先展示服务端 detail：命中上传去重时会附带「已复用已有副本」提示，
    // 缺省回退通用成功文案（老后端/无 detail 场景）
    message(`${uploadFile.name} ${response.detail || t("results.success")}`, {
      type: "success"
    });
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
      :on-error="uploadError"
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
