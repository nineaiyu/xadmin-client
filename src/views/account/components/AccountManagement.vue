<script lang="ts" setup>
import { computed } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { useAccountManage } from "../utils/hook";
import { hasGlobalAuth } from "@/router/utils";

defineOptions({
  name: "AccountManagement"
});

const { t, handleChangePassword, handleBindEmailOrPhone, userinfoStore } =
  useAccountManage();
const list = computed(() => [
  {
    name: "password",
    title: t("account.password"),
    button: t("buttons.update")
  },
  {
    name: "phone",
    title: t("userinfo.phone"),
    illustrate: userinfoStore.email
      ? `${t("account.bind")}：${userinfoStore.phone}`
      : t("account.unbound"),
    button: hasGlobalAuth("bind:UserInfo") && t("buttons.update")
  },
  {
    name: "email",
    title: t("userinfo.email"),
    illustrate: userinfoStore.email
      ? `${t("account.bind")}：${userinfoStore.email}`
      : t("account.unbound"),
    button: hasGlobalAuth("bind:UserInfo") && t("buttons.update")
  }
]);

function onClick(item) {
  if (item.name === "password") {
    handleChangePassword();
  } else if (item.name === "email") {
    handleBindEmailOrPhone("bind_email");
  } else if (item.name === "phone") {
    handleBindEmailOrPhone("bind_phone");
  }
}
</script>

<template>
  <div
    :class="[
      'min-w-[180px]',
      deviceDetection() ? 'max-w-[100%]' : 'max-w-[70%]'
    ]"
  >
    <h3 class="my-8">{{ t("account.accountManagement") }}</h3>
    <div v-for="(item, index) in list" :key="index">
      <div class="flex items-center">
        <div class="flex-1">
          <p>{{ item.title }}</p>
          <el-text class="mx-1" type="info">{{ item.illustrate }}</el-text>
        </div>
        <el-button
          v-if="item.button"
          text
          type="primary"
          @click="onClick(item)"
        >
          {{ item.button }}
        </el-button>
      </div>
      <el-divider />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.el-divider--horizontal {
  border-top: 0.1px var(--el-border-color) var(--el-border-style);
}
</style>
