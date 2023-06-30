<script setup lang="ts">
import TypeIt from "@/components/ReTypeit";

defineOptions({
  name: "Welcome"
});
</script>

<template>
  <h1><type-it :values="['xAdmin（国际化版本）']" /></h1>
</template>
