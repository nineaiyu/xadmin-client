<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  listWebhookRows,
  webhookSubscriptionApi,
  type WebhookEvent,
  type WebhookSubscriptionItem
} from "@/api/system/webhook";

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
      webhookSubscriptionApi.list({ page_size: 100 }),
      webhookSubscriptionApi.events()
    ]);
    rows.value = listWebhookRows<WebhookSubscriptionItem>(listRes);
    if (eventsRes.code === 1000) {
      events.value = (eventsRes.data as never as WebhookEvent[]) ?? [];
    }
  } finally {
    loading.value = false;
  }
};

const dialog = ref(false);
const editingPk = ref<string | null>(null);
const form = reactive({
  name: "",
  url: "",
  secret: "",
  events: [] as string[],
  description: "",
  is_active: true
});

const eventLabel = (key: string) =>
  events.value.find(item => item.key === key)?.label ?? key;

const openCreate = () => {
  editingPk.value = null;
  Object.assign(form, {
    name: "",
    url: "",
    secret: "",
    events: [],
    description: "",
    is_active: true
  });
  dialog.value = true;
};

const openEdit = (row: WebhookSubscriptionItem) => {
  editingPk.value = row.pk;
  Object.assign(form, { ...JSON.parse(JSON.stringify(row)), secret: "" });
  dialog.value = true;
};

const submit = async () => {
  if (!form.name || !form.url || form.events.length === 0) {
    message(t("webhook.required"), { type: "warning" });
    return;
  }
  const payload: Record<string, unknown> = {
    name: form.name,
    url: form.url,
    events: form.events,
    description: form.description,
    is_active: form.is_active
  };
  // 编辑时留空 secret = 沿用原密钥
  if (form.secret || !editingPk.value) {
    payload.secret = form.secret;
  }
  const res = editingPk.value
    ? await webhookSubscriptionApi.partialUpdate(editingPk.value, payload)
    : await webhookSubscriptionApi.create(payload);
  if (res.code === 1000) {
    message(t("webhook.saveOk"), { type: "success" });
    dialog.value = false;
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const remove = async (row: WebhookSubscriptionItem) => {
  const res = await webhookSubscriptionApi.destroy(row.pk);
  if (res.code === 1000) await loadAll();
};

const testSubscription = async (row: WebhookSubscriptionItem) => {
  const res = await webhookSubscriptionApi.test(row.pk);
  if (res.code === 1000) {
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
  if (res.code !== 1000) await loadAll();
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

    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('webhook.edit') : t('webhook.create')"
      width="560px"
    >
      <el-form label-width="110px">
        <el-form-item :label="t('webhook.name')" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('webhook.url')" required>
          <el-input
            v-model="form.url"
            placeholder="https://hooks.example.com/x"
          />
        </el-form-item>
        <el-form-item :label="t('webhook.secret')" :required="!editingPk">
          <el-input
            v-model="form.secret"
            type="password"
            show-password
            :placeholder="
              editingPk ? t('webhook.secretKeep') : t('webhook.secretHint')
            "
          />
        </el-form-item>
        <el-form-item :label="t('webhook.events')" required>
          <el-select v-model="form.events" class="w-full" multiple filterable>
            <el-option
              v-for="item in events"
              :key="item.key"
              :value="item.key"
              :label="item.label"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('webhook.isActive')">
          <el-switch v-model="form.is_active" />
        </el-form-item>
        <el-form-item :label="t('webhook.description')">
          <el-input v-model="form.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{ t("webhook.cancel") }}</el-button>
        <el-button type="primary" @click="submit">{{
          t("webhook.confirm")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
