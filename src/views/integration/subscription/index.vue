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
  listWebhookRows,
  webhookSubscriptionApi,
  type WebhookEvent,
  type WebhookSubscriptionItem
} from "@/api/system/webhook";
import SubscriptionForm from "./components/SubscriptionForm.vue";

defineOptions({
  name: "WebhookSubscription"
});

const { t } = useI18n();
const canCreate = hasAuth("create:WebhookSubscription");
const canEdit = hasAuth("partialUpdate:WebhookSubscription");
const canDestroy = hasAuth("destroy:WebhookSubscription");
const canTest = hasAuth("test:WebhookSubscription");

const loading = ref(false);
const rows = ref<WebhookSubscriptionItem[]>([]);
const events = ref<WebhookEvent[]>([]);

const loadAll = async () => {
  loading.value = true;
  try {
    const [listRes, eventsRes] = await Promise.all([
      fetchAllRows(webhookSubscriptionApi.list),
      webhookSubscriptionApi.events()
    ]);
    rows.value = listWebhookRows<WebhookSubscriptionItem>(listRes);
    if (eventsRes.code === SUCCESS_CODE) {
      events.value = (eventsRes.data as never as WebhookEvent[]) ?? [];
    }
  } finally {
    loading.value = false;
  }
};

const eventLabel = (key: string) =>
  events.value.find(item => item.key === key)?.label ?? key;

/** 新建 / 编辑弹窗（C5：统一走 ReDialog，表单在 SubscriptionForm 中） */
const formRef = ref<InstanceType<typeof SubscriptionForm>>();

const openDialog = (row: WebhookSubscriptionItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("webhook.edit") : t("webhook.create"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(SubscriptionForm, { ref: formRef, row, events: events.value }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = row
        ? await webhookSubscriptionApi.partialUpdate(row.pk, payload)
        : await webhookSubscriptionApi.create(payload);
      if (res.code === SUCCESS_CODE) {
        message(t("webhook.saveOk"), { type: "success" });
        await loadAll();
        done();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openCreate = () => openDialog(null);
const openEdit = (row: WebhookSubscriptionItem) => openDialog(row);

const remove = async (row: WebhookSubscriptionItem) => {
  const res = await webhookSubscriptionApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) await loadAll();
};

const testSubscription = async (row: WebhookSubscriptionItem) => {
  const res = await webhookSubscriptionApi.test(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(String(res.detail ?? t("webhook.testDispatched")), {
      type: "success"
    });
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const toggleActive = async (row: WebhookSubscriptionItem) => {
  const res = await webhookSubscriptionApi.partialUpdate(row.pk, {
    is_active: row.is_active
  });
  if (res.code !== SUCCESS_CODE) await loadAll();
};

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <div class="mb-3 flex items-center gap-2">
        <span class="font-semibold">{{ t("webhook.title") }}</span>
        <div class="flex-1" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t("webhook.create") }}
        </el-button>
      </div>
      <el-table v-loading="loading" :data="rows" data-testid="webhook-table">
        <el-table-column
          prop="name"
          :label="t('webhook.name')"
          min-width="140"
        />
        <el-table-column
          prop="url"
          :label="t('webhook.url')"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column :label="t('webhook.events')" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="event in (row as WebhookSubscriptionItem).events"
              :key="event"
              size="small"
              class="mr-1"
            >
              {{ eventLabel(event) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('webhook.isActive')" width="90">
          <template #default="{ row }">
            <el-switch
              v-if="canEdit"
              v-model="(row as WebhookSubscriptionItem).is_active"
              @change="toggleActive(row as WebhookSubscriptionItem)"
            />
            <el-tag
              v-else
              size="small"
              :type="
                (row as WebhookSubscriptionItem).is_active ? 'success' : 'info'
              "
            >
              {{
                (row as WebhookSubscriptionItem).is_active
                  ? t("webhook.on")
                  : t("webhook.off")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="last_failure"
          :label="t('webhook.lastFailure')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('webhook.actions')"
          width="220"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="canTest"
              link
              type="success"
              @click="testSubscription(row as WebhookSubscriptionItem)"
            >
              {{ t("webhook.test") }}
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as WebhookSubscriptionItem)"
            >
              {{ t("webhook.edit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as WebhookSubscriptionItem)"
            >
              {{ t("webhook.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
