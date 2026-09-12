<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  approvalFlowApi,
  type FlowVersionRow
} from "@/api/system/approvalFlow";

/**
 * 流程定义版本历史（ADR-016 §2）：快照列表 + 回滚动作。
 * 回滚需确认；有在途申请时后端拒绝并提示。
 */
defineOptions({ name: "FlowVersions" });

const props = defineProps<{ flowPk: string }>();
const emit = defineEmits<{ rollback: [] }>();

const { t } = useI18n();
const loading = ref(false);
const rows = ref<FlowVersionRow[]>([]);

const fetchVersions = () => {
  loading.value = true;
  approvalFlowApi
    .versions(props.flowPk)
    .then(res => {
      if (res.code === 1000 && res.data) {
        rows.value = res.data;
      }
    })
    .finally(() => {
      loading.value = false;
    });
};

const handleRollback = (version: number) => {
  ElMessageBox.prompt(
    t("systemApprovalFlow.rollbackConfirm", { n: version }),
    t("systemApprovalFlow.rollbackTitle"),
    {
      confirmButtonText: t("buttons.confirm"),
      cancelButtonText: t("buttons.cancel"),
      inputPlaceholder: t("systemApprovalFlow.rollbackRemark")
    }
  )
    .then(({ value }) => {
      approvalFlowApi.rollback(props.flowPk, version, value || "").then(res => {
        if (res.code === 1000) {
          ElMessage.success(t("systemApprovalFlow.rollbackSuccess"));
          emit("rollback");
          fetchVersions();
        }
      });
    })
    .catch(() => {
      // 取消确认框：静默
    });
};

onMounted(fetchVersions);
</script>

<template>
  <div v-loading="loading">
    <el-alert
      :closable="false"
      type="info"
      :title="t('systemApprovalFlow.versionsTip')"
      class="mb-3"
    />
    <el-table :data="rows" size="small" border>
      <el-table-column
        prop="version"
        :label="t('systemApprovalFlow.versionNo')"
        width="90"
        align="center"
      >
        <template #default="{ row }"> v{{ row.version }} </template>
      </el-table-column>
      <el-table-column
        prop="remark"
        :label="t('systemApprovalFlow.versionRemark')"
        min-width="140"
      />
      <el-table-column
        prop="created_time"
        :label="t('accessToken.createdTime')"
        width="170"
      />
      <el-table-column width="90" align="center">
        <template #default="{ row, $index }">
          <el-button
            v-if="$index !== 0"
            link
            type="warning"
            size="small"
            @click="handleRollback(row.version)"
          >
            {{ t("systemApprovalFlow.rollbackTitle") }}
          </el-button>
          <el-tag v-else size="small" type="success">
            {{ t("systemApprovalFlow.versionCurrent") }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
