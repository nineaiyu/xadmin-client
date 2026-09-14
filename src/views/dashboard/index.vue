<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { computed, h, onMounted, ref } from "vue";
import Sortable from "sortablejs";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Setting } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
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
import CardForm from "./components/CardForm.vue";
import ChartCard from "./components/ChartCard.vue";
import DashboardCreateForm from "./components/DashboardCreateForm.vue";

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
  const res = await fetchAllRows(datasetApi.list);
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
  if (res.code === SUCCESS_CODE) {
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

// ---- 卡片弹窗（新建 / 编辑双模式；草稿保存在内存 draftLayout，随「保存布局」统一提交） ----
const cardFormRef = ref<InstanceType<typeof CardForm>>();

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

const openCardDialog = () => openCardSettings(null);

/** 编辑既有卡片（null = 新建）：确认后原位更新内存草稿 */
const openCardSettings = (card: DashboardCard | null) => {
  const editingId = card?.id ?? null;
  cardFormRef.value = undefined;
  addDialog({
    title: editingId ? t("dashboard.editCard") : t("dashboard.addCard"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(CardForm, {
        ref: cardFormRef,
        card: card ?? newCard(),
        datasets: datasets.value
      }),
    beforeSure: (done, { closeLoading }) => {
      const updated = cardFormRef.value?.getCard();
      if (!updated) {
        closeLoading();
        return;
      }
      if (editingId) {
        draftLayout.value = draftLayout.value.map(item =>
          item.id === editingId ? { ...updated, id: item.id } : item
        );
      } else {
        draftLayout.value = [...draftLayout.value, { ...updated }];
      }
      done();
    }
  });
};

// ---- 新建仪表盘弹窗 ----
const dashFormRef = ref<InstanceType<typeof DashboardCreateForm>>();

const openCreateDashboard = () => {
  dashFormRef.value = undefined;
  addDialog({
    title: t("dashboard.create"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(DashboardCreateForm, { ref: dashFormRef }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = dashFormRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = await dashboardApi.create({ ...payload, layout: [] });
      if (res.code === SUCCESS_CODE) {
        message(t("dashboard.saveOk"), { type: "success" });
        current.value = null;
        await loadDashboards();
        current.value =
          dashboards.value.find(
            item => item.pk === (res.data as never as DashboardItem)?.pk
          ) ?? null;
        done();
        return;
      }
      closeLoading();
    }
  });
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
  if (res.code === SUCCESS_CODE) {
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
          @click="openCreateDashboard"
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
  </div>
</template>
