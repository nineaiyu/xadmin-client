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
      :cursor="false"
      :speed="60"
      :values="[`xAdmin（国际化版本v${version}）`]"
    />
  </h1>
</template>
