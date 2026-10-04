<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { datasetApi, listRows, type DatasetItem } from "@/api/dataset/datasets";
import {
  relatedPk,
  reportApi,
  runReport,
  type ReportDesign,
  type ReportDesignComponent,
  type ReportItem
} from "@/api/dataset/analysis";
import ChartCard from "@/views/dashboard/components/ChartCard.vue";
import ReportDesignSidebar from "./components/ReportDesignSidebar.vue";
import ReportTablePreview from "./components/ReportTablePreview.vue";
import ReportComponentForm from "./components/ReportComponentForm.vue";
import {
  REPORT_TABLE_LIMIT,
  designColumns,
  designTableLimit,
  normalizeDesign,
  componentToCard
} from "./utils/design";
import { useDesignMutations } from "./utils/useDesignMutations";

defineOptions({ name: "DataReportDesigner" });

/**
 * 报表设计器：数据集列 → 明细表 + 聚合组件 + 模板。
 *
 * - 左侧：模板预设（明细表 / 分组统计 / 趋势看板 / 指标汇总）+ 明细列勾选
 *   （含全选 / 清空）+ 行数上限 + 组件库；
 * - 中间：明细表实时预览（复用数据集执行接口，按字段权限裁剪）+ 组件网格；
 * - 右侧：选中组件的属性（标题 / 宽度 / 排序 / 复制 / 分组 / 指标 / 数值字段 /
 *   时间粒度 / 删除）。
 *
 * 图表组件复用一期 `ChartCard`（组件与看板卡片字段同源），故不重复实现渲染与取数。
 * 保存走 `partialUpdate({design})`，本地先 `normalizeDesign` 收敛，服务端再校验一次；
 * 空 design = 存量口径（全列明细单表），编辑器清空组件与列即回到该口径。
 * 「立即运行」按**已保存**的设计投递执行，有未保存改动时先提示保存。
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const canRun = hasAuth("run:DataReport");

const report = ref<ReportItem | null>(null);
const dataset = ref<DatasetItem | null>(null);
const design = ref<ReportDesign>({
  columns: [],
  table_limit: REPORT_TABLE_LIMIT.default,
  components: []
});
const selectedId = ref("");
const preview = ref(false);
const saving = ref(false);
const dirty = ref(false);
const loading = ref(true);

const tableRef = ref<InstanceType<typeof ReportTablePreview>>();
const cardRefs = ref<Record<string, { loadData?: () => void } | null>>({});
const setCardRef = (id: string) => (el: unknown) => {
  cardRefs.value[id] = el as { loadData?: () => void } | null;
};

const components = computed(() => design.value.components ?? []);
const selected = computed(() =>
  components.value.find(item => item.id === selectedId.value)
);
/** 明细列：空 = 全部列（勾选态按解析后的列展示） */
const columns = computed(() => designColumns(design.value, dataset.value));
const tableLimit = computed(() => designTableLimit(design.value));

/* 设计变更（模板 / 明细列 / 行数上限 / 组件增删改排复）：独立 composable（控制页面体积） */
const {
  applyTemplate,
  onColumnsChange,
  onLimitChange,
  addComponent,
  updateComponent,
  removeComponent,
  moveComponentBy,
  duplicateComponentById
} = useDesignMutations({
  design,
  selectedId,
  dataset,
  markDirty: () => {
    dirty.value = true;
  },
  t
});

const componentTitle = (component: ReportDesignComponent) =>
  component.title ||
  t(
    `dataReport.component${component.type[0].toUpperCase()}${component.type.slice(1)}`
  );

const componentCard = (component: ReportDesignComponent) =>
  componentToCard(
    component,
    dataset.value?.pk ?? "",
    componentTitle(component)
  );

onMounted(async () => {
  const pk = String(route.query.pk ?? "");
  if (!pk) {
    message(t("dataReport.pickReportFirst"), { type: "warning" });
    router.replace("/analysis/report/index");
    return;
  }
  const res = await reportApi.retrieve(pk);
  if (res.code !== SUCCESS_CODE || !res.data) {
    message(t("dataReport.loadFailed"), { type: "warning" });
    router.replace("/analysis/report/index");
    return;
  }
  report.value = res.data as ReportItem;
  const datasetPk = relatedPk(report.value.dataset);
  dataset.value =
    listRows<DatasetItem>((await fetchAllRows(datasetApi.list)) as never).find(
      item => item.pk === datasetPk
    ) ?? null;
  design.value = {
    columns: [...(report.value.design?.columns ?? [])],
    table_limit: designTableLimit(report.value.design),
    components: (report.value.design?.components ?? []).map(item => ({
      ...item
    }))
  };
  loading.value = false;
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("beforeunload", onBeforeUnload);
});

const refreshData = () => {
  tableRef.value?.load?.();
  Object.values(cardRefs.value).forEach(handle => handle?.loadData?.());
};

