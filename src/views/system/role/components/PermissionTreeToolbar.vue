<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import SearchIcon from "~icons/ri/search-line";
import type { PermissionSelectionStats } from "../utils/permissionTree";

defineOptions({ name: "PermissionTreeToolbar" });

interface Props {
  /** 搜索关键词 */
  keyword: string;
  /** 父子联动开关 */
  linked: boolean;
  /** 搜索命中数 */
  matchedCount: number;
  /** 勾选统计 */
  stats: PermissionSelectionStats;
  /** 当前是否为全部展开 */
  expandedAll: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  "update:keyword": [value: string];
  "update:linked": [value: boolean];
  selectAll: [];
  invert: [];
  clear: [];
  toggleExpand: [];
  reset: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="permission-toolbar">
    <div class="permission-toolbar__row">
      <el-input
        class="permission-toolbar__search"
        clearable
        :model-value="keyword"
        :placeholder="t('rolePermission.searchPlaceholder')"
        @update:model-value="emit('update:keyword', $event)"
      >
        <template #prefix>
          <el-icon>
            <IconifyIconOffline :icon="SearchIcon" />
          </el-icon>
        </template>
        <template v-if="matchedCount" #suffix>
          <span
            class="permission-toolbar__matched"
            data-testid="permission-matched"
          >
            {{ t("rolePermission.matchedCount", { count: matchedCount }) }}
          </span>
        </template>
      </el-input>
      <el-switch
        data-testid="permission-link-switch"
        :model-value="linked"
        :active-text="t('rolePermission.linked')"
        :inactive-text="t('rolePermission.independent')"
        @update:model-value="emit('update:linked', Boolean($event))"
      />
    </div>

    <div class="permission-toolbar__row">
      <el-button-group class="permission-toolbar__actions">
        <el-button size="small" @click="emit('selectAll')">
          {{ t("rolePermission.selectAll") }}
        </el-button>
        <el-button size="small" @click="emit('invert')">
          {{ t("rolePermission.invert") }}
        </el-button>
        <el-button size="small" @click="emit('clear')">
          {{ t("rolePermission.clear") }}
        </el-button>
        <el-button size="small" @click="emit('toggleExpand')">
          {{
            expandedAll
              ? t("rolePermission.collapseAll")
              : t("rolePermission.expandAll")
          }}
        </el-button>
        <el-button size="small" @click="emit('reset')">
          {{ t("rolePermission.reset") }}
        </el-button>
      </el-button-group>
      <div class="permission-toolbar__stats">
        <span class="permission-toolbar__total" data-testid="permission-total">
          {{
            t("rolePermission.selectedTotal", {
              checked: stats.checked,
              total: stats.total
            })
          }}
        </span>
        <el-tag size="small" effect="plain" type="info">
          {{
            t("rolePermission.statDirectory", {
              checked: stats.directory.checked,
              total: stats.directory.total
            })
          }}
        </el-tag>
        <el-tag size="small" effect="plain" type="primary">
          {{
            t("rolePermission.statMenu", {
              checked: stats.menu.checked,
              total: stats.menu.total
            })
          }}
        </el-tag>
        <el-tag size="small" effect="plain" type="success">
          {{
            t("rolePermission.statPermission", {
              checked: stats.permission.checked,
              total: stats.permission.total
            })
          }}
        </el-tag>
        <el-tag
          v-if="stats.field.total"
          size="small"
          effect="plain"
          type="warning"
        >
          {{
            t("rolePermission.statField", {
              checked: stats.field.checked,
              total: stats.field.total
            })
          }}
        </el-tag>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.permission-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  &__search {
    flex: 1;
    min-width: 240px;
  }

  &__matched {
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
  }

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-left: auto;
  }

  &__total {
    font-size: var(--el-font-size-small);
    color: var(--el-text-color-regular);
  }
}
</style>
