<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";

/**
 * 减签表单：选择当前节点上加签追加的 PENDING 候选移除（仅 is_added 行；或签节点由服务端拒绝）。
 *
 * 提交契约 `getPayload()`：返回 `{ task, comment }`；`null` = 校验未过 / 无可减签项（保持弹窗）。
 */
const props = defineProps<{ pk: string | number }>();
const { t } = useI18n();

const form = reactive({
  task: "",
  comment: ""
});
const candidates = ref<Array<{ pk: string; label: string }>>([]);
const loading = ref(true);

const getPayload = () => {
  if (!candidates.value.length) {
    message(t("systemApprovalInstance.removeSignEmpty"), { type: "warning" });
    return null;
  }
  if (!form.task) {
    message(t("systemApprovalInstance.removeSignRequired"), {
      type: "error"
    });
    return null;
  }
  return { task: form.task, comment: form.comment.trim() };
};

defineExpose({ getPayload });

onMounted(async () => {
  try {
    const res = await approvalInstanceApi.retrieve(props.pk);
    if (res.code === SUCCESS_CODE && res.data) {
      const detail = res.data as {
        tasks?: Array<{
          pk: string;
          is_added?: boolean;
          assignee?: { label?: string };
          assignee_display?: string;
          node_order?: number;
          node_name?: string;
          status?: { value?: string } | string;
        }>;
        /** my_task 仅指派给本人的待办才有；超管视角缺省，用当前节点名回退定位 */
        my_task?: { pk?: string; node_order?: number } | null;
        current_node_name?: string;
      };
      const statusOf = (value?: { value?: string } | string) =>
        (value as { value?: string })?.value ?? value;
      // 可减签面 = 当前节点的加签 PENDING 行
      const currentOrder = detail.my_task?.node_order;
      const currentNodeName = detail.current_node_name;
      candidates.value = (detail.tasks ?? [])
        .filter(
          task =>
            task.is_added &&
            statusOf(task.status) === "PENDING" &&
            (currentOrder !== undefined
              ? task.node_order === currentOrder
              : task.node_name === currentNodeName)
        )
        .map(task => ({
          pk: task.pk,
          label:
            task.assignee_display ||
            task.assignee?.label ||
            String(task.pk).slice(0, 8).toUpperCase()
        }));
      if (candidates.value.length) form.task = candidates.value[0].pk;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <el-form v-loading="loading" :model="form">
    <el-form-item prop="task" required>
      <el-select
        v-model="form.task"
        :disabled="!candidates.length"
        :placeholder="t('systemApprovalInstance.removeSignPlaceholder')"
      >
        <el-option
          v-for="item in candidates"
          :key="item.pk"
          :label="item.label"
          :value="item.pk"
        />
      </el-select>
    </el-form-item>
    <el-form-item prop="comment">
      <el-input
        v-model="form.comment"
        type="textarea"
        :rows="2"
        :maxlength="200"
        :placeholder="t('systemApprovalInstance.commentPlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>
