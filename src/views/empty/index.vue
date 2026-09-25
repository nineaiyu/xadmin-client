<script lang="ts" setup>
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import back from "@/assets/svg/back_top.svg?component";

defineOptions({
  name: "Empty"
});

const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <div class="size-full text-center">
    <h1>{{ t("emptyPage.title") }}</h1>
    <p>{{ t("emptyPage.description") }}</p>
    <div class="back" :title="t('emptyPage.back')" @click="router.go(-1)">
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
