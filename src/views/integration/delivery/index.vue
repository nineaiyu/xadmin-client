<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  listWebhookRows,
  webhookDeliveryApi,
  type WebhookDeliveryItem
} from "@/api/system/webhook";

defineOptions({
  name: "WebhookDelivery"
});

const { t } = useI18n();
const canRetry = hasAuth("retry:WebhookDelivery");

const loading = ref(false);
const rows = ref<WebhookDeliveryItem[]>([]);
const total = ref(0);
const query = reactive({ page: 1, page_size: 15, status: "", event: "" });

const statusTag = (status: string) =>
  status === "success"
    ? "success"
    : status === "exhausted"
      ? "danger"
      : status === "failed"
        ? "warning"
        : "info";

const load = async () => {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: query.page,
      // 后端分页参数名为 size（common/core/pagination.py 的 page_size_query_param），
      // 误传 page_size 会被静默忽略、按默认 20 条/页返回
      size: query.page_size
    };
    if (query.status) params.status = query.status;
    if (query.event) params.event = query.event;
    const res = await webhookDeliveryApi.list(params);
    rows.value = listWebhookRows<WebhookDeliveryItem>(res);
    total.value = Number(
      (res?.data as unknown as { total?: number })?.total ?? 0
    );
  } finally {
    loading.value = false;
  }
};

const search = () => {
  query.page = 1;
  load();
};

const retry = async (row: WebhookDeliveryItem) => {
  const res = await webhookDeliveryApi.retry(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(t("webhook.retryOk"), { type: "success" });
    await load();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

onMounted(load);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="font-semibold">{{ t("webhook.deliveryTitle") }}</span>
        <div class="flex-1" />
        <el-select
          v-model="query.status"
          class="w-40!"
          clearable
          :placeholder="t('webhook.statusFilter')"
          @change="search"
        >
          <el-option value="success" :label="t('webhook.stSuccess')" />
          <el-option value="failed" :label="t('webhook.stFailed')" />
          <el-option value="exhausted" :label="t('webhook.stExhausted')" />
          <el-option value="pending" :label="t('webhook.stPending')" />
        </el-select>
        <el-button @click="load">{{ t("webhook.search") }}</el-button>
      </div>
      <el-table
        v-loading="loading"
        :data="rows"
        data-testid="webhook-delivery-table"
      >
        <el-table-column
          prop="created_time"
          :label="t('webhook.time')"
          width="170"
        />
        <el-table-column
          prop="subscription_name"
          :label="t('webhook.subscriptionCol')"
          min-width="140"
        />
        <el-table-column
          prop="event"
          :label="t('webhook.event')"
          min-width="160"
        />
        <el-table-column :label="t('webhook.statusCol')" width="120">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="statusTag((row as WebhookDeliveryItem).status)"
            >
              {{ (row as WebhookDeliveryItem).status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="attempt"
          :label="t('webhook.attempt')"
          width="90"
        />
        <el-table-column
          prop="response_code"
          :label="t('webhook.responseCode')"
          width="100"
        />
        <el-table-column
          prop="response_body"
          :label="t('webhook.responseBody')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column
          prop="duration"
          :label="t('webhook.duration')"
          width="90"
        />
        <el-table-column
          :label="t('webhook.actions')"
          width="100"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="
                canRetry &&
                ['failed', 'exhausted'].includes(
                  (row as WebhookDeliveryItem).status
                )
              "
              link
              type="primary"
              @click="retry(row as WebhookDeliveryItem)"
            >
              {{ t("webhook.retry") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-3 justify-end"
        layout="total, prev, pager, next"
        :total="total"
        :page-size="query.page_size"
        :current-page="query.page"
        @current-change="
          (page: number) => {
            query.page = page;
            load();
          }
        "
      />
    </el-card>
  </div>
</template>
