<script lang="ts" setup>
// 预览说明条目（后端下发的只读提示）：部门/岗位预览共用，逐条渲染 info 提示。
defineOptions({ name: "PreviewNotes" });

defineProps<{ notes: string[] }>();
</script>

<template>
  <el-alert
    v-for="note in notes"
    :key="note"
    :title="note"
    class="mt-2"
    :closable="false"
    show-icon
    type="info"
  />
</template>
