<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { menuTypeTagType } from "../utils/normalize";
import { displayTitle, translateTitle } from "../utils/useMenuFilter";
import type { MenuRow } from "../utils/types";

/** 菜单抽屉头部：类型/标题/启停/面包屑/停用目录提示（自 MenuDrawerForm 拆出） */
defineOptions({ name: "MenuDrawerHeader" });

defineProps<{
  menuType: number;
  typeLabel: string;
  title: string;
  isActive: boolean;
  disabled?: boolean;
  parentChain: MenuRow[];
  descendantCount: number;
  cascadeInactive: boolean;
}>();

const emit = defineEmits<{
  "update:isActive": [value: boolean];
  "update:cascadeInactive": [value: boolean];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="menu-form__head">
    <div class="menu-form__head-main">
      <el-tag
        :type="menuTypeTagType(menuType)"
        class="menu-form__tag"
        effect="light"
        size="small"
      >
        {{ typeLabel }}
      </el-tag>
      <span class="menu-form__head-title">
        {{ title ? translateTitle(title) : t("systemMenu.verifyTitle") }}
      </span>
    </div>
    <el-switch
      :model-value="isActive"
      :aria-label="t('labels.status')"
      :disabled="disabled"
      @update:model-value="emit('update:isActive', Boolean($event))"
    />
  </div>

  <el-breadcrumb
    v-if="parentChain.length"
    separator="/"
    class="menu-form__crumb"
  >
    <el-breadcrumb-item v-for="item in parentChain" :key="item.pk">
      {{ displayTitle(item) }}
    </el-breadcrumb-item>
  </el-breadcrumb>

  <el-alert
    v-if="!isActive && descendantCount > 0"
    :closable="false"
    show-icon
    type="warning"
    :title="t('systemMenu.inactiveDirectoryHint')"
  >
    <template #default>
      <el-checkbox
        :model-value="cascadeInactive"
        :disabled="disabled"
        @update:model-value="emit('update:cascadeInactive', Boolean($event))"
      >
        {{ t("systemMenu.cascadeInactive", { count: descendantCount }) }}
      </el-checkbox>
    </template>
  </el-alert>
</template>

<style lang="scss" scoped>
.menu-form {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--el-border-color-lighter);
  }

  &__head-main {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  &__head-title {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--font-size-md);
    font-weight: 600;
    white-space: nowrap;
  }

  &__crumb {
    margin: 10px 0 4px;
  }

  &__tag {
    --el-tag-text-color: var(--el-text-color-regular);
  }
}
</style>
