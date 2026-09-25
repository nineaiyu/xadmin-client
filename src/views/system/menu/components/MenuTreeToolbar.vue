<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { ReRecycleBin, type RecycleBinColumn } from "@/components/RePlusPage";
import { menuApi } from "@/api/system/menu";
import { MenuChoices } from "@/views/system/constants";
import type { MenuAuths, MenuRow } from "../utils/types";

import Add from "~icons/ep/plus";
import Key from "~icons/ep/key";
import More2Fill from "~icons/ri/more-2-fill";
import Upload from "~icons/ep/upload";
import Download from "~icons/ep/download";
import ExpandIcon from "../svg/expand.svg?component";
import UnExpandIcon from "../svg/unexpand.svg?component";
import Reset from "~icons/ri/restart-line";
import Refresh from "~icons/ep/refresh";
import Checked from "~icons/ri/checkbox-multiple-line";

/**
 * 菜单树工具栏：定位（搜索/类型/状态/展开层级）与操作（新增/权限码/导入导出/回收站/更多）分区。
 *
 * 旧实现把 6 类控件压成一行、把展开折叠与刷新塞进「更多」，定位与操作混杂；
 * 这里按「先定位后操作」分组，并对高频动作给出文字按钮（不再只有图标）。
 */

withDefaults(
  defineProps<{
    auth?: MenuAuths;
    stats?: {
      total: number;
      directory: number;
      menu: number;
      permission: number;
      inactive: number;
    };
    selected?: MenuRow | null;
    matchCount?: number;
    multiMode?: boolean;
    checkedCount?: number;
    isExpandAll?: boolean;
  }>(),
  {
    auth: () => ({}),
    stats: () => ({
      total: 0,
      directory: 0,
      menu: 0,
      permission: 0,
      inactive: 0
    }),
    selected: null,
    matchCount: 0,
    multiMode: false,
    checkedCount: 0,
    isExpandAll: false
  }
);

const keyword = defineModel<string>("keyword", { default: "" });
const menuType = defineModel<"all" | number>("menuType", { default: "all" });
const status = defineModel<"all" | "active" | "inactive">("status", {
  default: "all"
});
const expandLevel = defineModel<1 | 2 | 3>("expandLevel", { default: 2 });
const checkStrictly = defineModel<boolean>("checkStrictly", { default: false });

const emit = defineEmits<{
  add: [];
  permissions: [];
  refresh: [];
  reset: [];
  "toggle-all": [expand: boolean];
  "toggle-multi": [enabled: boolean];
  "select-all": [];
  "clear-selection": [];
  "batch-active": [isActive: boolean];
  "batch-delete": [];
  export: [];
  import: [];
}>();

const { t } = useI18n();
const searchRef = ref();

const recycleColumns = computed<RecycleBinColumn[]>(() => [
  { prop: "name", label: t("systemMenu.componentName") },
  { prop: "path", label: t("systemMenu.componentPath") }
]);

const typeOptions = computed(() => [
  { value: "all" as const, label: t("systemMenu.filter.allType") },
  { value: MenuChoices.DIRECTORY, label: t("systemMenu.directory") },
  { value: MenuChoices.MENU, label: t("systemMenu.menu") },
  { value: MenuChoices.PERMISSION, label: t("systemMenu.permissions") }
]);

const statusOptions = computed(() => [
  { value: "all" as const, label: t("systemMenu.filter.allStatus") },
  { value: "active" as const, label: t("systemMenu.filter.active") },
  { value: "inactive" as const, label: t("systemMenu.filter.inactive") }
]);

const levelOptions = computed(() => [
  { value: 1 as const, label: t("systemMenu.filter.level1") },
  { value: 2 as const, label: t("systemMenu.filter.level2") },
  { value: 3 as const, label: t("systemMenu.filter.levelAll") }
]);

/** ⌘/Ctrl + K 聚焦搜索（列表页通用习惯） */
const onKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchRef.value?.focus?.();
  }
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

const onMoreCommand = (command: string) => {
  if (command === "expand") emit("toggle-all", true);
  else if (command === "collapse") emit("toggle-all", false);
  else if (command === "multi") emit("toggle-multi", true);
  else if (command === "reset") emit("reset");
  else if (command === "refresh") emit("refresh");
  else if (command === "strictly") checkStrictly.value = !checkStrictly.value;
};
</script>

