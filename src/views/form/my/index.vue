<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";
import { useFormMySubmissions } from "./utils/hook";

defineOptions({
  name: "FormMySubmission"
});

const { t } = useI18n();

const {
  api,
  auth,
  tableRef,
  forms,
  formsLoadFailed,
  loadForms,
  listColumnsFormat,
  searchColumnsFormat,
  operationButtonsProps,
  openFill
} = useFormMySubmissions();
</script>

<template>
  <div>
    <!-- 与列表页内容区同宽：页面留白由 layout 的 main-content 统一提供，
         不再用 pr-[1%] 模拟 RePlusPage 搜索卡的 1% 右留白 -->

    <!-- 可填表单卡片：本页填报入口（属于「选择表单」语义，不进表格工具栏） -->
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-semibold">{{ t("dform.fillTitle") }}</span>
      </template>
      <ReEmpty
        v-if="formsLoadFailed"
        :description="t('dform.formsLoadFailed')"
        :image-size="60"
      >
        <el-button type="primary" @click="loadForms">
          {{ t("dform.retry") }}
        </el-button>
      </ReEmpty>
      <ReEmpty
        v-else-if="forms.length === 0"
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
          <div class="mt-1 text-xs text-(--el-text-color-regular)">
            {{ form.description || t("dform.noDescription") }}
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 我的提交：搜索 / 分页 / 列设置 / 行操作收敛由框架统一接管；
         testid 挂在容器上供 E2E 做行定位（RePlusPage 内部无法挂锚点） -->
    <div data-testid="my-submission-table">
      <RePlusPage
        ref="tableRef"
        :api="api"
        :auth="auth"
        locale-name="dform"
        :selection="Boolean(auth.batchDestroy)"
        :listColumnsFormat="listColumnsFormat"
        :searchColumnsFormat="searchColumnsFormat"
        :operationButtonsProps="operationButtonsProps"
      />
    </div>
  </div>
</template>
