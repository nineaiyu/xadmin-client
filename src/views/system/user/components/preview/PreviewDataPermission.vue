<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  PreviewDataPermissions,
  PreviewDataRuleGroup
} from "@/api/types/permission-preview";

defineOptions({ name: "PreviewDataPermission" });

const props = defineProps<{
  data: PreviewDataPermissions;
}>();

const { t } = useI18n();

const MODE_LABELS: Record<number, string> = {
  0: t("permissionPreview.modeOr"),
  1: t("permissionPreview.modeAnd")
};

const hasContent = computed(
  () => props.data.personal.length > 0 || props.data.dept_chain.length > 0
);

function groupTitle(group: PreviewDataRuleGroup) {
  const menus = group.menus.length
    ? ` · ${t("permissionPreview.boundMenus")}: ${group.menus.map(m => m.title).join("、")}`
    : ` · ${t("permissionPreview.generalGrant")}`;
  return `${group.name} [${MODE_LABELS[group.mode_type] ?? group.mode_type}]${menus}`;
}
</script>

<template>
  <div>
    <el-alert
      v-if="data.superuser_bypass"
      :title="t('permissionPreview.superuserBypass')"
      type="success"
      :closable="false"
      show-icon
      class="mb-2"
    />
    <el-alert
      v-else-if="!data.has_any_grant"
      :title="t('permissionPreview.noGrant')"
      type="warning"
      :closable="false"
      show-icon
      class="mb-2"
    />
    <el-alert
      v-if="!data.enabled"
      :title="t('permissionPreview.dataDisabled')"
      type="info"
      :closable="false"
      show-icon
      class="mb-2"
    />

    <el-collapse v-if="hasContent">
      <el-collapse-item
        v-if="data.personal.length"
        :title="`${t('permissionPreview.personal')}（${data.personal.length}）`"
        name="personal"
      >
        <div v-for="group in data.personal" :key="group.pk" class="mb-3">
          <div class="mb-1 flex items-center gap-1 text-sm font-medium">
            <span>{{ groupTitle(group) }}</span>
            <el-tooltip
              v-if="group.menu_scoped"
              :content="t('permissionPreview.menuScopedHint')"
            >
              <el-tag size="small" type="warning">
                {{ t("permissionPreview.boundMenus") }}
              </el-tag>
            </el-tooltip>
          </div>
          <el-table :data="group.rules" size="small" border>
            <el-table-column
              prop="table_label"
              :label="t('permissionPreview.colTable')"
              min-width="110"
            />
            <el-table-column
              prop="field_label"
              :label="t('permissionPreview.colField')"
              min-width="100"
            />
            <el-table-column
              prop="type_text"
              :label="t('permissionPreview.colType')"
              min-width="120"
            />
            <el-table-column
              prop="match_text"
              :label="t('permissionPreview.colMatch')"
              width="110"
            />
            <el-table-column
              prop="value_text"
              :label="t('permissionPreview.colValue')"
              min-width="140"
            />
            <el-table-column
              :label="t('permissionPreview.colExclude')"
              width="70"
            >
              <template #default="{ row }">
                <el-tag v-if="row.exclude" type="danger" size="small">
                  {{ t("permissionPreview.excludeYes") }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-collapse-item>

      <el-collapse-item
        v-for="chain in data.dept_chain"
        :key="chain.dept.pk"
        :name="chain.dept.pk"
      >
        <template #title>
          <span>
            {{ chain.dept.name }}（{{
              t(`permissionPreview.relation_${chain.relation}`)
            }}，{{ chain.permissions.length }}）
          </span>
          <el-tag
            v-if="chain.is_active === false"
            class="ml-2"
            size="small"
            type="info"
          >
            {{ t("permissionPreview.disabled") }}
          </el-tag>
        </template>
        <el-alert
          v-if="chain.is_active === false"
          :closable="false"
          :title="t('permissionPreview.inactiveDeptHint')"
          class="mb-2"
          show-icon
          type="warning"
        />
        <el-empty
          v-if="!chain.permissions.length"
          :description="t('permissionPreview.noGrantAtLevel')"
          :image-size="60"
        />
        <div v-for="group in chain.permissions" :key="group.pk" class="mb-3">
          <div class="mb-1 flex items-center gap-1 text-sm font-medium">
            <span>{{ groupTitle(group) }}</span>
            <el-tooltip
              v-if="group.menu_scoped"
              :content="t('permissionPreview.menuScopedHint')"
            >
              <el-tag size="small" type="warning">
                {{ t("permissionPreview.boundMenus") }}
              </el-tag>
            </el-tooltip>
          </div>
          <el-table :data="group.rules" size="small" border>
            <el-table-column
              prop="table_label"
              :label="t('permissionPreview.colTable')"
              min-width="110"
            />
            <el-table-column
              prop="field_label"
              :label="t('permissionPreview.colField')"
              min-width="100"
            />
            <el-table-column
              prop="type_text"
              :label="t('permissionPreview.colType')"
              min-width="120"
            />
            <el-table-column
              prop="match_text"
              :label="t('permissionPreview.colMatch')"
              width="110"
            />
            <el-table-column
              prop="value_text"
              :label="t('permissionPreview.colValue')"
              min-width="140"
            />
            <el-table-column
              :label="t('permissionPreview.colExclude')"
              width="70"
            >
              <template #default="{ row }">
                <el-tag v-if="row.exclude" type="danger" size="small">
                  {{ t("permissionPreview.excludeYes") }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-alert
      :title="data.semantic_note"
      type="info"
      :closable="false"
      class="mt-2"
    />
  </div>
</template>