/* ---------------- 保存 / 返回 ---------------- */
async function save() {
  if (!report.value || saving.value) return;
  if (columns.value.length === 0) {
    message(t("dataReport.columnsRequired"), { type: "warning" });
    return;
  }
  const missingGroup = components.value.find(
    item => item.type !== "number" && !item.group_by
  );
  if (missingGroup) {
    message(t("dataReport.groupByRequired"), { type: "warning" });
    return;
  }
  saving.value = true;
  try {
    const payload = normalizeDesign(design.value, dataset.value);
    const res = await reportApi
      .partialUpdate(report.value.pk, { design: payload })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) {
      design.value = payload;
      dirty.value = false;
      message(t("dataReport.designSaved"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  } finally {
    saving.value = false;
  }
}

/** 立即运行：按已保存的设计投递执行（未保存改动先提示，避免产出与所见不一致） */
const running = ref(false);
async function runNow() {
  if (!report.value || running.value) return;
  if (dirty.value) {
    message(t("dataReport.runDirty"), { type: "warning" });
    return;
  }
  running.value = true;
  try {
    const res = await runReport(report.value.pk).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
    if (res.code === SUCCESS_CODE) {
      message(t("dataReport.runOk"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  } finally {
    running.value = false;
  }
}

/* ---------------- 未保存守卫 / 快捷键 ---------------- */
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
};

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm(
      t("dataReport.leaveConfirm"),
      t("dataReport.unsaved"),
      {
        type: "warning",
        confirmButtonText: t("dataReport.leave"),
        cancelButtonText: t("dataReport.stay")
      }
    );
    return true;
  } catch {
    return false;
  }
});

function onKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.key.toLowerCase() !== "s") return;
  event.preventDefault();
  void save();
}

const back = () => {
  router.push("/analysis/report/index");
};
</script>

<template>
  <div class="designer-root">
    <header class="designer-header">
      <span class="designer-title">
        {{ t("dataReport.designer") }}
        <span class="designer-subtitle">· {{ report?.name }}</span>
      </span>
      <el-tag v-if="dirty" size="small" type="warning" effect="dark">
        {{ t("dataReport.unsaved") }}
      </el-tag>
      <div class="flex-1" />
      <el-button
        size="small"
        data-testid="designer-refresh"
        @click="refreshData"
      >
        {{ t("dataReport.refreshData") }}
      </el-button>
      <el-button
        size="small"
        data-testid="designer-preview"
        @click="preview = !preview"
      >
        {{ preview ? t("dataReport.editMode") : t("dataReport.preview") }}
      </el-button>
      <el-button size="small" @click="back">
        {{ t("dataReport.backToList") }}
      </el-button>
      <el-button
        v-if="canRun"
        type="success"
        size="small"
        :loading="running"
        data-testid="designer-run"
        @click="runNow"
      >
        {{ t("dataReport.run") }}
      </el-button>
      <el-button
        type="primary"
        size="small"
        :loading="saving"
        data-testid="designer-save"
        @click="save"
      >
        {{ t("dataReport.save") }}
      </el-button>
    </header>

    <div class="designer-body">
      <ReportDesignSidebar
        v-if="!preview"
        :dataset="dataset"
        :columns="columns"
        :table-limit="tableLimit"
        @apply-template="applyTemplate"
        @columns-change="onColumnsChange"
        @limit-change="onLimitChange"
        @add-component="addComponent"
      />

      <main class="designer-canvas" data-testid="designer-canvas">
        <ReportTablePreview
          ref="tableRef"
          :dataset-pk="dataset?.pk ?? ''"
          :columns="columns"
          :limit="tableLimit"
        />

        <div v-if="components.length" class="designer-components">
          <section
            v-for="component in components"
            :key="component.id"
            class="designer-component"
            :class="{
              'is-wide': (component.span ?? 12) === 12,
              'is-selected': component.id === selectedId
            }"
            :data-component-id="component.id"
            :data-component-type="component.type"
            @click="!preview && (selectedId = component.id)"
          >
            <div class="designer-component__title">
              {{ componentTitle(component) }}
              <el-tag v-if="preview === false" size="small" effect="plain">
                {{ component.group_by || t("dataReport.metricOnly") }}
              </el-tag>
            </div>
            <div class="designer-component__body">
              <ChartCard
                :ref="setCardRef(component.id)"
                :card="componentCard(component)"
              />
            </div>
          </section>
        </div>
        <el-empty
          v-else
          :description="t('dataReport.noComponent')"
          :image-size="72"
        />
      </main>

      <aside v-if="!preview" class="designer-inspector">
        <ReportComponentForm
          v-if="selected"
          :component="selected"
          :dataset="dataset"
          :first="components[0]?.id === selected.id"
          :last="components[components.length - 1]?.id === selected.id"
          @update="updateComponent"
          @remove="removeComponent"
          @move-up="moveComponentBy(selected.id, -1)"
          @move-down="moveComponentBy(selected.id, 1)"
          @duplicate="duplicateComponentById(selected.id)"
        />
        <span v-else class="designer-inspector__hint">
          {{ t("dataReport.noComponentSelection") }}
        </span>
      </aside>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.designer-header {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.designer-title {
  font-size: 18px;
  font-weight: 600;
}

.designer-subtitle {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.designer-body {
  display: flex;
  align-items: stretch;
  min-height: calc(100vh - 120px);
}

.designer-inspector {
  flex: none;
  width: 280px;
  padding: 14px 12px;
  overflow: auto;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color-lighter);
}

.designer-inspector__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.designer-canvas {
  flex: 1;
  min-width: 0;
  padding: 16px 20px 32px;
  overflow: auto;
  background: var(--el-fill-color-blank);
}

.designer-components {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.designer-component {
  grid-column: span 6;
  padding: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;

  &.is-wide {
    grid-column: span 12;
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }
}

.designer-component__title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: var(--el-font-size-small);
  font-weight: 600;
}

.designer-component__body {
  height: 220px;
}
</style>
