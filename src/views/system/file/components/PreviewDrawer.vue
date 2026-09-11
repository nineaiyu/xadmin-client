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
  /** 后端判定的预览类型：image / pdf / text，null 表示不支持 */
  preview_kind?: string | null;
};

const props = defineProps<{ row: PreviewRow }>();
const { t } = useI18n();

const loading = ref(true);
const objectUrl = ref("");
const text = ref("");
const truncated = ref(false);
const error = ref("");

async function load() {
  const kind = props.row?.preview_kind;
  if (!kind) {
    error.value = t("systemUploadFile.previewUnsupported");
    loading.value = false;
    return;
  }
  try {
    const response = await systemUploadFileApi.preview(
      props.row.pk,
      kind === "image" ? { size: "preview" } : undefined
    );
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
      v-else-if="row?.preview_kind === 'pdf' && objectUrl"
      :src="objectUrl"
      class="preview-frame"
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
