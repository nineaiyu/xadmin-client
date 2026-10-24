<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { ManagedDeptItem, ManagedUserRef } from "@/api/identity/dept";

/**
 * 「我的管辖」卡片视图（自 index.vue 拆分，行数门禁）：管辖部门卡片网格
 * （名称 / 直属标记 / 编码 / 上级 / 负责人与管理员折叠展示）+ 成员入口。
 * 渲染上限与「加载更多」由父级驱动（传入的已是可见切片）。
 */
defineOptions({ name: "SystemMyScopeDeptCardList" });

defineProps<{
  /** 可见切片（父级已按关键字过滤并截断渲染上限） */
  depts: ManagedDeptItem[];
  /** pk → 部门名（卡片展示上级部门用） */
  parentNames: Map<string, string>;
  /** 用户管理入口权限（无权限时成员入口只读禁用） */
  canListUsers: boolean;
  /** 剩余未渲染数量（>0 时渲染「加载更多」，点击由父级放量） */
  remainingCount: number;
}>();

const emit = defineEmits<{
  openMembers: [dept: ManagedDeptItem];
  goDeptUsers: [pk: string];
  loadMore: [];
}>();

const { t } = useI18n();

const userLabel = (user: ManagedUserRef) =>
  user.nickname ? `${user.nickname}(${user.username})` : user.username;

/** 管理员清单折叠展示：超出 2 人收敛为「+N」（悬浮提示全量） */
const foldUsers = (users: ManagedUserRef[]) => {
  const shown = users.slice(0, 2).map(userLabel);
  if (users.length > 2) {
    shown.push(`+${users.length - 2}`);
  }
  return shown.join("、");
};
</script>

<template>
  <div class="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
    <el-card
      v-for="dept in depts"
      :key="dept.pk"
      shadow="hover"
      data-testid="my-scope-dept"
    >
      <div class="flex-bc gap-2">
        <span class="font-medium truncate">{{ dept.name }}</span>
        <el-tag v-if="dept.is_direct" size="small" type="primary">
          {{ t("systemMyScope.direct") }}
        </el-tag>
      </div>
      <div class="mt-1 text-xs opacity-60">{{ dept.code }}</div>
      <div
        v-if="dept.parent_id && parentNames.get(dept.parent_id)"
        class="mt-1 text-xs opacity-60"
      >
        {{ t("systemMyScope.parentDept") }}:
        {{ parentNames.get(dept.parent_id) }}
      </div>

      <el-divider class="my-2!" />

      <div class="flex items-center gap-1 text-xs">
        <span class="opacity-60 shrink-0">
          {{ t("systemMyScope.leader") }}
        </span>
        <span class="truncate">
          {{ dept.leader ? userLabel(dept.leader) : "-" }}
        </span>
      </div>
      <div class="flex items-center gap-1 text-xs mt-1">
        <span class="opacity-60 shrink-0">
          {{ t("systemMyScope.managers") }}
        </span>
        <span
          v-if="dept.managers.length"
          class="truncate"
          :title="dept.managers.map(userLabel).join('、')"
        >
          {{ foldUsers(dept.managers) }}
        </span>
        <span v-else>-</span>
      </div>

      <div class="flex-bc mt-3">
        <el-link
          :disabled="!canListUsers"
          underline="never"
          data-testid="my-scope-members"
          @click="emit('openMembers', dept)"
        >
          {{ t("systemMyScope.members", { count: dept.user_count }) }}
        </el-link>
        <el-button
          link
          type="primary"
          :disabled="!canListUsers"
          :title="t('systemMyScope.viewInUserPage')"
          @click="emit('goDeptUsers', dept.pk)"
        >
          {{ t("systemMyScope.manageMembers") }}
        </el-button>
      </div>
    </el-card>
  </div>
  <div v-if="remainingCount > 0" class="mt-3 text-center">
    <el-button
      link
      type="primary"
      data-testid="my-scope-load-more"
      @click="emit('loadMore')"
    >
      {{ t("systemMyScope.loadMore", { count: remainingCount }) }}
    </el-button>
  </div>
</template>
