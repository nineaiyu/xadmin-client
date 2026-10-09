<script lang="ts" setup>
import { computed } from "vue";
import { useAccountManage } from "../utils/hook";
import { hasAuth } from "@/router/utils";
import AccountPanel from "./AccountPanel.vue";
import type { RecordType } from "plus-pro-components";

defineOptions({
  name: "AccountManagement"
});

const { t, handleChangePassword, handleBindEmailOrPhone, userinfoStore } =
  useAccountManage();
const list = computed(() => [
  {
    name: "password",
    title: t("account.password"),
    button: hasAuth("resetPassword:UserInfo") && t("buttons.update")
  },
  {
    name: "phone",
    title: t("userinfo.phone"),
    illustrate: userinfoStore.phone
      ? `${t("account.bind")}：${userinfoStore.phone}`
      : t("account.unbound"),
    button: hasAuth("bind:UserInfo") && t("buttons.update")
  },
  {
    name: "email",
    title: t("userinfo.email"),
    illustrate: userinfoStore.email
      ? `${t("account.bind")}：${userinfoStore.email}`
      : t("account.unbound"),
    button: hasAuth("bind:UserInfo") && t("buttons.update")
  }
]);

function onClick(item: RecordType) {
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
  <AccountPanel :title="t('account.accountManagement')">
    <div v-for="item in list" :key="item.name" class="account-row">
      <div class="account-row__main">
        <p class="account-row__title">{{ item.title }}</p>
        <el-text class="account-row__desc" type="info" size="small">
          {{ item.illustrate }}
        </el-text>
      </div>
      <el-button v-if="item.button" text type="primary" @click="onClick(item)">
        {{ item.button }}
      </el-button>
    </div>
  </AccountPanel>
</template>
