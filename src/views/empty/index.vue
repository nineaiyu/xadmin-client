<script lang="ts" setup>
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { goBackOrHome, hasInAppHistory } from "@/router/utils";
import back from "@/assets/svg/back_top.svg?component";

defineOptions({
  name: "Empty"
});

const router = useRouter();
const { t } = useI18n();
/** 是否有站内上一页：决定返回落点与提示文案（直达进入时回首页，go(-1) 是无操作） */
const canBack = hasInAppHistory(router);
</script>

<template>
  <div class="size-full text-center">
    <h1>{{ t("emptyPage.title") }}</h1>
    <p>{{ t("emptyPage.description") }}</p>
    <div
      class="back"
      :title="canBack ? t('emptyPage.back') : t('error.goBack')"
      @click="goBackOrHome(router)"
    >
      <back class="size-20" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.back {
  position: relative;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
  cursor: pointer;

  /* 底色/悬浮色取 EP 令牌（暗色下由 EP 重定义）；18px 为设计圆角，无对应令牌 */
  background: var(--el-fill-color-light);
  border-radius: 18px;
  transform: translate(-50%, -50%);

  &:hover {
    background: var(--el-fill-color);
    transition: background 0.6s;
  }
}
</style>
