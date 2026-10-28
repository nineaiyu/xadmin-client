<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useDesignerGuard } from "@/hooks/useDesignerGuard";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";
import { hasAuth } from "@/router/utils";
import { isSuccess } from "@/api/types";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  listReportVersions,
  type ReportDesign,
  type ReportDesignComponent,
  type ReportItem
} from "@/api/dataset/analysis";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";
import type { VersionHistoryRow } from "@/components/VersionHistoryDialog";
import { ChartCardAsync as ChartCard } from "@/views/dashboard/components/ChartCardAsync";
import ReportDesignSidebar from "./components/ReportDesignSidebar.vue";
import ReportTablePreview from "./components/ReportTablePreview.vue";
import ReportComponentForm from "./components/ReportComponentForm.vue";
import {
  REPORT_TABLE_LIMIT,
  designColumns,
  designTableLimit,
  componentToCard
} from "./utils/design";
import { useDesignMutations } from "./utils/useDesignMutations";
import { useReportBootstrap } from "./utils/useReportBootstrap";
import { useReportPersistence } from "./utils/useReportPersistence";
import { createReportVersionActions } from "./utils/reportVersions";

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
 * 只读态（非创建者记录）：编辑面板隐藏、保存/运行禁用（写权威在后端，此处为 UX 守卫）。
 */
const router = useRouter();
const { t } = useI18n();
const canRun = hasAuth("run:DataReport");
const canEditDesign = hasAuth("partialUpdate:DataReport");

const report = ref<ReportItem | null>(null);
const dataset = ref<DatasetItem | null>(null);
/** 数据集不可见/已删除：进入显式空态（报表绑定的数据集对当前用户无可见行） */
const datasetMissing = ref(false);
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

/** 只读态：非创建者记录后端会拒绝一切写入（含「立即运行」），前端进入即置只读，
 *  属 UX 层守卫——写权威始终在后端，详情接口未返回 is_owner 时按可编辑放行 */
const readonly = computed(
  () => !canEditDesign || report.value?.is_owner === false
);

/** 保存/运行禁用态的悬浮说明：数据集不可见优先于只读提示 */
const disabledTitle = computed(() =>
  datasetMissing.value
    ? t("dataReport.datasetUnavailable")
    : readonly.value
      ? t("dataReport.readonlyHint")
      : undefined
);

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

/** 装载时序（进场校验 / 详情与数据集清单 / design 回填，见 utils/useReportBootstrap.ts） */
useReportBootstrap({
  t,
  report,
  dataset,
  datasetMissing,
  design,
  loading
});

const refreshData = () => {
  tableRef.value?.load?.();
  Object.values(cardRefs.value).forEach(handle => handle?.loadData?.());
};

/** 保存 / 立即运行（校验与落库口径见 utils/useReportPersistence.ts，行数门禁抽出） */
const { save, running, runNow } = useReportPersistence({
  t,
  report,
  dataset,
  design,
  saving,
  dirty,
  readonly,
  datasetMissing,
  columns,
  components
});

/* ---------------- 历史版本（保存即记一版，可回滚） ---------------- */
const versionsVisible = ref(false);
const { rollbackTo } = createReportVersionActions({
  t,
  report,
  dataset,
  design,
  saving,
  dirty,
  readonly,
  datasetMissing
});

async function loadVersions(): Promise<VersionHistoryRow[]> {
  if (!report.value) return [];
  const res = await listReportVersions(report.value.pk);
  if (!isSuccess(res)) throw new Error(res.detail ?? "");
  return (res.data ?? []) as VersionHistoryRow[];
}

async function onRollback(version: number) {
  if (await rollbackTo(version)) {
    versionsVisible.value = false;
    refreshData();
  }
}

/* ---------------- 未保存守卫 / 快捷键 ---------------- */
useDesignerGuard({ dirty, namespace: "dataReport" });

// Ctrl/Cmd+S 保存（与大屏设计器共用 composable；页面守卫在 save 内收敛）
useSaveShortcut(() => void save());

const back = () => {
  router.push("/analysis/report/index");
};
</script>

<template>
  <div v-loading="loading" class="designer-root">
    <header class="designer-header">
      <span class="designer-title">
        {{ t("dataReport.designer") }}
        <span class="designer-subtitle">· {{ report?.name }}</span>
      </span>
      <el-tag v-if="dirty" size="small" type="warning" effect="dark">
        {{ t("dataReport.unsaved") }}
      </el-tag>
      <el-tag
        v-if="readonly"
        size="small"
        type="info"
        effect="plain"
        data-testid="designer-readonly"
      >
        {{ t("dataReport.readonlyHint") }}
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
      <el-button
        v-if="!readonly"
        size="small"
        data-testid="designer-versions"
        @click="versionsVisible = true"
      >
        {{ t("dataReport.versionHistory") }}
      </el-button>
      <el-button size="small" @click="back">
        {{ t("dataReport.backToList") }}
      </el-button>
      <el-button
        v-if="canRun"
        type="success"
        size="small"
        :loading="running"
        :disabled="readonly || datasetMissing"
        :title="disabledTitle"
        data-testid="designer-run"
        @click="runNow"
      >
        {{ t("dataReport.run") }}
      </el-button>
      <el-button
        type="primary"
        size="small"
        :loading="saving"
        :disabled="readonly || datasetMissing"
        :title="disabledTitle"
        data-testid="designer-save"
        @click="save"
      >
        {{ t("dataReport.save") }}
      </el-button>
    </header>

    <div class="designer-body">
      <ReportDesignSidebar
        v-if="!preview && !readonly && !datasetMissing"
        :dataset="dataset"
        :columns="columns"
        :table-limit="tableLimit"
        @apply-template="applyTemplate"
        @columns-change="onColumnsChange"
        @limit-change="onLimitChange"
        @add-component="addComponent"
      />

      <main class="designer-canvas" data-testid="designer-canvas">
        <!-- 数据集不可见/已删除：显式空态，组件卡不再以空数据集取数 -->
        <ReEmpty
          v-if="datasetMissing"
          data-testid="designer-dataset-missing"
          :description="t('dataReport.datasetUnavailable')"
          :image-size="72"
        />
        <template v-else>
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
          <ReEmpty
            v-else
            :description="t('dataReport.noComponent')"
            :image-size="72"
          />
        </template>
      </main>

      <aside v-if="!preview && !readonly" class="designer-inspector">
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

    <VersionHistoryDialog
      v-model="versionsVisible"
      :title="t('dataReport.versionHistory')"
      :load="loadVersions"
      @rollback="onRollback"
    />
  </div>
</template>

<style lang="scss" scoped>
.designer-header {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.designer-title {
  font-size: var(--font-size-lg);
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
  padding: var(--space-3);
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
  padding: var(--space-4) var(--space-5) var(--space-8);
  overflow: auto;
  background: var(--el-fill-color-blank);
}

.designer-components {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.designer-component {
  grid-column: span 6;
  padding: var(--space-3);
  background: var(--el-bg-color);
  border: var(--card-border);
  border-radius: var(--radius-lg);

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
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-2);
  font-size: var(--el-font-size-small);
  font-weight: 600;
}

.designer-component__body {
  height: 220px;
}
</style>
