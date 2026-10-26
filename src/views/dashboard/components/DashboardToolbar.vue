<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { DashboardItem } from "@/api/dataset/datasets";
import { AUTO_REFRESH_OPTIONS } from "../utils/useDashboardAutoRefresh";

/**
 * 仪表盘工具栏（自 index.vue 拆分，行数门禁）：标题 + 仪表盘选择器 + 编辑态
 * 按钮组（新建/编辑/保存/删除/设置）与浏览态动作（快照导出/分享/刷新/自动
 * 刷新/数据集管理）。kiosk 展板路由整个工具栏不渲染（页面级判定）。
 */
defineOptions({ name: "DataDashboardToolbar" });

const props = defineProps<{
  canEdit: boolean;
  canCreate: boolean;
  canDestroy: boolean;
  current: DashboardItem | null;
  dashboards: DashboardItem[];
  editing: boolean;
  saving: boolean;
  exportingSnapshot: boolean;
}>();

/** 选择器受控值：按 pk 从清单取当前项（value-key 匹配显示） */
const selected = computed(() => {
  const pk = props.current?.pk;
  return props.dashboards.find(item => item.pk === pk);
});

const emit = defineEmits<{
  select: [pk: string];
  create: [];
  toggleEdit: [];
  save: [];
  remove: [];
  settings: [];
  exportSnapshot: [];
  share: [];
  refresh: [];
  goDatasets: [];
}>();

/** 自动刷新间隔（具名 v-model：auto-refresh-seconds，父级 useDashboardAutoRefresh 持有状态；
 *  无名 defineModel 会绑到 modelValue，与父级 v-model:auto-refresh-seconds 错位——档位永远同步不回父级） */
const autoRefreshSeconds = defineModel<number>("autoRefreshSeconds", {
  default: 0
});

const { t } = useI18n();
</script>

<template>
  <el-card shadow="never" class="mb-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">{{ t("dashboard.title") }}</span>
      <el-select
        :model-value="selected"
        :placeholder="t('dashboard.pickDashboard')"
        value-key="pk"
        class="w-56!"
        data-testid="dashboard-picker"
        @change="(item: DashboardItem) => emit('select', item.pk)"
      >
        <el-option
          v-for="item in dashboards"
          :key="item.pk"
          :value="item"
          :label="item.name"
        />
      </el-select>
      <el-button
        v-if="canCreate"
        data-testid="dashboard-create"
        @click="emit('create')"
      >
        {{ t("dashboard.create") }}
      </el-button>
      <el-button
        v-if="canEdit && current && current.is_owner !== false"
        :type="editing ? 'warning' : 'primary'"
        @click="emit('toggleEdit')"
      >
        {{ editing ? t("dashboard.cancelEdit") : t("dashboard.edit") }}
      </el-button>
      <el-button
        v-if="editing"
        type="success"
        :loading="saving"
        @click="emit('save')"
      >
        {{ t("dashboard.saveLayout") }}
      </el-button>
      <el-divider
        v-if="editing && canDestroy"
        direction="vertical"
        class="mx-1!"
      />
      <el-button
        v-if="editing && canDestroy"
        type="danger"
        plain
        @click="emit('remove')"
      >
        {{ t("dashboard.remove") }}
      </el-button>
      <el-button
        v-if="canEdit && current && current.is_owner !== false && !editing"
        plain
        data-testid="dashboard-settings"
        @click="emit('settings')"
      >
        {{ t("dashboard.settings") }}
      </el-button>
      <div class="flex-1" />
      <el-button
        v-if="current"
        link
        type="primary"
        data-testid="dashboard-export-snapshot"
        :loading="exportingSnapshot"
        @click="emit('exportSnapshot')"
      >
        {{ t("dashboard.exportSnapshot") }}
      </el-button>
      <el-button
        v-if="current"
        link
        type="primary"
        data-testid="dashboard-share"
        @click="emit('share')"
      >
        {{ t("dashboard.share") }}
      </el-button>
      <el-button
        v-if="current"
        link
        type="primary"
        data-testid="dashboard-refresh"
        @click="emit('refresh')"
      >
        {{ t("dashboard.refresh") }}
      </el-button>
      <el-select
        v-model="autoRefreshSeconds"
        class="w-28!"
        size="default"
        data-testid="dashboard-auto-refresh"
        :title="t('dashboard.autoRefreshTip')"
      >
        <el-option
          v-for="item in AUTO_REFRESH_OPTIONS"
          :key="item.value"
          :value="item.value"
          :label="t(item.labelKey)"
        />
      </el-select>
      <el-button link type="primary" @click="emit('goDatasets')">
        {{ t("dashboard.manageDatasets") }}
      </el-button>
    </div>
  </el-card>
</template>
