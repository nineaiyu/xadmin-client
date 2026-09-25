<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";

/**
 * 催办表单：留言选填（通知当前节点审批人；服务端 10 分钟节流）。
 *
 * 提交契约 `getPayload()`：返回载荷对象；返回 `null` 表示校验未过，调用方保持弹窗。
 */
const { t } = useI18n();
const form = reactive({ message: "" });

const getPayload = () => ({ message: form.message.trim() });

defineExpose({ getPayload });
</script>

<template>
  <el-form :model="form">
    <el-form-item prop="message">
      <el-input
        v-model="form.message"
        type="textarea"
        :rows="3"
        :maxlength="200"
        show-word-limit
        :placeholder="t('systemApprovalInstance.urgeMessagePlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>
