<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";

/**
 * 表单选择卡片骨架：标题 + 失败重试 + 空态 + 选择器插槽。
 *
 * 「我的填报」（可填卡片网格）与「填报数据」（下拉选择）两页的入口区同构，
 * 差异只在选择器形态——由默认插槽承载；加载失败 / 空清单 / 就绪三态收敛在此。
 * 词条按 localeName 命名空间取（dform / formData）：两页空态文案语义不同
 * （可填 vs 可查看），保持各自准确而不是强行统一。
 */
defineOptions({ name: "FormSelectorCard" });

defineProps<{
  title: string;
  forms: unknown[];
  loadFailed: boolean;
  localeName: "dform" | "formData";
}>();

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n();
</script>

<template>
  <el-card shadow="never" class="mb-3">
    <template #header>
      <span class="font-semibold">{{ title }}</span>
    </template>
    <ReEmpty
      v-if="loadFailed"
      :description="t(`${localeName}.formsLoadFailed`)"
      :image-size="60"
    >
      <el-button size="small" type="primary" @click="emit('retry')">
        {{ t(`${localeName}.retry`) }}
      </el-button>
    </ReEmpty>
    <ReEmpty
      v-else-if="forms.length === 0"
      :description="t(`${localeName}.noForms`)"
      :image-size="60"
    />
    <slot v-else />
  </el-card>
</template>
