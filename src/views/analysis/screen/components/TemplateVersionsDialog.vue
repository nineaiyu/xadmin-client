<script lang="ts" setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import type { ScreenTemplateVersionItem } from "@/api/dataset/analysis";
import { fetchTemplateVersions } from "../utils/serverTemplates";

import { dialogSize } from "@/components/ReDialog/size";
defineOptions({ name: "ScreenTemplateVersionsDialog" });

/**
 * 模板版本历史与回滚（ADR-090 D4）。
 *
 * 自取自管：打开时按模板 pk 拉历史版本（失败 / 无版本给空态），回滚走 `rollback` 事件由
 * 组合层执行（成功后本弹窗重拉一次，因为回滚本身也会记一版）。弹窗不碰画布数据。
 */
const props = defineProps<{
  modelValue: boolean;
  templateId: string;
  templateName: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  rollback: [version: number];
}>();

const { t } = useI18n();

const versions = ref<ScreenTemplateVersionItem[]>([]);
const loading = ref(false);

async function reload() {
  if (!props.templateId) return;
  loading.value = true;
  versions.value = await fetchTemplateVersions(props.templateId);
  loading.value = false;
}

watch(
  () => [props.modelValue, props.templateId] as const,
  ([visible]) => {
    if (visible) void reload();
  }
);

async function onRollback(version: number) {
  const confirmed = await ElMessageBox.confirm(
    t("dataScreen.templateRollbackConfirm", { n: version }),
    t("dataScreen.templateVersions"),
    { confirmButtonText: t("dataScreen.templateRollback") }
  ).catch(() => null);
  if (!confirmed) return;
  emit("rollback", version);
  // 回滚成功与否由组合层提示；这里等一拍再重拉，历史里会多出「回滚那一版」
  setTimeout(() => void reload(), 400);
}

const formatTime = (value?: string) =>
  value ? value.replace("T", " ").slice(0, 19) : "";
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`${t('dataScreen.templateVersions')} · ${templateName}`"
    :width="dialogSize('md')"
    data-testid="template-versions-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="loading" class="versions__hint">
      {{ t("dataScreen.loading") }}
    </div>
    <div v-else-if="versions.length === 0" class="versions__hint">
      {{ t("dataScreen.templateVersionEmpty") }}
    </div>
    <el-table v-else :data="versions" size="small" max-height="320">
      <el-table-column
        prop="version"
        :label="t('dataScreen.templateVersionColumn')"
        width="80"
      />
      <el-table-column prop="name" :label="t('dataScreen.templateName')" />
      <el-table-column prop="group" :label="t('dataScreen.templateGroup')" />
      <el-table-column :label="t('dataScreen.updatedTime')" width="160">
        <template #default="{ row }">{{
          formatTime(row.created_time)
        }}</template>
      </el-table-column>
      <el-table-column :label="t('dataScreen.templateRollback')" width="110">
        <template #default="{ row }">
          <el-button
            size="small"
            :data-testid="`version-rollback-${row.version}`"
            @click="onRollback(row.version)"
          >
            {{ t("dataScreen.templateRollback") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<style lang="scss" scoped>
.versions__hint {
  padding: var(--space-4) 0;
  font-size: var(--el-font-size-small);
  color: var(--screen-fg-dim);
  text-align: center;
}
</style>
