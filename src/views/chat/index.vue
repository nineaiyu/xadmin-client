<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
defineOptions({
  name: "Chat"
});
const msgData = ref([]);
const chatMsg = ref("");
const scroller = ref();
const userinfo = reactive({
  username: "",
  uid: ""
});
const username = ref("");
import socket from "@/utils/websocket";
import { message } from "@/utils/message";
const scrollToBottom = () => {
  scroller.value?.scrollToBottom();
};

const onMessage = (msg_event: { data: string }) => {
  const json_data = JSON.parse(msg_event.data);
  if (json_data.time) {
    switch (json_data.action) {
      case "userinfo":
        userinfo.username = json_data.data.username;
        userinfo.uid = json_data.data.uid;
        break;
      case "message":
        msgData.value.push(json_data.data);
        scrollToBottom();
        break;
      case "error":
        console.log(json_data);
        break;
    }
  } else {
    message(json_data.message, { type: "error" });
  }
};

const chatHandle = () => {
  if (chatMsg.value) {
    socket.send({ action: "message", data: { text: chatMsg.value } });
    chatMsg.value = "";
  } else {
    message("消息不存在", { type: "warning" });
  }
};
const enter = ref(false);
const enterRoomHandle = () => {
  if (username.value) {
    socket.init(username.value, onMessage, null, () => {
      message("连接建立成功", { type: "success" });
      enter.value = true;
      socket.send({ action: "userinfo", data: {} });
    });
  }
};

onMounted(async () => {});

onUnmounted(() => {
  if (socket && socket.socket_open) {
    socket.close();
  }
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
    <el-col :xs="24" :sm="24" :md="13" :lg="13" :xl="13">
      <el-card class="mb-4 box-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="font-medium">聊天室 {{ username }}</span>
          </div>
        </template>
        <div class="h-[500px]">
          <DynamicScroller
            ref="scroller"
            :items="filteredItems"
            :min-item-size="20"
            key-field="time"
            class="scroller"
            @resize="scrollToBottom"
          >
            <template #default="{ item, index, active }">
              <DynamicScrollerItem
                :item="item"
                :active="active"
                :size-dependencies="[item.text]"
                :data-index="index"
                :data-active="active"
                :title="`${index} ${item.username}  ${item.uid}`"
                :class="[userinfo.uid === item.uid ? 'message-me' : 'message']"
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
        <el-form label-width="100">
          <el-form-item label="昵称" v-if="!enter">
            <div class="w-[60%]">
              <el-input
                v-model="username"
                placeholder="请输入昵称"
                @keyup.enter="enterRoomHandle"
              />
            </div>
            <el-button @click="enterRoomHandle">加入房间</el-button>
          </el-form-item>
          <el-form-item label="请输入：" v-else>
            <div class="w-[60%]">
              <el-input
                v-model="chatMsg"
                @keyup.enter="chatHandle"
                placeholder="输入消息并回车发送"
              />
            </div>
            <el-button @click="chatHandle">发送</el-button>
          </el-form-item>
        </el-form>
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
