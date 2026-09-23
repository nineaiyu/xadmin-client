<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import {
  systemUploadFileApi,
  type FileAccessLogResult
} from "@/api/system/file";
import type { RecordType } from "plus-pro-components";

/**
 * 文件访问记录（F-8）：上传 / 下载 / 预览 / 删除四类动作留痕，供溯源与审计。
 *
 * 后端返回最近 100 条 + 各动作计数；抽屉内即时拉取，不依赖列表页数据。
 */
const props = defineProps<{ row?: RecordType }>();
const { t } = useI18n();

const loading = ref(false);
const data = ref<FileAccessLogResult | null>(null);

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

const load = async () => {
  if (!props.row?.pk) return;
  loading.value = true;
  try {
    const res = await systemUploadFileApi.accessLogs(props.row.pk);
    if (res.code === 1000) {
      data.value = res.data;
    } else {
      ElMessage.error(String(res.detail));
    }
  } catch (error: unknown) {
    ElMessage.error(String((error as Error)?.message ?? error));
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div v-loading="loading">
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
    <el-table :data="data?.results ?? []" border size="small">
      <el-table-column :label="t('fileAccess.time')" width="170">
        <template #default="{ row }">
          {{
            row.created_time
              ? String(row.created_time).replace("T", " ").slice(0, 19)
              : "-"
          }}
        </template>
      </el-table-column>
      <el-table-column
        prop="user_display"
        :label="t('fileAccess.user')"
        width="120"
      />
      <el-table-column :label="t('fileAccess.action')" width="100">
        <template #default="{ row }">{{
          actionLabel(row.action?.value)
        }}</template>
      </el-table-column>
      <el-table-column
        prop="ipaddress"
        :label="t('fileAccess.ipaddress')"
        width="140"
      />
      <el-table-column :label="t('fileAccess.result')" width="90">
        <template #default="{ row }">
          <el-tag :type="row.result ? 'success' : 'danger'" effect="light">
            {{ row.result ? t("labels.yes") : t("labels.no") }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="detail"
        :label="t('fileAccess.detail')"
        min-width="160"
      />
    </el-table>
  </div>
</template>
