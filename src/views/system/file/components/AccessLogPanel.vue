<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { systemUploadFileApi, type FileAccessLogResult } from "@/api/file/file";
import { message } from "@/utils/message";
import { isSuccess } from "@/api/types";
import type { RecordType } from "plus-pro-components";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/**
 * 文件访问记录：上传 / 下载 / 预览 / 删除四类动作留痕，供溯源与审计。
 *
 * 后端返回最近 100 条 + 各动作计数；抽屉内即时拉取，不依赖列表页数据。
 */
const props = defineProps<{ row?: RecordType }>();
const { t } = useI18n();

const loading = ref(false);
const data = ref<FileAccessLogResult | null>(null);
/** 加载失败标记（HTTP 层已在拦截器统一提示，抽屉内只做空态收口） */
const failed = ref(false);

const ACTION_KEYS: Record<string, string> = {
  upload: "fileAccess.actionUpload",
  download: "fileAccess.actionDownload",
  preview: "fileAccess.actionPreview",
  delete: "fileAccess.actionDelete"
};
const actionLabel = (value: unknown) => {
  const key = ACTION_KEYS[String(value ?? "")];
  return key ? t(key) : String(value ?? "-");
};

/** 只读列：时间/动作/结果走具名插槽，其余直接取字段 */
const columns = computed<ReadonlyColumn[]>(() => [
  { label: t("fileAccess.time"), width: 170, slot: "time" },
  { prop: "user_display", label: t("fileAccess.user"), width: 120 },
  { label: t("fileAccess.action"), width: 100, slot: "action" },
  { prop: "ipaddress", label: t("fileAccess.ipaddress"), width: 140 },
  { label: t("fileAccess.result"), width: 90, slot: "result" },
  { prop: "detail", label: t("fileAccess.detail"), minWidth: 160 }
]);

const load = async () => {
  if (!props.row?.pk) return;
  loading.value = true;
  failed.value = false;
  try {
    const res = await systemUploadFileApi.accessLogs(props.row.pk);
    if (isSuccess(res)) {
      data.value = res.data;
    } else {
      // 200 + 业务码失败：http 拦截器只处理 HTTP 层错误，这里显式提示
      failed.value = true;
      message(String(res.detail ?? t("results.failed")), { type: "error" });
    }
  } catch {
    // HTTP 4xx/5xx 与网络异常均已在 http 拦截器统一提示，组件内不再二次弹窗
    // （重复提示 + http 层 reject 的是响应体对象，旧实现 String(error) 会渲染成
    // [object Object]）；这里只收口抽屉内的失败态展示。
    failed.value = true;
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div>
    <el-alert
      v-if="failed && !loading"
      :closable="false"
      :title="t('fileAccess.loadFailed')"
      type="warning"
      class="mb-3"
    />
    <div class="mb-3 flex flex-wrap gap-2">
      <el-tag
        v-for="(count, action) in data?.counts ?? {}"
        :key="action"
        type="info"
        effect="light"
      >
        {{ actionLabel(action) }}：{{ count }}
      </el-tag>
      <el-tag v-if="data" type="success" effect="plain">
        {{ t("fileAccess.total") }}：{{ data.total }}
      </el-tag>
    </div>
    <ReReadonlyTable
      :columns="columns"
      :rows="data?.results ?? []"
      :loading="loading"
      size="small"
      border
    >
      <template #time="{ row }">
        {{
          row.created_time
            ? String(row.created_time).replace("T", " ").slice(0, 19)
            : "-"
        }}
      </template>
      <template #action="{ row }">{{
        actionLabel(row.action?.value)
      }}</template>
      <template #result="{ row }">
        <el-tag :type="row.result ? 'success' : 'danger'" effect="light">
          {{ row.result ? t("labels.yes") : t("labels.no") }}
        </el-tag>
      </template>
    </ReReadonlyTable>
  </div>
</template>
