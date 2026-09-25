<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";

/**
 * 审批通过表单：审批意见选填（会签/多级场景随任务留痕，进审批轨迹）。
 *
 * 提交契约 `getPayload()`：返回载荷对象；返回 `null` 表示校验未过，调用方保持弹窗。
 * 单行「通过」与工具栏「批量通过」共用本组件（载荷结构一致，仅弹窗标题不同）。
 */
const { t } = useI18n();
const form = reactive({ comment: "" });

const getPayload = () => ({ comment: form.comment.trim() });

defineExpose({ getPayload });
</script>

<template>
  <el-form :model="form">
    <el-form-item prop="comment">
      <el-input
        v-model="form.comment"
        type="textarea"
        :rows="3"
        :maxlength="200"
        show-word-limit
        :placeholder="t('systemApprovalInstance.commentPlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>
