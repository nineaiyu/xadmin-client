<script lang="ts" setup>
import { onMounted, ref } from "vue";

import {
  SystemMsgSubscriptionApi,
  type MsgBackendItem,
  type MsgSubscriptionCategory
} from "@/api/system/notifications";
import { handleOperation, openDialogDrawer } from "@/components/RePlusPage";
import { dialogSize } from "@/components/ReDialog/size";
import { useI18n } from "vue-i18n";
import SearchDialog from "@/views/system/components/SearchDialog.vue";
import type { RecordType } from "plus-pro-components";

/** el-table 行作用域类型（element-plus 的 DefaultRow 结构；模板侧按 RecordType 接收） */
type DefaultRow = RecordType;

defineOptions({
  name: "MessageNotifications"
});

interface NotificationsProps {
  api?: SystemMsgSubscriptionApi;
  auth?: {
    list: boolean;
    partialUpdate: boolean;
    backends: boolean;
  };
  hasReceivers?: boolean;
  hasOperations?: boolean;
}

const props = withDefaults(defineProps<NotificationsProps>(), {
  api: undefined,
  auth: () => ({
    list: false,
    partialUpdate: false,
    backends: false
  }),
  hasReceivers: false,
  hasOperations: false
});

/** 表格订阅行（接口分类数据格式化后用于表格展示） */
type SubscriptionItem = {
  pk: string;
  value: string;
  receivers: { pk: number | string; label: string }[];
  receiveBackends: Record<string, boolean>;
};

/** 表格分类行（children 为订阅行） */
type SubscriptionCategory = {
  pk: string;
  value: string;
  children?: SubscriptionItem[];
};

const { t } = useI18n();
const tableData = ref<SubscriptionCategory[]>([]);
const receiveBackends = ref<MsgBackendItem[]>([]);
const loading = ref(false);

const formatCategory = (subscriptions: MsgSubscriptionCategory[]) => {
  tableData.value = [];
  for (const category of subscriptions) {
    const subItems: SubscriptionItem[] = [];
    const item: SubscriptionCategory = {
      pk: category["category"],
      value: category["category_label"],
      children: subItems
    };

    for (const item of category["children"]) {
      const backendsChecked: Record<string, boolean> = {};
      receiveBackends.value.forEach(backend => {
        backendsChecked[backend.value] =
          item["receive_backends"].indexOf(backend.value) > -1;
      });

      const subItem: SubscriptionItem = {
        pk: item["message_type"],
        value: item["message_type_label"],
        receivers: item.receivers,
        receiveBackends: backendsChecked
      };
      subItems.push(subItem);
    }
    tableData.value.push(item);
  }
};

const getInitData = () => {
  if (props.auth.backends) {
    props.api?.backends().then(res => {
      receiveBackends.value = res.data;
    });
  }
  if (props.auth.list) {
    loading.value = true;
    props.api?.list().then(res => {
      formatCategory(res.data);
      loading.value = false;
    });
  }
};

onMounted(() => {
  getInitData();
});

// 模板中 el-table 行作用域为 DefaultRow（Record<PropertyKey, any>），
// 三个行操作按该类型接收后再使用，避免与订阅行类型在模板侧冲突
const onCheckReceiveBackend = (row: DefaultRow) => {
  const backends = [];
  for (const [name, checked] of Object.entries(row.receiveBackends)) {
    if (checked) {
      backends.push(name);
    }
  }
  handleOperation({
    t,
    apiReq: props.api?.partialUpdate(row.pk, {
      receive_backends: backends
    })
  });
};

const handleSendTestMsg = (row: DefaultRow) => {
  handleOperation({
    t,
    apiReq: props.api?.testMsg({ message_type: row.pk })
  });
};

const handleSaveReceivers = (row: DefaultRow) => {
  openDialogDrawer({
    t,
    title: t("messageNotifications.editRecipientTitle", { title: row.value }),
    rawRow: {
      component: "SearchUser",
      data: row.receivers
    },
    dialogDrawerOptions: { width: dialogSize("md") },
    form: SearchDialog,
    saveCallback: ({ formData, done, closeLoading }) => {
      handleOperation({
        t,
        apiReq: props.api?.partialUpdate(row.pk, {
          users: formData.data.map((r: { pk: number | string }) => r.pk)
        }),
        success(res) {
          const data = res?.data;
          done();
          tableData.value.forEach(i => {
            for (const item of i.children ?? []) {
              if (item.pk === data?.message_type) {
                item.receivers = data?.receivers ?? item.receivers;
                break;
              }
            }
          });
        },
        requestEnd() {
          closeLoading();
        }
      });
    }
  });
};

/** 订阅行接收人标签（模板行作用域为 DefaultRow，内部按订阅行接收人数组收窄） */
const receiverLabels = (row: DefaultRow) => {
  const receivers = row.receivers as SubscriptionItem["receivers"];
  return receivers.map(item => item.label).join(", ");
};
</script>

<template>
  <el-table
    v-loading="loading"
    :data="tableData"
    :stripe="true"
    default-expand-all
    row-key="pk"
  >
    <el-table-column
      :label="t('messageNotifications.messageType')"
      min-width="200"
    >
      <template #default="{ row }">
        <span>{{ row.value }}</span>
      </template>
    </el-table-column>
    <el-table-column
      v-for="header in receiveBackends"
      :key="header.value"
      :label="header.label"
      width="80"
    >
      <template #default="{ row }">
        <span v-if="!row.children">
          <el-checkbox
            v-if="header.value !== 'site_msg'"
            v-model="row.receiveBackends[header.value]"
            :disabled="!auth.partialUpdate"
            @change="onCheckReceiveBackend(row)"
          />
          <el-checkbox v-else :disabled="true" :model-value="true" />
        </span>
      </template>
    </el-table-column>
    <el-table-column
      v-if="hasReceivers"
      :label="t('messageNotifications.receivers')"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span v-if="!row.children">
          {{ receiverLabels(row) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column
      v-if="auth.partialUpdate || auth.list"
      :label="t('commonLabels.operation')"
      width="240"
    >
      <template v-slot="{ row }">
        <template v-if="!row.children">
          <!-- 发送测试：按订阅行真实下发一条测试消息（系统订阅发超管 / 个人订阅发自己） -->
          <el-button @click="handleSendTestMsg(row)">
            {{ t("messageNotifications.sendTestMessage") }}
          </el-button>
          <el-button v-if="hasOperations" @click="handleSaveReceivers(row)">
            {{ t("messageNotifications.editRecipient") }}
          </el-button>
        </template>
      </template>
    </el-table-column>
  </el-table>
</template>
