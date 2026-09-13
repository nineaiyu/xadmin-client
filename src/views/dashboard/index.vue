<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import Sortable from "sortablejs";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Setting } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  dashboardApi,
  datasetApi,
  listRows,
  type DashboardCard,
  type DashboardItem,
  type DatasetItem
} from "@/api/system/datasets";
import ChartCard from "./components/ChartCard.vue";

defineOptions({
  name: "DataDashboard"
});

const { t } = useI18n();
const router = useRouter();
const canEdit = hasAuth("partialUpdate:DataDashboard");
const canCreate = hasAuth("create:DataDashboard");

const dashboards = ref<DashboardItem[]>([]);
const current = ref<DashboardItem | null>(null);
const loading = ref(false);
const editing = ref(false);

const layout = computed<DashboardCard[]>(() =>
  editing.value ? draftLayout.value : (current.value?.layout ?? [])
);

/** 编辑态草稿：拖拽排序/增删卡片落在草稿上，保存才提交后端 */
const draftLayout = ref<DashboardCard[]>([]);
const layoutKey = computed(() =>
  draftLayout.value.map(card => card.id).join("|")
);

let sortable: Sortable | null = null;
const rowRef = ref();

const loadDashboards = async () => {
  loading.value = true;
  try {
    const res = await dashboardApi.list();
    dashboards.value = listRows<DashboardItem>(res as never);
    if (!current.value && dashboards.value.length > 0) {
      current.value = dashboards.value[0];
    }
  } finally {
    loading.value = false;
  }
};

const datasets = ref<DatasetItem[]>([]);
const loadDatasets = async () => {
  const res = await datasetApi.list({ page_size: 100 });
  datasets.value = listRows<DatasetItem>(res as never);
};

const selectDashboard = (pk: string) => {
  current.value = dashboards.value.find(item => item.pk === pk) ?? null;
  editing.value = false;
};

const toggleEdit = () => {
  if (!current.value) return;
  if (!editing.value) {
    draftLayout.value = JSON.parse(JSON.stringify(current.value.layout ?? []));
    editing.value = true;
    setupSortable();
  } else {
    editing.value = false;
    destroySortable();
  }
};

const destroySortable = () => {
  sortable?.destroy();
  sortable = null;
};

const setupSortable = () => {
  destroySortable();
  if (!rowRef.value?.$el) return;
  sortable = Sortable.create(rowRef.value.$el, {
    animation: 200,
    handle: ".drag-handle",
    onEnd: ({ oldIndex, newIndex }) => {
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      )
        return;
      const next = [...draftLayout.value];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      draftLayout.value = next;
    }
  });
};

const saveLayout = async () => {
  if (!current.value) return;
  const res = await dashboardApi.partialUpdate(current.value.pk, {
    layout: draftLayout.value
  });
  if (res.code === 1000) {
    message(t("dashboard.saveOk"), { type: "success" });
    const index = dashboards.value.findIndex(
      item => item.pk === current.value?.pk
    );
    if (index >= 0 && (res.data as unknown as DashboardItem)) {
      dashboards.value[index] = res.data as unknown as DashboardItem;
      current.value = dashboards.value[index];
    }
    editing.value = false;
    destroySortable();
  }
};

const removeCard = (id: string) => {
  draftLayout.value = draftLayout.value.filter(card => card.id !== id);
};

const datasetName = (pk: string) =>
  datasets.value.find(item => item.pk === pk)?.name ?? pk;

const spanOptions = [3, 6, 9, 12];
/** 卡片高度档位（px）：标准 224 与存量 h-56 渲染一致，向后兼容 */
const heightOptions = [160, 224, 320, 440];

// ---- 卡片弹窗（新建 / 编辑双模式） ----
const cardDialog = ref(false);
const editingCardId = ref<string | null>(null);
const cardForm = ref<DashboardCard>(newCard());
const datasetColumns = ref<string[]>([]);

function newCard(): DashboardCard {
  return {
    id: `card-${Date.now()}`,
    dataset: "",
    title: "",
    chart_type: "number",
    metric: "count",
    span: 6,
    height: 224
  };
}

const openCardDialog = () => {
  editingCardId.value = null;
  cardForm.value = newCard();
  datasetColumns.value = [];
  cardDialog.value = true;
};

