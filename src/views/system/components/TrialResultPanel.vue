<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TrialResult } from "@/api/types/permission-preview";

defineOptions({ name: "TrialResultPanel" });

/**
 * 数据权限试算结果展示（配置页「即时试算」与用户预览「数据权限试算」共用）：
 * 命中行数 + 草稿标记 + 耗时 + 样本行 + 生效授权诊断 + 最终 SQL（只读）。
 */
const props = withDefaults(
  defineProps<{
    result: TrialResult;
    /** 是否展示草稿标记（配置页试算为草稿场景；用户预览为已保存配置，不展示） */
    showDraft?: boolean;
    /** 规则已变化（配置页）：提示重新试算，避免误读旧结果 */
    stale?: boolean;
  }>(),
  { showDraft: false, stale: false }
);

const { t } = useI18n();

const KIND_TAG_TYPES = {
  all: "success",
  condition: "primary",
  deny: "danger",
  none: "info"
} as const;

const sourceTexts = computed<Record<string, string>>(() => ({
  personal: t("permissionPreview.sourcePersonal"),
  dept: t("permissionPreview.sourceDept"),
  draft: t("permissionPreview.sourceDraft")
}));

/** 诊断类型 tag 色（未知类型回退 info） */
const kindTagType = (kind: string) =>
  KIND_TAG_TYPES[kind as keyof typeof KIND_TAG_TYPES] ?? "info";

const kindTexts = computed<Record<string, string>>(() => ({
  all: t("permissionPreview.kindAll"),
  condition: t("permissionPreview.kindCondition"),
  deny: t("permissionPreview.kindDeny"),
  none: t("permissionPreview.kindNone")
}));
</script>

<template>
  <div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <span class="text-sm text-(--el-text-color-regular)">{{
        t("permissionPreview.hitCount")
      }}</span>
      <span class="text-xl font-semibold">{{ props.result.count }}</span>
      <el-tag
        v-if="props.showDraft"
        :type="props.result.draft_applied ? 'success' : 'info'"
        size="small"
      >
        {{
          props.result.draft_applied
            ? t("permissionPreview.draftApplied")
            : t("permissionPreview.draftSkipped")
        }}
      </el-tag>
      <el-tag
        v-if="props.result.elapsed_ms !== undefined"
        size="small"
        type="info"
      >
        {{ t("permissionPreview.elapsed", { ms: props.result.elapsed_ms }) }}
      </el-tag>
      <el-tag v-if="props.stale" size="small" type="warning">
        {{ t("permissionPreview.staleHint") }}
      </el-tag>
    </div>
    <el-alert
      v-if="props.result.note"
      :title="props.result.note"
      class="mt-2"
      :closable="false"
      show-icon
      type="warning"
    />
    <div v-if="props.result.sample?.length" class="mt-2">
      <span class="text-sm text-(--el-text-color-regular)">{{
        t("permissionPreview.sampleRows")
      }}</span>
      <el-tag
        v-for="row in props.result.sample"
        :key="row.pk"
        class="mr-1"
        size="small"
      >
        {{ row.label || row.pk }}
      </el-tag>
      <el-text class="mt-1 block" size="small" type="info">
        {{
          t("permissionPreview.sampleNote", {
            limit: props.result.sample_limit ?? props.result.sample.length
          })
        }}
      </el-text>
    </div>
    <el-collapse v-if="props.result.grants?.length" class="mt-2">
      <el-collapse-item
        :title="`${t('permissionPreview.grantDiagnosis')}（${props.result.grants.length}）`"
        name="grants"
      >
        <el-table :data="props.result.grants" border size="small">
          <el-table-column
            :label="t('permissionPreview.diagnosisSource')"
            width="110"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.source === 'draft' ? 'warning' : 'info'"
                size="small"
              >
                {{ sourceTexts[row.source] ?? row.source }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('permissionPreview.diagnosisName')"
            min-width="160"
          >
            <template #default="{ row }">
              <span>{{ row.name }}</span>
              <span
                v-if="row.dept_name"
                class="text-(--el-text-color-secondary)"
              >
                （{{ row.dept_name }}）
              </span>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('permissionPreview.diagnosisKind')"
            width="130"
          >
            <template #default="{ row }">
              <el-tag :type="kindTagType(row.kind)" size="small">
                {{ kindTexts[row.kind] ?? row.kind }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>
    <el-input
      :model-value="props.result.sql"
      class="mt-2"
      :rows="5"
      readonly
      type="textarea"
    />
  </div>
</template>
