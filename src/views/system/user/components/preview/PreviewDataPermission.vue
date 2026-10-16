<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { PreviewRuleGroupTable } from "@/components/RePermissionPreview";
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
          <PreviewRuleGroupTable :rules="group.rules" />
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
        <ReEmpty
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
          <PreviewRuleGroupTable :rules="group.rules" />
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
