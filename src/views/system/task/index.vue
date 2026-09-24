<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { formatDateTime } from "@/utils";
import { statusTagProps } from "@/utils/dict";
import { useTaskCenter } from "./utils/hook";
import {
  asRow,
  progressOf,
  progressStatus,
  sourceOf,
  timeCostText,
  STATUS_OPTIONS,
  STATUS_TAG_TYPE,
  TYPE_OPTIONS,
  TYPE_TAG_TYPE
} from "./utils/columns";

/**
 * 任务中心：三类记录（执行历史 / 导出 / 导入）统一列表 + 取消 / 重跑 / 日志 / 下载 / 清理。
 *
 * 接口只读聚合，不建新表；数据域与下载中心一致（超管全量，其余仅本人记录）。
 * 取消为协作式语义（PENDING 立即终态，RUNNING 在安全点收敛），文案需如实说明。
 */
defineOptions({
  name: "SystemTaskCenter" // 必须定义，用于菜单自动匹配组件
});

const { t } = useI18n();
const {
  loading,
  rows,
  total,
  page,
  size,
  filters,
  canCancel,
  canRerun,
  canDelete,
  canBatchDelete,
  selectedCount,
  selectedDeletableCount,
  load,
  onSearch,
  onReset,
  onSelectionChange,
  cancel,
  rerun,
  openLog,
  remove,
  batchRemove,
  downloadUrl
} = useTaskCenter();
</script>

<template>
  <div class="main">
    <el-card shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-3">
        <el-select
          v-model="filters.type"
          clearable
          :placeholder="t('taskCenter.type')"
          style="width: 140px"
          data-testid="task-center-type"
        >
          <el-option
            v-for="item in TYPE_OPTIONS"
            :key="item.value"
            :label="t(item.labelKey)"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="filters.status"
          clearable
          :placeholder="t('taskCenter.status')"
          style="width: 140px"
          data-testid="task-center-status"
        >
          <el-option
            v-for="item in STATUS_OPTIONS"
            :key="item.value"
            :label="t(item.labelKey)"
            :value="item.value"
          />
        </el-select>
        <el-input
          v-model="filters.keyword"
          clearable
          :placeholder="t('taskCenter.keyword')"
          style="width: 190px"
          data-testid="task-center-keyword"
          @keyup.enter="onSearch"
        />
        <el-input
          v-model="filters.creator"
          clearable
          :placeholder="t('taskCenter.colCreator')"
          style="width: 130px"
          data-testid="task-center-creator"
          @keyup.enter="onSearch"
        />
        <el-date-picker
          v-model="filters.range"
          type="datetimerange"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :start-placeholder="t('taskCenter.colCreated')"
          :end-placeholder="t('taskCenter.colCreated')"
          style="width: 330px"
          data-testid="task-center-range"
        />
        <el-button type="primary" @click="onSearch">
          {{ t("buttons.search") }}
        </el-button>
        <el-button @click="onReset">{{ t("buttons.reset") }}</el-button>
        <!-- 清理入口：只针对执行历史；选中的导出/导入记录自动跳过 -->
        <el-popconfirm
          v-if="canBatchDelete"
          :title="
            t('taskCenter.batchDeleteConfirm', {
              count: selectedDeletableCount
            })
          "
          @confirm="batchRemove"
        >
          <template #reference>
            <el-button
              type="danger"
              plain
              :disabled="!selectedDeletableCount"
              data-testid="task-center-batch-delete"
            >
              {{ t("taskCenter.batchDelete") }}
            </el-button>
          </template>
        </el-popconfirm>
        <span v-if="selectedCount" class="text-sm opacity-70">
          {{ t("taskCenter.selected", { count: selectedCount }) }}
        </span>
        <span class="text-sm opacity-70">
          {{ t("taskCenter.total", { total }) }}
        </span>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="rows"
        row-key="pk"
        data-testid="task-center-table"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column :label="t('taskCenter.colType')" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="TYPE_TAG_TYPE[asRow(row).type]">
              {{ t(`taskCenter.type_${asRow(row).type}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="name"
          :label="t('taskCenter.colName')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('taskCenter.colModule')"
          width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ sourceOf(asRow(row)) || "-" }}
          </template>
        </el-table-column>
        <el-table-column :label="t('taskCenter.colStatus')" width="110">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="statusTagProps(row.status, STATUS_TAG_TYPE).type"
            >
              {{ t(`taskCenter.status_${row.status}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('taskCenter.colProgress')" width="180">
          <template #default="{ row }">
            <el-progress
              v-if="progressOf(asRow(row)) !== null"
              :percentage="progressOf(asRow(row)) as number"
              :status="progressStatus(asRow(row))"
            />
            <span v-else>-</span>
            <!-- 统一进度助手：阶段描述（运行中显示，如「统计行数 / 渲染内容」） -->
            <div
              v-if="asRow(row).stage"
              class="text-xs text-(--el-text-color-secondary)"
            >
              {{ asRow(row).stage }}
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('taskCenter.colTimeCost')" width="100">
          <template #default="{ row }">
            {{ timeCostText(asRow(row)) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="creator"
          :label="t('taskCenter.colCreator')"
          width="110"
        />
        <el-table-column
          prop="created_time"
          :label="t('taskCenter.colCreated')"
          width="170"
          show-overflow-tooltip
        >
          <!-- 后端直出 ISO 原文，需按统一口径转本地可读时间 -->
          <template #default="{ row }">
            {{ formatDateTime(row.created_time) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="error"
          :label="t('taskCenter.colError')"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('taskCenter.colActions')"
          width="260"
          fixed="right"
        >
          <template #default="{ row }">
            <el-popconfirm
              v-if="canCancel && row.can_cancel"
              :title="t('taskCenter.cancelConfirm')"
              @confirm="cancel(asRow(row))"
            >
              <template #reference>
                <el-button type="warning" link>
                  {{ t("taskCenter.cancel") }}
                </el-button>
              </template>
            </el-popconfirm>
            <el-button
              v-if="canRerun && row.can_rerun"
              type="primary"
              link
              @click="rerun(asRow(row))"
            >
              {{ t("taskCenter.rerun") }}
            </el-button>
            <el-button type="info" link @click="openLog(asRow(row))">
              {{ t("taskCenter.log") }}
            </el-button>
            <el-link
              v-if="row.has_file"
              type="primary"
              :href="downloadUrl(asRow(row))"
              target="_blank"
              class="mx-2 align-middle"
            >
              {{ t("taskCenter.download") }}
            </el-link>
            <el-popconfirm
              v-if="canDelete && row.can_delete"
              :title="t('taskCenter.deleteConfirm')"
              @confirm="remove(asRow(row))"
            >
              <template #reference>
                <el-button type="danger" link>
                  {{ t("buttons.delete") }}
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        class="mt-3 justify-end"
        layout="total, sizes, prev, pager, next"
        :total="total"
        :page-sizes="[15, 30, 50]"
        @current-change="load"
        @size-change="onSearch"
      />
    </el-card>
  </div>
</template>
