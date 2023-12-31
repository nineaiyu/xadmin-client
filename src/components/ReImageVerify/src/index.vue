<script setup lang="ts">
import { useImageVerify } from "./hooks";

defineOptions({
  name: "ReImageVerify"
});

const imgCode = defineModel({ type: String });

const { imgUrl, getImgCode } = useImageVerify(imgCode);

defineExpose({ getImgCode });
</script>

<template>
  <el-image
    style="width: 120px; height: 40px"
    class="cursor-pointer"
    :src="imgUrl"
    @click="getImgCode"
  />
</template>
