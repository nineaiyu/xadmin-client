<script lang="ts" setup>
import { ref } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";

/**
 * crontab / interval 两页共用薄壳：两个菜单与权限点保持独立，
 * 仅收敛重复的 RePlusPage 装配（P2-067）。
 */
defineOptions({ name: "SchedulePage" });

defineProps<{
  api: RePlusPageProps["api"];
  auth: RePlusPageProps["auth"];
  localeName: string;
  listColumnsFormat?: RePlusPageProps["listColumnsFormat"];
  addOrEditOptions?: RePlusPageProps["addOrEditOptions"];
  operationButtonsProps?: RePlusPageProps["operationButtonsProps"];
}>();

const tableRef = ref();

defineExpose({
  handleGetData: (...args: unknown[]) =>
    tableRef.value?.handleGetData?.(...args),
  getSelectPks: (key?: string) => tableRef.value?.getSelectPks?.(key) ?? []
});
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :locale-name="localeName"
    :selection="false"
    :list-columns-format="listColumnsFormat"
    :add-or-edit-options="addOrEditOptions"
    :operation-buttons-props="operationButtonsProps"
  />
</template>
