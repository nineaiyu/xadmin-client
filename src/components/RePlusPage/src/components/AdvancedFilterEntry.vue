<script lang="ts" setup>
import { h, ref, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { PageColumn } from "../utils/types";

/**
 * 高级筛选入口：工具栏按钮 + 弹窗编排 + 条件写回。
 *
 * 条件是 `searchFields` 的一部分（随「我的视图」快照一起持久化），
 * 故以 v-model 双向绑定搜索条件对象；写入后 emit `applied` 由页面/页面框架刷新列表。
 * 拆分自 `index.vue`（行数门禁）；弹窗内容组件**懒加载**（打开时才拉取，
 * 避免把编辑器进首屏闭包——包体门禁）。
 */
const model = defineModel<Record<string, unknown>>({ required: true });
const props = defineProps<{ columns: PageColumn[] }>();
const emit = defineEmits<{ applied: [] }>();
const { t } = useI18n();

let filterForm: Component | null = null;

const openFilterDialog = async () => {
  if (!filterForm) {
    filterForm = (await import("./AdvancedFilter.vue")).default;
  }
  const formRef = ref();
  addDialog({
    title: t("advancedFilter.title"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(filterForm!, {
        ref: formRef,
        columns: props.columns,
        conditions: model.value
      }),
    beforeSure: done => {
      const result = formRef.value?.getConditions?.();
      if (!result || result.error) {
        message(result?.error ?? String(t("results.failed")), {
          type: "error"
        });
        return;
      }
      model.value = result.params ?? {};
      emit("applied");
      done();
    }
  });
};
</script>

<template>
  <el-button
    :icon="useRenderIcon('ep/filter')"
    plain
    class="mr-3"
    @click="openFilterDialog"
  >
    {{ t("advancedFilter.button") }}
  </el-button>
</template>
