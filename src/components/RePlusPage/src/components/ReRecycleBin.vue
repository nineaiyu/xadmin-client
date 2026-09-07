<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import type { BaseApi } from "@/api/base";
import type { RecycleBinColumn } from "../utils/types";
import { message } from "@/utils/message";
import Delete from "~icons/ep/delete";
import RefreshRight from "~icons/ep/refresh-right";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "RecycleBin" });

type RecycleBinApi = Pick<
  BaseApi,
  "recycleList" | "recycleRestore" | "recyclePurge"
>;

/**
 * FEAT-2：通用回收站抽屉。
 *
 * 消费 BaseApi 的 recycleList/recycleRestore/recyclePurge 三方法（对应后端
 * RecycleBinAction）。通常由 RePlusPage 依据 recycleBin prop 内建渲染并接线
 * 刷新；独立使用时以「barButtons 插槽按钮 + 抽屉列表」接入，数据变动后
 * emit("changed") 由调用方刷新主列表。
 */
const props = withDefaults(
  defineProps<{
    /** BaseApi 实例（需含 recycle 三方法） */
    api: RecycleBinApi;
    /** 业务标识列；label 缺省时按 `${localeName}.${prop}` 自动翻译 */
    columns?: RecycleBinColumn[];
    /** RePlusPage 的国际化域（自动翻译列头用） */
    localeName?: string;
    title?: string;
    /** 入口按钮是否隐藏（调用方按 auth 控制） */
    disabled?: boolean;
  }>(),
  {
    columns: () => [],
    localeName: "",
    title: "",
    disabled: false
  }
);

const emit = defineEmits<{ changed: [] }>();

const { t, te } = useI18n();

const visible = ref(false);
const loading = ref(false);
/** 恢复/清除进行中：防止抽屉按钮连点重复提交 */
const submitting = ref(false);
const rows = ref<Array<Record<string, unknown>>>([]);
const selection = ref<Array<Record<string, unknown>>>([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });

function columnLabel(column: RecycleBinColumn) {
  if (column.label) return column.label;
  const key = `${props.localeName}.${column.prop}`;
  return te(key) ? t(key) : column.prop;
}

const tableColumns = computed(() => [
  ...props.columns.map(column => ({
    prop: column.prop,
    label: columnLabel(column),
    // el-table 的 formatter 签名为 (row, column, cellValue, index)，直接收行
    formatter: column.formatter
      ? (row: Record<string, unknown>) => column.formatter?.(row) ?? ""
      : undefined
  })),
  {
    prop: "deleted_at",
    label: t("recycleBin.deletedAt"),
    formatter: (row: Record<string, unknown>) =>
      row.deleted_at
        ? dayjs(String(row.deleted_at)).format("YYYY-MM-DD HH:mm:ss")
        : ""
  }
]);

async function loadData() {
  loading.value = true;
  try {
    const res = await props.api.recycleList({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    });
    rows.value = res.data.results ?? [];
    pagination.value.total = res.data.total ?? rows.value.length;
    // 删空当前页后回退页码，避免停留在空页（page 变化经 watch 自动重载）
    if (!rows.value.length && pagination.value.page > 1) {
      pagination.value.page -= 1;
    }
  } finally {
    loading.value = false;
  }
}

function open() {
  visible.value = true;
  pagination.value.page = 1;
  loadData();
}

function onChanged() {
  emit("changed");
  loadData();
}

async function handleRestore(pks: Array<string>) {
  submitting.value = true;
  try {
    const res = await props.api.recycleRestore(pks);
    message(res.detail ?? t("recycleBin.restoreDone"), { type: "success" });
    onChanged();
  } finally {
    submitting.value = false;
  }
}

async function handlePurge(pks?: Array<string>) {
  submitting.value = true;
  try {
    const res = await props.api.recyclePurge(pks);
    message(res.detail ?? t("recycleBin.purgeDone"), { type: "success" });
    onChanged();
  } finally {
    submitting.value = false;
  }
}

const selectedPks = computed(() => selection.value.map(row => String(row.pk)));

watch(
  () => pagination.value.page,
  () => loadData()
);

defineExpose({ open });
</script>

<template>
  <el-button v-if="!disabled" :icon="useRenderIcon(Delete)" plain @click="open">
    {{ title || t("recycleBin.title") }}
  </el-button>

  <el-drawer
    v-model="visible"
    :title="title || t('recycleBin.title')"
    size="60%"
    destroy-on-close
    class="recycle-bin-drawer"
  >
    <div class="mb-3 flex flex-wrap gap-2">
      <el-popconfirm
        :title="t('recycleBin.restoreConfirm', { count: selectedPks.length })"
        :disabled="selectedPks.length === 0"
        @confirm="handleRestore(selectedPks)"
      >
        <template #reference>
          <el-button
            type="primary"
            plain
            :disabled="selectedPks.length === 0 || submitting"
            :loading="submitting"
            :icon="useRenderIcon(RefreshRight)"
          >
            {{ t("recycleBin.restore") }}
          </el-button>
        </template>
      </el-popconfirm>
      <el-popconfirm
        :title="t('recycleBin.purgeConfirm', { count: selectedPks.length })"
        :disabled="selectedPks.length === 0"
        @confirm="handlePurge(selectedPks)"
      >
        <template #reference>
          <el-button
            type="danger"
            plain
            :disabled="selectedPks.length === 0 || submitting"
            :icon="useRenderIcon(Delete)"
          >
            {{ t("recycleBin.purge") }}
          </el-button>
        </template>
      </el-popconfirm>
      <el-popconfirm
        :title="t('recycleBin.purgeExpiredConfirm')"
        @confirm="handlePurge()"
      >
        <template #reference>
          <el-button type="warning" plain :disabled="submitting">
            {{ t("recycleBin.purgeExpired") }}
          </el-button>
        </template>
      </el-popconfirm>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      row-key="pk"
      border
      @selection-change="val => (selection = val)"
    >
      <el-table-column type="selection" width="42" />
      <el-table-column
        v-for="column in tableColumns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :formatter="column.formatter"
        show-overflow-tooltip
      />
      <el-table-column
        :label="t('recycleBin.actions')"
        width="90"
        fixed="right"
      >
        <template #default="{ row }">
          <el-popconfirm
            :title="t('recycleBin.restoreOneConfirm')"
            @confirm="handleRestore([String(row.pk)])"
          >
            <template #reference>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="submitting"
              >
                {{ t("recycleBin.restore") }}
              </el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="t('recycleBin.empty')" :image-size="80" />
      </template>
    </el-table>

    <el-pagination
      v-model:current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      layout="total, prev, pager, next"
      class="mt-3 justify-end"
      small
    />
  </el-drawer>
</template>
