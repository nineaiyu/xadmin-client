<script lang="ts" setup generic="T">
// 权限只读预览统一外壳：加载容器 + 数据就绪才渲染内容 + 失败空态。
// 四类维度预览（用户/角色/部门/岗位）共用。数据经作用域插槽下发（已收窄为非空），
// 消费侧无需对可空数据做非空断言，也避免空态与内容各写一遍判空。
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";

defineOptions({ name: "RePermissionPreviewShell" });

defineProps<{
  /** 加载态（v-loading） */
  loading: boolean;
  /** 预览数据；为空（null / undefined）时展示加载失败空态 */
  data: T | null | undefined;
}>();

const { t } = useI18n();
</script>

<template>
  <div v-loading="loading">
    <slot v-if="data" :data="data" />
    <ReEmpty
      v-else
      :description="t('permissionPreview.loadFailed')"
      :image-size="70"
    />
  </div>
</template>