/** 编辑既有卡片：回填表单，确认后原位更新 */
const openCardSettings = (card: DashboardCard) => {
  editingCardId.value = card.id;
  cardForm.value = { ...card, height: card.height ?? 224 };
  datasetColumns.value =
    datasets.value.find(item => item.pk === card.dataset)?.columns ?? [];
  cardDialog.value = true;
};

const onDatasetPicked = async (pk: string) => {
  const dataset = datasets.value.find(item => item.pk === pk);
  datasetColumns.value = dataset?.columns ?? [];
  cardForm.value.group_by = datasetColumns.value[0];
  if (!cardForm.value.title) {
    cardForm.value.title = dataset?.name ?? "";
  }
};

const addCard = async () => {
  const card = cardForm.value;
  if (!card.dataset || !card.title) {
    message(t("dashboard.cardRequired"), { type: "warning" });
    return;
  }
  if (card.chart_type !== "number" && !card.group_by) {
    message(t("dashboard.cardRequired"), { type: "warning" });
    return;
  }
  if (editingCardId.value) {
    draftLayout.value = draftLayout.value.map(item =>
      item.id === editingCardId.value ? { ...card, id: item.id } : item
    );
  } else {
    draftLayout.value = [...draftLayout.value, { ...card }];
  }
  cardDialog.value = false;
};

// ---- 新建仪表盘弹窗 ----
const dashDialog = ref(false);
const dashForm = ref({
  name: "",
  visibility: "personal" as "personal" | "shared"
});

const createDashboard = async () => {
  if (!dashForm.value.name) return;
  const res = await dashboardApi.create({
    name: dashForm.value.name,
    visibility: dashForm.value.visibility,
    layout: []
  });
  if (res.code === 1000) {
    message(t("dashboard.saveOk"), { type: "success" });
    dashDialog.value = false;
    current.value = null;
    await loadDashboards();
    current.value =
      dashboards.value.find(
        item => item.pk === (res.data as never as DashboardItem)?.pk
      ) ?? null;
  }
};

const removeDashboard = async () => {
  if (!current.value) return;
  try {
    await ElMessageBox.confirm(
      t("dashboard.removeConfirm", { name: current.value.name }),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning",
        confirmButtonClass: "el-button--danger",
        draggable: true
      }
    );
  } catch {
    return;
  }
  const res = await dashboardApi.destroy(current.value.pk);
  if (res.code === 1000) {
    current.value = null;
    await loadDashboards();
  }
};

const goDatasetPage = () => {
  router.push("/analysis/dataset/index");
};

onMounted(async () => {
  await Promise.all([loadDashboards(), loadDatasets()]);
});
</script>

