<script lang="ts" setup>
// 可见菜单树只读展示（user/dept 全同、role 多一个权限码标签，收敛为可选 prop）。
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";
import type { PreviewMenuItem } from "@/api/types/permission-preview";
import { PREVIEW_TREE_PROPS } from "./hook";

defineOptions({ name: "PreviewMenuTree" });

defineProps<{
  data: PreviewMenuItem[];
  /** 角色预览的菜单节点含权限码行（menu_type=2）：追加 warning 码标签 */
  showCodeTag?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <el-tree
    v-if="data.length"
    :data="data"
    :props="PREVIEW_TREE_PROPS"
    node-key="pk"
    default-expand-all
  >
    <template #default="{ data: node }">
      <span class="flex items-center gap-1">
        <span>{{ node.title }}</span>
        <el-tag
          v-if="showCodeTag && node.menu_type === 2"
          size="small"
          type="warning"
        >
          {{ t("permissionPreview.codeTag") }}
        </el-tag>
        <el-tag size="small" type="info">{{ node.name }}</el-tag>
      </span>
    </template>
  </el-tree>
  <ReEmpty
    v-else
    :description="t('permissionPreview.emptyMenus')"
    :image-size="70"
  />
</template>
