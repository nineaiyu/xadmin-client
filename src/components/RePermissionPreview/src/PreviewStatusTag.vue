<script lang="ts" setup>
// 启用/停用状态标签（success/info 配色 + i18n 文案）：角色/部门/岗位预览共用。
import { useI18n } from "vue-i18n";

defineOptions({ name: "PreviewStatusTag" });

defineProps<{ active: boolean }>();

const { t } = useI18n();
</script>

<template>
  <el-tag :type="active ? 'success' : 'info'" size="small">
    {{
      active ? t("permissionPreview.enabled") : t("permissionPreview.disabled")
    }}
  </el-tag>
</template>
