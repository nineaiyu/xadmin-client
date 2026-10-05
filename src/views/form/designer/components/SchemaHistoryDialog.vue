<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  designerApi,
  type DynamicFormItem,
  type FormField,
  type SchemaHistoryItem,
  type SchemaHistoryResult
} from "@/api/dataset/dform";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import { fieldTypeLabelKey } from "../utils/schemaMeta";
import { LINKAGE_EFFECTS, linkageFieldLabel } from "../utils/linkageMeta";

/**
 * schema 版本历史（行级入口）：查看历史版本配置 / 回滚到指定版本。
 *
 * - 历史保留最近 20 个版本（服务端裁剪）；回滚生成新版本，历史不删除，可再次回滚；
 * - 展开行展示该版本的字段清单与联动规则（只读预览，不改动当前设计器）。
 */
defineOptions({ name: "SchemaHistoryDialog" });

const props = withDefaults(
  defineProps<{
    row: DynamicFormItem;
    /** 回滚权限（缺省不显示回滚入口，仅可查看历史） */
    canRollback?: boolean;
  }>(),
  { canRollback: false }
);

const emit = defineEmits<{
  /** 回滚成功（父级刷新列表） */
  done: [];
}>();

const { t } = useI18n();
const confirm = useConfirm();
const loading = ref(true);
const submitting = ref(false);
const data = ref<SchemaHistoryResult>({
  current: props.row.schema_version ?? 1,
  history: []
});

const load = async () => {
  loading.value = true;
  const res = await designerApi.schemaHistory(props.row.pk).catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error),
    data: { current: props.row.schema_version ?? 1, history: [] }
  }));
  loading.value = false;
  if (res.code !== 1000) {
    message(res.detail ?? t("dform.historyLoadFailed"), { type: "warning" });
    return;
  }
  data.value = (res.data ?? {
    current: props.row.schema_version ?? 1,
    history: []
  }) as SchemaHistoryResult;
};
onMounted(load);

const fieldsOf = (item: SchemaHistoryItem): FormField[] =>
  item.schema?.fields ?? [];

const linkageSummary = (item: SchemaHistoryItem) =>
  (item.schema?.linkages ?? []).map(rule => {
    const effect =
      LINKAGE_EFFECTS.find(option => option.value === rule.effect)?.labelKey ??
      "dform.linkageEffectHide";
    return `${linkageFieldLabel(fieldsOf(item), rule.field)} → ${linkageFieldLabel(
      fieldsOf(item),
      rule.target
    )}（${t(effect)}）`;
  });

const rollback = (item: SchemaHistoryItem) => {
  confirm(t("dform.historyRollbackConfirm", { version: item.version }), {
    title: t("dform.historyRollback"),
    confirmButtonText: t("dform.historyRollback")
  }).then(async ok => {
    if (!ok) return;
    submitting.value = true;
    const res = await designerApi
      .rollback(props.row.pk, item.version)
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    submitting.value = false;
    if (res.code !== 1000) {
      message(res.detail ?? t("results.failed"), { type: "error" });
      return;
    }
    message(t("dform.historyRollbackDone", { version: item.version }), {
      type: "success"
    });
    emit("done");
    await load();
  });
};

const currentVersion = computed(() => data.value.current ?? 1);
</script>

<template>
  <div v-loading="loading">
    <div class="mb-2 flex items-center gap-2 text-sm">
      <span>{{ t("dform.historyCurrent") }}</span>
      <el-tag size="small" type="success" effect="plain"
        >v{{ currentVersion }}</el-tag
      >
      <span
        v-if="data.updated_time"
        class="text-xs text-(--el-text-color-secondary)"
      >
        {{ data.updated_time }}
      </span>
    </div>
    <el-table :data="data.history" size="small" max-height="420">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="px-2 py-1">
            <div class="mb-1 text-xs font-medium">
              {{ t("dform.historySchema") }}
            </div>
            <div
              v-for="field in fieldsOf(row as SchemaHistoryItem)"
              :key="field.key"
              class="text-xs text-(--el-text-color-regular)"
            >
              · {{ field.label }}（{{ field.key }}）·
              {{ t(fieldTypeLabelKey(field.type)) }}
              <span v-if="field.required"
                >· {{ t("dform.fieldRequired") }}</span
              >
            </div>
            <template v-if="linkageSummary(row as SchemaHistoryItem).length">
              <div class="mt-2 mb-1 text-xs font-medium">
                {{ t("dform.linkage") }}
              </div>
              <div
                v-for="(text, index) in linkageSummary(
                  row as SchemaHistoryItem
                )"
                :key="index"
                class="text-xs text-(--el-text-color-regular)"
              >
                · {{ text }}
              </div>
            </template>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.historyVersion')" width="90">
        <template #default="{ row }">
          <span>v{{ (row as SchemaHistoryItem).version }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.historyFields')" width="90">
        <template #default="{ row }">
          {{ fieldsOf(row as SchemaHistoryItem).length }}
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.historyLinkages')" width="90">
        <template #default="{ row }">
          {{ (row as SchemaHistoryItem).schema?.linkages?.length ?? 0 }}
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.historyUpdated')" min-width="160">
        <template #default="{ row }">
          <span class="text-xs">
            {{ (row as SchemaHistoryItem).updated_time || "-" }}
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.historyBy')" width="120">
        <template #default="{ row }">
          <span class="text-xs">{{
            (row as SchemaHistoryItem).updated_by || "-"
          }}</span>
        </template>
      </el-table-column>
      <el-table-column
        v-if="canRollback"
        :label="t('dform.actions')"
        width="90"
      >
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            size="small"
            :disabled="submitting"
            data-testid="schema-rollback"
            @click="rollback(row as SchemaHistoryItem)"
          >
            {{ t("dform.historyRollback") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div
      v-if="!loading && !data.history.length"
      class="mt-2 text-xs text-(--el-text-color-secondary)"
    >
      {{ t("dform.historyEmpty") }}
    </div>
  </div>
</template>