<template>
  <div v-loading="loading" class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">{{ t("dashboard.title") }}</span>
        <el-select
          v-model="current"
          :placeholder="t('dashboard.pickDashboard')"
          value-key="pk"
          class="w-56!"
          @change="(item: DashboardItem) => selectDashboard(item?.pk)"
        >
          <el-option
            v-for="item in dashboards"
            :key="item.pk"
            :value="item"
            :label="item.name"
          />
        </el-select>
        <el-button
          v-if="canCreate"
          data-testid="dashboard-create"
          @click="dashDialog = true"
        >
          {{ t("dashboard.create") }}
        </el-button>
        <el-button
          v-if="canEdit && current"
          :type="editing ? 'warning' : 'primary'"
          @click="toggleEdit"
        >
          {{ editing ? t("dashboard.cancelEdit") : t("dashboard.edit") }}
        </el-button>
        <el-button v-if="editing" type="success" @click="saveLayout">
          {{ t("dashboard.saveLayout") }}
        </el-button>
        <el-button v-if="editing" type="danger" plain @click="removeDashboard">
          {{ t("dashboard.remove") }}
        </el-button>
        <div class="flex-1" />
        <el-button link type="primary" @click="goDatasetPage">
          {{ t("dashboard.manageDatasets") }}
        </el-button>
      </div>
    </el-card>

    <el-empty v-if="!current" :description="t('dashboard.empty')" />
    <template v-else>
      <el-row ref="rowRef" :gutter="12" data-testid="dashboard-cards">
        <el-col
          v-for="card in layout"
          :key="card.id"
          :span="card.span ?? 6"
          class="mb-3"
        >
          <el-card
            shadow="hover"
            class="flex flex-col overflow-hidden"
            :style="{ height: `${card.height ?? 224}px` }"
            :body-style="{ flex: '1 1 0%', minHeight: '0' }"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <el-icon v-if="editing" class="drag-handle cursor-move">
                  <span>⋮⋮</span>
                </el-icon>
                <span class="truncate font-medium">{{ card.title }}</span>
                <el-tag size="small" type="info" class="ml-1">
                  {{ datasetName(card.dataset) }}
                </el-tag>
                <div class="flex-1" />
                <el-button
                  v-if="editing"
                  link
                  type="primary"
                  :icon="Setting"
                  :title="t('dashboard.cardSettings')"
                  @click="openCardSettings(card)"
                />
                <el-button
                  v-if="editing"
                  link
                  type="danger"
                  @click="removeCard(card.id)"
                >
                  {{ t("dashboard.remove") }}
                </el-button>
              </div>
            </template>
            <ChartCard :key="layoutKey + card.id" :card="card" />
          </el-card>
        </el-col>
      </el-row>
      <el-button v-if="editing" class="w-40!" @click="openCardDialog">
        {{ t("dashboard.addCard") }}
      </el-button>
    </template>

    <!-- 新建卡片 -->
    <el-dialog
      v-model="cardDialog"
      :title="editingCardId ? t('dashboard.editCard') : t('dashboard.addCard')"
      width="480px"
    >
      <el-form label-width="110px">
        <el-form-item :label="t('dashboard.dataset')">
          <el-select
            v-model="cardForm.dataset"
            class="w-full"
            filterable
            @change="onDatasetPicked"
          >
            <el-option
              v-for="item in datasets"
              :key="item.pk"
              :value="item.pk"
              :label="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dashboard.cardTitle')">
          <el-input v-model="cardForm.title" />
        </el-form-item>
        <el-form-item :label="t('dashboard.chartType')">
          <el-select v-model="cardForm.chart_type" class="w-full">
            <el-option value="number" :label="t('dashboard.chartNumber')" />
            <el-option value="line" :label="t('dashboard.chartLine')" />
            <el-option value="bar" :label="t('dashboard.chartBar')" />
            <el-option value="pie" :label="t('dashboard.chartPie')" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="cardForm.chart_type !== 'number'"
          :label="t('dashboard.groupBy')"
        >
          <el-select v-model="cardForm.group_by" class="w-full" filterable>
            <el-option
              v-for="field in datasetColumns"
              :key="field"
              :value="field"
              :label="field"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="cardForm.chart_type === 'line'"
          :label="t('dashboard.dateTrunc')"
        >
          <el-select v-model="cardForm.date_trunc" class="w-full">
            <el-option value="day" :label="t('dashboard.byDay')" />
            <el-option value="month" :label="t('dashboard.byMonth')" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="cardForm.chart_type === 'bar' || cardForm.chart_type === 'pie'"
          :label="t('dashboard.metric')"
        >
          <el-select v-model="cardForm.metric" class="w-full">
            <el-option value="count" :label="t('dashboard.metricCount')" />
            <el-option value="sum" :label="t('dashboard.metricSum')" />
            <el-option value="avg" :label="t('dashboard.metricAvg')" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dashboard.cardSpan')">
          <el-select v-model="cardForm.span" class="w-full">
            <el-option
              v-for="span in spanOptions"
              :key="span"
              :value="span"
              :label="`${span}/12`"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dashboard.cardHeight')">
          <el-select v-model="cardForm.height" class="w-full">
            <el-option
              v-for="h in heightOptions"
              :key="h"
              :value="h"
              :label="`${h}px`"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cardDialog = false">{{
          t("dashboard.cancel")
        }}</el-button>
        <el-button type="primary" @click="addCard">
          {{ t("dashboard.confirm") }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 新建仪表盘 -->
    <el-dialog
      v-model="dashDialog"
      :title="t('dashboard.create')"
      width="420px"
    >
      <el-form label-width="90px">
        <el-form-item :label="t('dashboard.dashName')">
          <el-input v-model="dashForm.name" />
        </el-form-item>
        <el-form-item :label="t('dashboard.visibility')">
          <el-radio-group v-model="dashForm.visibility">
            <el-radio value="personal">{{ t("dashboard.personal") }}</el-radio>
            <el-radio value="shared">{{ t("dashboard.shared") }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dashDialog = false">{{
          t("dashboard.cancel")
        }}</el-button>
        <el-button type="primary" @click="createDashboard">
          {{ t("dashboard.confirm") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
