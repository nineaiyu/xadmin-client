<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import ReTableAction from "@/components/ReTableAction";
import {
  approvalFlowApi,
  type FlowVersionRow
} from "@/api/approval/approvalFlow";
import { message } from "@/utils/message";

/**
 * 流程定义版本历史：快照列表 + 回滚动作。
 * 回滚需确认；改版/回滚只影响之后发起的申请，在途单按发起时的版本推进（后端绑版本）。
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
      if (res.code === SUCCESS_CODE && res.data) {
        rows.value = res.data;
        return;
      }
      message(t("systemApprovalFlow.versionsLoadFailed"), { type: "warning" });
    })
    .catch(() => {
      message(t("systemApprovalFlow.versionsLoadFailed"), { type: "warning" });
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
      approvalFlowApi
        .rollback(props.flowPk, version, value || "")
        .then(res => {
          if (res.code === SUCCESS_CODE) {
            message(t("systemApprovalFlow.rollbackSuccess"), {
              type: "success"
            });
            emit("rollback");
            fetchVersions();
            return;
          }
          // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败显式提示
          message(String(res.detail || t("results.failed")), {
            type: "error"
          });
        })
        .catch(() => {
          /* HTTP 层错误提示由拦截器统一处理 */
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
          <el-tag v-if="$index === 0" size="small" type="success">
            {{ t("systemApprovalFlow.versionCurrent") }}
          </el-tag>
          <ReTableAction
            v-else
            align="center"
            size="small"
            :row="row"
            :actions="[
              {
                text: t('systemApprovalFlow.rollbackTitle'),
                danger: true,
                auth: 'rollback:SystemApprovalFlow',
                onClick: () => handleRollback(row.version)
              }
            ]"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
