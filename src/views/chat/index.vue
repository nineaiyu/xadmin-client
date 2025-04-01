<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import { message } from "@/utils/message";
import { PureWebSocket, WS } from "@/utils/websocket";

defineOptions({
  name: "Chat"
});
const msgData = ref([]);
const chatMsg = ref("");
const scroller = ref();
const userinfo = reactive({
  username: "",
  pk: ""
});
const ws = ref<WS>();

const scrollToBottom = () => {
  scroller.value?.scrollToBottom();
};

interface MessageProps {
  timestamp: string;
  action: string;
  status: string;
  data: {
    pk: string;
    userinfo: {
      username: string;
    };
  };
}

const onMessage = (json_data: MessageProps) => {
  switch (json_data?.action) {
    case "userinfo":
      userinfo.username = json_data.data?.userinfo?.username;
      userinfo.pk = json_data.data.pk;
      break;
    case "chat_message":
      msgData.value.push({ ...json_data.data, timestamp: json_data.timestamp });
      scrollToBottom();
      break;
    case "error":
      console.log(json_data);
      break;
  }
};

const chatHandle = () => {
  if (chatMsg.value) {
    ws.value.send(
      JSON.stringify({ action: "chat_message", data: { text: chatMsg.value } })
    );
    chatMsg.value = "";
  } else {
    message("消息不存在", { type: "warning" });
  }
};
const enter = ref(false);

onMounted(() => {
  ws.value = new PureWebSocket("system_default_websocket", "xadmin", {
    openCallback: () => {
      message("连接建立成功", { type: "success" });
      enter.value = true;
      ws.value.send(JSON.stringify({ action: "userinfo" }));
      ws.value.onMessage(data => {
        onMessage(data);
      });
    },
    errorCallback() {
      message(`连接已断开，正在进行第${ws.value.reconnectCount}次重试`, {
        type: "warning"
      });
    }
  });
});

onUnmounted(() => {
  if (ws.value) ws.value.close();
});
const search = ref("");
const filteredItems = computed(() => {
  if (!search.value) return msgData.value;
  const lowerCaseSearch = search.value;
  return msgData.value.filter(i => i.text == lowerCaseSearch);
});
</script>

<template>
  <el-row :gutter="24">
    <el-col :lg="13" :md="13" :sm="24" :xl="13" :xs="24">
      <el-card class="mb-4 box-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="font-medium">公共聊天室</span>
          </div>
        </template>
        <div class="h-[500px]">
          <DynamicScroller
            ref="scroller"
            :items="filteredItems"
            :min-item-size="20"
            class="scroller"
            key-field="timestamp"
            @resize="scrollToBottom"
          >
            <template #default="{ item, index, active }">
              <DynamicScrollerItem
                :active="active"
                :class="[userinfo.pk === item.pk ? 'message-me' : 'message']"
                :data-active="active"
                :data-index="index"
                :item="item"
                :size-dependencies="[item.text]"
                :title="`${index} ${item.username}  ${item.pk}`"
              >
                <div class="flex items-center">
                  <el-text type="info">{{ item.username }}：</el-text>
                  <el-text type="primary">{{ item.text }}</el-text>
                </div>
              </DynamicScrollerItem>
            </template>
          </DynamicScroller>
        </div>
      </el-card>
      <el-card>
        <el-form-item label="请输入：">
          <div class="w-[60%]">
            <el-input
              v-model="chatMsg"
              placeholder="输入消息并回车发送"
              @keyup.enter="chatHandle"
            />
          </div>
          <el-button @click="chatHandle">发送</el-button>
        </el-form-item>
      </el-card>
    </el-col>
  </el-row>
</template>

<style lang="scss" scoped>
.main-content {
  margin: 0 !important;
}

.message {
  box-sizing: border-box;
  display: flex;
  min-height: 28px;
  padding: 12px;
}

.message-me {
  box-sizing: border-box;
  display: flex;
  justify-content: flex-end;
  min-height: 28px;
  padding: 12px;
}

.scroller {
  flex: auto 1 1;
  height: 100%;
}

:deep(.vue-recycle-scroller__item-view.hover) {
  color: white;
  background: #4fc08d;
}
</style>
