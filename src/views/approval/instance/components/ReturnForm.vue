<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";

/**
 * 退回表单：目标节点（服务端下发已途经节点，缺省 = 上一途经节点）+ 退回原因（必填）。
 *
 * 提交契约 `getPayload()`：返回 `{ reason, target_order }`；`null` = 校验未过（保持弹窗）。
 */
const props = defineProps<{ pk: string | number }>();
const { t } = useI18n();

const form = reactive({
  reason: "",
  target_order: undefined as number | undefined
});
const targets = ref<Array<{ order: number; name: string }>>([]);
const loading = ref(true);

const getPayload = () => {
  if (!targets.value.length) {
    message(t("systemApprovalInstance.returnNoTarget"), { type: "error" });
    return null;
  }
  if (!form.reason.trim()) {
    message(t("systemApprovalInstance.returnReasonRequired"), {
      type: "error"
    });
    return null;
  }
  return {
    reason: form.reason.trim(),
    target_order: form.target_order
  };
};

defineExpose({ getPayload });

onMounted(async () => {
  try {
    const res = await approvalInstanceApi.returnTargets(props.pk);
    if (res.code === SUCCESS_CODE && res.data) {
      targets.value = res.data;
      form.target_order = targets.value[0]?.order;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <el-form v-loading="loading" :model="form">
    <el-form-item
      prop="target_order"
      :label="t('systemApprovalInstance.returnTarget')"
    >
      <el-select
        v-model="form.target_order"
        :disabled="!targets.length"
        :placeholder="t('systemApprovalInstance.returnTargetPlaceholder')"
      >
        <el-option
          v-for="item in targets"
          :key="item.order"
          :label="`#${item.order} ${item.name}`"
          :value="item.order"
        />
      </el-select>
    </el-form-item>
    <el-form-item prop="reason" required>
      <el-input
        v-model="form.reason"
        type="textarea"
        :rows="3"
        maxlength="255"
        :placeholder="t('systemApprovalInstance.returnReasonPlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>
