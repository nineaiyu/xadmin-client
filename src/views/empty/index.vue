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
  background: rgb(138 150 160 / 8%);
  border-radius: 18px;
  transform: translate(-50%, -50%);

  &:hover {
    background: rgb(138 150 160 / 20%);
    transition: background 0.6s;
  }
}
</style>
