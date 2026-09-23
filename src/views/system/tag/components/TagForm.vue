<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { TagItem } from "@/api/system/tag";

/**
 * 标签表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与列表刷新由页面在 `beforeSure` 中处理。
 */
defineOptions({ name: "TagForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: TagItem | null;
}>();

const { t } = useI18n();
const isEdit = !!props.row;

const DEFAULT_COLORS = [
  "#409EFF",
  "#67C23A",
  "#E6A23C",
  "#F56C6C",
  "#909399",
  "#8E44AD"
];

const form = reactive({
  name: props.row?.name ?? "",
  color: props.row?.color ?? "",
  remark: props.row?.remark ?? ""
});

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name.trim()) {
    message(t("tag.nameRequired"), { type: "warning" });
    return null;
  }
  return {
    name: form.name.trim(),
    color: form.color,
    remark: form.remark
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="90px">
    <el-form-item :label="t('tag.name')" required>
      <el-input
        v-model="form.name"
        maxlength="64"
        data-testid="tag-name"
        @keyup.enter="getPayload"
      />
    </el-form-item>
    <el-form-item :label="t('tag.color')">
      <el-color-picker v-model="form.color" :predefine="DEFAULT_COLORS" />
    </el-form-item>
    <el-form-item :label="t('tag.remark')">
      <el-input v-model="form.remark" maxlength="255" />
    </el-form-item>
    <el-form-item v-if="isEdit" :label="t('tag.usage')">
      <el-tag type="info" size="small">{{
        props.row?.usage_count ?? 0
      }}</el-tag>
    </el-form-item>
  </el-form>
</template>