<template>
  <div class="menu-toolbar">
    <div class="menu-toolbar__locate">
      <el-input
        ref="searchRef"
        v-model="keyword"
        class="menu-toolbar__search"
        clearable
        size="default"
        :placeholder="t('systemMenu.searchPlaceholder')"
      >
        <template #prefix>
          <IconifyIconOffline icon="ri/search-line" />
        </template>
        <template #suffix>
          <span class="menu-toolbar__kbd">⌘K</span>
        </template>
      </el-input>
      <el-select v-model="menuType" class="menu-toolbar__select" size="default">
        <el-option
          v-for="item in typeOptions"
          :key="String(item.value)"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select v-model="status" class="menu-toolbar__select" size="default">
        <el-option
          v-for="item in statusOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="expandLevel"
        class="menu-toolbar__select"
        size="default"
      >
        <el-option
          v-for="item in levelOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <span class="menu-toolbar__stats">
        {{
          t("systemMenu.stats.summary", {
            total: stats.total,
            directory: stats.directory,
            menu: stats.menu,
            permission: stats.permission
          })
        }}
        <el-tag
          v-if="stats.inactive"
          class="menu-toolbar__tag ml-1"
          effect="light"
          size="small"
          type="info"
        >
          {{ t("systemMenu.stats.inactive", { count: stats.inactive }) }}
        </el-tag>
        <el-tag
          v-if="matchCount"
          class="menu-toolbar__tag ml-1"
          effect="light"
          size="small"
          type="primary"
        >
          {{ t("systemMenu.stats.matched", { count: matchCount }) }}
        </el-tag>
      </span>
    </div>

    <div class="menu-toolbar__actions">
      <el-button
        v-if="auth.create"
        :icon="useRenderIcon(Add)"
        type="primary"
        @click="emit('add')"
      >
        {{ t("buttons.add") }}
      </el-button>
      <el-tooltip
        v-if="auth.permissions"
        :content="t('systemMenu.permissionTip')"
        placement="top"
      >
        <el-button
          :icon="useRenderIcon(Key)"
          :disabled="!selected"
          @click="emit('permissions')"
        >
          {{ t("systemMenu.addPermissions") }}
        </el-button>
      </el-tooltip>

      <el-dropdown
        v-if="auth.importData || auth.exportData"
        :hide-on-click="false"
      >
        <el-button>{{ t("systemMenu.importExport") }}</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-if="auth.exportData" @click="emit('export')">
              <el-icon><component :is="useRenderIcon(Download)" /></el-icon>
              {{ t("exportImport.export") }}
            </el-dropdown-item>
            <el-dropdown-item v-if="auth.importData" @click="emit('import')">
              <el-icon><component :is="useRenderIcon(Upload)" /></el-icon>
              {{ t("exportImport.import") }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <re-recycle-bin
        v-if="auth.recycleList"
        :api="menuApi"
        locale-name="systemMenu"
        :columns="recycleColumns"
        @changed="emit('refresh')"
      />

      <el-dropdown @command="onMoreCommand">
        <IconifyIconOffline
          :icon="More2Fill"
          :aria-label="t('layout.more')"
          class="menu-toolbar__more"
          width="18px"
        />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="expand" :disabled="multiMode">
              <el-icon>
                <component
                  :is="useRenderIcon(isExpandAll ? UnExpandIcon : ExpandIcon)"
                />
              </el-icon>
              {{
                isExpandAll ? t("buttons.collapseAll") : t("buttons.expendAll")
              }}
            </el-dropdown-item>
            <el-dropdown-item command="multi" :disabled="multiMode">
              <el-icon><component :is="useRenderIcon(Checked)" /></el-icon>
              {{ t("systemMenu.action.multiMode") }}
            </el-dropdown-item>
            <el-dropdown-item command="strictly">
              <el-icon><component :is="useRenderIcon(Checked)" /></el-icon>
              {{
                checkStrictly
                  ? t("buttons.checkUnStrictly")
                  : t("buttons.checkStrictly")
              }}
            </el-dropdown-item>
            <el-dropdown-item command="reset" divided>
              <el-icon><component :is="useRenderIcon(Reset)" /></el-icon>
              {{ t("buttons.reset") }}
            </el-dropdown-item>
            <el-dropdown-item command="refresh">
              <el-icon><component :is="useRenderIcon(Refresh)" /></el-icon>
              {{ t("buttons.reload") }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>

  <div v-if="multiMode" class="menu-batchbar">
    <span class="menu-batchbar__count">
      {{ t("buttons.selected", { count: checkedCount }) }}
    </span>
    <el-button
      size="small"
      :disabled="!checkedCount"
      @click="emit('select-all')"
    >
      {{ t("buttons.selectAll") }}
    </el-button>
    <el-button
      size="small"
      :disabled="!checkedCount"
      @click="emit('clear-selection')"
    >
      {{ t("buttons.unSelectAll") }}
    </el-button>
    <el-divider direction="vertical" />
    <el-button
      v-if="auth.batchUpdate || auth.partialUpdate"
      size="small"
      type="primary"
      plain
      :disabled="!checkedCount"
      @click="emit('batch-active', true)"
    >
      {{ t("systemMenu.action.batchEnable") }}
    </el-button>
    <el-button
      v-if="auth.batchUpdate || auth.partialUpdate"
      size="small"
      type="warning"
      plain
      :disabled="!checkedCount"
      @click="emit('batch-active', false)"
    >
      {{ t("systemMenu.action.batchDisable") }}
    </el-button>
    <el-button
      v-if="auth.batchDestroy"
      size="small"
      type="danger"
      plain
      :disabled="!checkedCount"
      @click="emit('batch-delete')"
    >
      {{ t("buttons.batchDestroy") }}
    </el-button>
    <el-button link size="small" @click="emit('toggle-multi', false)">
      {{ t("systemMenu.action.exitMulti") }}
    </el-button>
  </div>
</template>

<style lang="scss" scoped>
.menu-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);

  &__locate {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  &__search {
    width: 260px;
  }

  &__select {
    width: 120px;
  }

  &__stats {
    display: inline-flex;
    align-items: center;
    font-size: var(--el-font-size-extra-small);

    /* 小字号必须满足 AA 对比度：secondary(#909399) 在白底仅 3:1，改用 regular(5.4:1) */
    color: var(--el-text-color-regular);
  }

  &__kbd {
    font-size: 11px;
    color: var(--el-text-color-regular);
  }

  /* el-tag 的 light 效果文字色取主题色（白底对比不足）：统一覆写为 regular */
  &__tag {
    --el-tag-text-color: var(--el-text-color-regular);
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__more {
    cursor: pointer;
  }
}

.menu-batchbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 12px;
  background: var(--el-color-primary-light-9);

  &__count {
    font-size: var(--el-font-size-small);
    color: var(--el-color-primary);
  }
}
</style>
