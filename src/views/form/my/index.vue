<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  listRows,
  submissionApi,
  type FillableFormItem,
  type SubmissionItem
} from "@/api/system/dform";
import SubmissionForm from "./components/SubmissionForm.vue";

defineOptions({
  name: "FormMySubmission"
});

const { t } = useI18n();
const canEdit = hasAuth("partialUpdate:FormMySubmission");
const canDestroy = hasAuth("destroy:FormMySubmission");
const canExport = hasAuth("exportData:FormMySubmission");

const loading = ref(false);
const exporting = ref(false);
const forms = ref<FillableFormItem[]>([]);
const submissions = ref<SubmissionItem[]>([]);

/** 导出本人提交（C2：后端按表单 schema 展开动态列，导出范围跟随 creator 隔离） */
const exportCsv = async () => {
  exporting.value = true;
  try {
    await submissionApi.exportData({ type: "csv" });
  } catch (error) {
    message(String((error as { detail?: string })?.detail ?? error), {
      type: "warning"
    });
  } finally {
    exporting.value = false;
  }
};

const loadAll = async () => {
  loading.value = true;
  try {
    // 可填表单走 available-forms（定义类资源，不需要表单设计器权限）
    const [formRes, subRes] = await Promise.all([
      submissionApi.availableForms(),
      fetchAllRows(submissionApi.list)
    ]);
    forms.value = (formRes?.data ?? []) as FillableFormItem[];
    submissions.value = listRows<SubmissionItem>(subRes);
  } finally {
    loading.value = false;
  }
};

/** 填报 / 编辑提交弹窗（C5：统一走 ReDialog，动态字段渲染在 SubmissionForm 中） */
const submissionFormRef = ref<InstanceType<typeof SubmissionForm>>();

const openDialog = (
  form: FillableFormItem,
  submission: SubmissionItem | null = null
) => {
  submissionFormRef.value = undefined;
  addDialog({
    title: submission ? t("dform.editSubmission") : form.name,
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(SubmissionForm, { ref: submissionFormRef, form, submission }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = submissionFormRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
      const res = await (
        submission
          ? submissionApi.partialUpdate(submission.pk, payload)
          : submissionApi.create(payload)
      ).catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
      if (res.code === SUCCESS_CODE) {
        message(t("dform.saveOk"), { type: "success" });
        // 先关弹窗再刷新列表（与原手写弹窗行为一致，避免刷新耗时导致弹窗滞留）
        done();
        await loadAll();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openFill = (form: FillableFormItem) => openDialog(form, null);

const openEditSubmission = (submission: SubmissionItem) => {
  const form = forms.value.find(item => item.pk === submission.form);
  if (!form) return;
  openDialog(form, submission);
};

const remove = async (row: SubmissionItem) => {
  const res = await submissionApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) await loadAll();
};

/** 重新提交被驳回的填报（仅申请人、仅驳回态：按当前数据重新发起流程实例） */
const resubmit = async (row: SubmissionItem) => {
  const res = await submissionApi.resubmit(row.pk).catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error)
  }));
  if (res.code === SUCCESS_CODE) {
    message(t("dform.resubmitOk"), { type: "success" });
    await loadAll();
    return;
  }
  message(String(res.detail || t("results.failed")), { type: "warning" });
};

/** 审批状态样式（绑定流程的表单由审批结果回写） */
const statusType = (status?: string) =>
  (({
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "danger",
    CANCELLED: "info"
  })[status ?? ""] ?? "info") as "info" | "success" | "warning" | "danger";

/** 提交数据展示：非标量值 JSON 化，避免附件/日期范围/明细行渲染成 [object Object] */
const dataText = (data: Record<string, unknown>) =>
  Object.entries(data ?? {})
    .map(([key, value]) => {
      const text =
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : ((value ?? "-") as string);
      return `${key}: ${text}`;
    })
    .join(" | ") || "-";

const formName = (pk: string) =>
  forms.value.find(item => item.pk === pk)?.name ?? pk;

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->

    <!-- 可填表单卡片 -->
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-semibold">{{ t("dform.fillTitle") }}</span>
      </template>
      <el-empty
        v-if="forms.length === 0"
        :description="t('dform.noForms')"
        :image-size="60"
      />
      <div v-else class="flex flex-wrap gap-3">
        <el-card
          v-for="form in forms"
          :key="form.pk"
          shadow="hover"
          class="w-72 cursor-pointer"
          data-testid="fill-form-card"
          @click="openFill(form)"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ form.name }}</span>
            <el-tag
              v-if="form.approval_flow"
              size="small"
              type="primary"
              data-testid="fill-form-flow-tag"
            >
              {{ t("dform.flowOn") }}
            </el-tag>
            <el-tag
              v-else-if="form.approval_required"
              size="small"
              type="warning"
              data-testid="fill-form-approval-tag"
            >
              {{ t("dform.approvalOn") }}
            </el-tag>
          </div>
          <div class="mt-1 text-xs text-gray-500">
            {{ form.description || t("dform.noDescription") }}
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 我的提交 -->
    <el-card shadow="never">
      <template #header>
        <div class="flex-bc">
          <span class="font-semibold">{{ t("dform.mySubmissions") }}</span>
          <el-button
            v-if="canExport"
            link
            type="primary"
            :loading="exporting"
            data-testid="my-submission-export"
            @click="exportCsv"
          >
            {{ t("dform.exportCsv") }}
          </el-button>
        </div>
      </template>
      <el-table
        v-loading="loading"
        :data="submissions"
        data-testid="my-submission-table"
      >
        <el-table-column :label="t('dform.name')" min-width="140">
          <template #default="{ row }">{{
            formName((row as SubmissionItem).form)
          }}</template>
        </el-table-column>
        <el-table-column :label="t('dform.submissionData')" min-width="240">
          <template #default="{ row }">
            <span class="text-xs">{{
              dataText((row as SubmissionItem).data ?? {})
            }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.status')" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="(row as SubmissionItem).status?.value"
              size="small"
              :type="statusType((row as SubmissionItem).status?.value)"
              data-testid="submission-status-tag"
            >
              {{ (row as SubmissionItem).status?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="created_time"
          :label="t('dform.submittedAt')"
          width="170"
        />
        <el-table-column :label="t('dform.actions')" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="
                canEdit && (row as SubmissionItem).status?.value !== 'PENDING'
              "
              link
              type="primary"
              @click="openEditSubmission(row as SubmissionItem)"
            >
              {{ t("dform.edit") }}
            </el-button>
            <el-button
              v-if="(row as SubmissionItem).status?.value === 'REJECTED'"
              link
              type="primary"
              data-testid="submission-resubmit"
              @click="resubmit(row as SubmissionItem)"
            >
              {{ t("dform.resubmit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as SubmissionItem)"
            >
              {{ t("dform.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
