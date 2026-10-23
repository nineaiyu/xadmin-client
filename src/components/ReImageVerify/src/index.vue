<script lang="ts" setup>
import { useImageVerify } from "./hooks";

defineOptions({
  name: "ReImageVerify"
});

const imgCode = defineModel({ type: String });

const { imgUrl, loading, getImgCode } = useImageVerify(imgCode);

defineExpose({ getImgCode });
</script>

<template>
  <el-image
    v-loading="loading"
    :src="imgUrl"
    :alt="$t('login.captchaImage')"
    role="button"
    tabindex="0"
    :aria-label="$t('login.captchaRefresh')"
    class="cursor-pointer"
    style="width: 120px; height: 40px"
    @click="getImgCode"
    @keydown.enter.prevent="getImgCode"
    @keydown.space.prevent="getImgCode"
  />
</template>
