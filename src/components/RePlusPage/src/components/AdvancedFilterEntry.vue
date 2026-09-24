<script lang="ts" setup>
import { computed, h, ref, type Component } from "vue";
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

/** 受控 lookup 键后缀（与 ControlledLookupFilterBackend.allowed_lookups 对齐） */
const LOOKUP_SUFFIXES = [
  "__icontains",
  "__exact",
  "__startswith",
  "__in",
  "__gte",
  "__lte",
  "__isnull",
  "__ne"
];

/**
 * 当前生效的高级筛选条件数（轻量判定，不把编辑器模块拉进首屏闭包）。
 * 用于在按钮上把「列表正在被高级筛选过滤」这一状态显式呈现出来——
 * 条件写在 searchFields 里但不占搜索区字段，用户此前无从感知列表已被过滤。
 */
const activeCount = computed(
  () =>
    Object.keys(model.value ?? {}).filter(key =>
      LOOKUP_SUFFIXES.some(suffix => key.endsWith(suffix))
    ).length
);

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
    :type="activeCount ? 'primary' : ''"
    :plain="activeCount > 0"
    class="mr-3"
    @click="openFilterDialog"
  >
    {{
      activeCount
        ? `${t("advancedFilter.button")} (${activeCount})`
        : t("advancedFilter.button")
    }}
  </el-button>
</template>
