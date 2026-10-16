<script lang="ts" setup>
// 预览信息块（四类权限预览同构的统一外壳）：column=3 + border + small，
// 具体字段由使用方以 el-descriptions-item 插入（各对象信息结构不同，不强抽象字段）。
defineOptions({ name: "PreviewDescriptions" });

/** 标题（用户/部门预览有，角色/岗位预览无） */
defineProps<{ title?: string }>();
</script>

<template>
  <el-descriptions :title="title" :column="3" border size="small">
    <slot />
  </el-descriptions>
</template>
