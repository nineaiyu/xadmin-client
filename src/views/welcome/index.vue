<script lang="ts" setup>
import TypeIt from "@/components/ReTypeit";

const { version } = __APP_INFO__.pkg;

defineOptions({
  name: "Welcome"
});
</script>

<template>
  <h1>
    <TypeIt
      :options="{
        strings: [`xAdmin（国际化版本v${version}）`],
        cursor: false,
        speed: 60
      }"
    />
  </h1>
</template>
