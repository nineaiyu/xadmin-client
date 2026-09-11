<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { systemUploadFileApi } from "@/api/system/file";

/**
 * 文件在线预览抽屉：按后端下发的 `preview_kind` 分流（类型判定单一真源在服务端）。
 *
 * 内容一律走鉴权接口取 blob，再用 object URL 渲染：不暴露 /media/ 直链，
 * 拿到 URL 的人无法绕过权限直接下载敏感文件。
 */

defineOptions({ name: "SystemUploadFilePreview" });

type PreviewRow = {
  pk: string | number;
  filename?: string;
  mime_type?: string;
  /** 后端判定的预览类型：image / pdf / text / office（ADR-013），null 表示不支持 */
  preview_kind?: string | null;
};

/** Office 转换中（业务码 1006，HTTP 425）：轮询重试直到产物就绪 */
const PREVIEW_PREPARING_CODE = 1006;
const OFFICE_RETRY_MAX = 8;
const OFFICE_RETRY_INTERVAL = 2000;

const props = defineProps<{ row: PreviewRow }>();
const { t } = useI18n();

const loading = ref(true);
const objectUrl = ref("");
const text = ref("");
const truncated = ref(false);
const preparing = ref(false);
const error = ref("");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPreview(kind: string) {
  return await systemUploadFileApi.preview(
    props.row.pk,
    kind === "image" ? { size: "preview" } : undefined
  );
}

/** Office：首次请求触发后端转换（heavy 队列），425 表示转换中 → 轮询重试 */
async function fetchOfficeWithRetry() {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPreview("office");
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === PREVIEW_PREPARING_CODE && attempt < OFFICE_RETRY_MAX) {
        preparing.value = true;
        await sleep(OFFICE_RETRY_INTERVAL);
        continue;
      }
      throw err;
    }
  }
}

async function load() {
  const kind = props.row?.preview_kind;
  if (!kind) {
    error.value = t("systemUploadFile.previewUnsupported");
    loading.value = false;
    return;
  }
  if (kind === "office") preparing.value = true;
  try {
    const response =
      kind === "office"
        ? await fetchOfficeWithRetry()
        : await fetchPreview(kind);
    const blob = response.data;
    if (kind === "text") {
      // 截断标记在响应头：正文过长时提示用户下载查看
      truncated.value =
        String(response.headers?.["x-preview-truncated"] ?? "0") === "1";
      text.value = await blob.text();
    } else {
      objectUrl.value = URL.createObjectURL(blob);
    }
  } catch {
    // 失败提示由 http 拦截器统一处理，这里只收口"抽屉里展示什么"
    error.value = t("systemUploadFile.previewFailed");
  } finally {
    preparing.value = false;
    loading.value = false;
  }
}

onMounted(load);
onUnmounted(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
});
</script>

<template>
  <div v-loading="loading" class="preview-body">
    <el-alert
      v-if="error"
      :closable="false"
      :title="error"
      type="warning"
      class="m-4"
    />
    <template v-else-if="row?.preview_kind === 'image'">
      <el-image
        v-if="objectUrl"
        :src="objectUrl"
        :preview-src-list="[objectUrl]"
        fit="contain"
        class="preview-image"
      />
    </template>
    <iframe
      v-else-if="
        ['pdf', 'office'].includes(String(row?.preview_kind)) && objectUrl
      "
      :src="objectUrl"
      class="preview-frame"
    />
    <el-alert
      v-else-if="row?.preview_kind === 'office' && preparing"
      :closable="false"
      :title="t('systemUploadFile.previewPreparing')"
      type="info"
      class="m-4"
    />
    <template v-else-if="row?.preview_kind === 'text'">
      <el-alert
        v-if="truncated"
        :closable="false"
        :title="t('systemUploadFile.previewTruncated')"
        type="info"
        class="m-4"
      />
      <pre class="preview-text">{{ text }}</pre>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.preview-body {
  min-height: 240px;
}

.preview-image {
  display: block;
  width: 100%;
  max-height: 70vh;
}

.preview-frame {
  width: 100%;
  height: 70vh;
  border: none;
}

.preview-text {
  max-height: 70vh;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
