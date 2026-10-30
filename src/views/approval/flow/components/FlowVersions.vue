<script lang="ts" setup>
import { isSuccess } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePrompt } from "@/hooks/useMessageBox";
import ReTableAction from "@/components/ReTableAction";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
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

/** 版本历史只读列（版本号/动作走插槽） */
const columns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "version",
    label: t("systemApprovalFlow.versionNo"),
    width: 90,
    align: "center",
    slot: "version"
  },
  {
    prop: "remark",
    label: t("systemApprovalFlow.versionRemark"),
    minWidth: 140
  },
  {
    prop: "created_time",
    label: t("accessToken.createdTime"),
    width: 170
  },
  { width: 90, align: "center", slot: "actions" }
]);

const fetchVersions = () => {
  loading.value = true;
  approvalFlowApi
    .versions(props.flowPk)
    .then(res => {
      if (isSuccess(res) && res.data) {
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

const handleRollback = async (version: number) => {
  const answer = await usePrompt()(
    t("systemApprovalFlow.rollbackConfirm", { n: version }),
    t("systemApprovalFlow.rollbackTitle"),
    {
      confirmButtonText: t("buttons.confirm"),
      cancelButtonText: t("buttons.cancel"),
      inputPlaceholder: t("systemApprovalFlow.rollbackRemark"),
      // 回滚是破坏性操作：确认钮着危险色（useConfirm 同口径；
      // prompt 模式焦点本就在输入框，不存在回车误确认问题）
      danger: true
    }
  );
  if (!answer) return;
  const res = await approvalFlowApi
    .rollback(props.flowPk, version, answer.value || "")
    .catch(() => null);
  if (!res) return;
  if (isSuccess(res)) {
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
};

onMounted(fetchVersions);
</script>

<template>
  <div>
    <el-alert
      :closable="false"
      type="info"
      :title="t('systemApprovalFlow.versionsTip')"
      class="mb-3"
    />
    <ReReadonlyTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      size="small"
      border
    >
      <template #version="{ row }"> v{{ row.version }} </template>
      <template #actions="{ row, $index }">
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
    </ReReadonlyTable>
  </div>
</template>
