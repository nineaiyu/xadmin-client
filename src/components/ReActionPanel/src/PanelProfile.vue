<script lang="ts" setup>
import { computed } from "vue";
import type { PanelProfileData } from "./types";
import { SOLID_TAG_STYLE } from "@/utils/tagTone";

/**
 * 资料卡内容（实体管理抽屉通用模板）：头像/徽标 + 名称行 + 状态标签 + 标签行。
 *
 * 页面从行快照构建 `PanelProfileData` 传入即可，不再各自手写资料卡模板与样式；
 * 名称行右侧附加内容（如启用状态）走 `trailing` 渲染函数或 `#trailing` 插槽，
 * 资料卡内的其余自定义区块由页面在 ReActionPanel 的 `#profile` 插槽内追加。
 */
defineOptions({ name: "PanelProfile" });

const props = defineProps<{
  profile: PanelProfileData;
}>();

const badgeText = computed(
  () => props.profile.badgeText || props.profile.name?.slice(0, 1) || "?"
);
</script>

<template>
  <div class="flex items-center gap-3">
    <el-image
      v-if="profile.avatar"
      :src="profile.avatar"
      :preview-src-list="[profile.avatar]"
      preview-teleported
      fit="cover"
      class="pp-avatar"
      :alt="profile.name"
    />
    <div
      v-else
      class="pp-badge"
      :class="
        profile.shape === 'circle' ? 'pp-badge--circle' : 'pp-badge--square'
      "
    >
      {{ badgeText }}
    </div>
    <div class="min-w-0 flex-1">
      <div class="profile-name">{{ profile.name }}</div>
      <div v-if="profile.subtitle" class="profile-sub">
        {{ profile.subtitle }}
      </div>
    </div>
    <span v-if="$slots.trailing || profile.trailing" class="profile-trailing">
      <slot name="trailing">
        <component :is="profile.trailing" />
      </slot>
    </span>
  </div>

  <div v-if="profile.statusTags?.length" class="mt-3 flex flex-wrap gap-1.5">
    <el-tag
      v-for="tag in profile.statusTags"
      :key="tag.key"
      :type="tag.type"
      size="small"
      effect="plain"
    >
      {{ tag.text }}
    </el-tag>
  </div>

  <template v-for="row in profile.tagRows ?? []" :key="row.key">
    <div
      v-if="row.items.length"
      class="mt-2 flex flex-wrap items-center gap-1.5"
    >
      <span class="tag-caption">{{ row.caption }}</span>
      <el-tag
        v-for="item in row.items"
        :key="item.key"
        size="small"
        :type="item.type"
        :effect="item.plain ? 'plain' : undefined"
        :color="item.color || undefined"
        :style="item.color ? SOLID_TAG_STYLE : undefined"
      >
        {{ item.name }}
      </el-tag>
    </div>
  </template>
</template>

<style scoped lang="scss">
.pp-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border-radius: 50%;
}

.pp-badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: 600;
  color: var(--el-color-primary);
  user-select: none;
  background: var(--el-color-primary-light-7);
}

.pp-badge--circle {
  width: 56px;
  height: 56px;
  font-size: var(--display-size-sm);
  border-radius: 50%;
}

.pp-badge--square {
  width: 44px;
  height: 44px;
  font-size: var(--font-size-xl);
  border-radius: var(--radius-lg);
}

.profile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-medium);
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.profile-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-extra-small);
  line-height: 18px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.profile-trailing {
  flex-shrink: 0;
}

.tag-caption {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
