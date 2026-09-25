<script lang="ts" setup>
import { reactive } from "vue";
import type { MonitorThresholdItem } from "@/api/system/monitor";

defineOptions({ name: "MonitorThresholdForm" });

const props = defineProps<{ items: MonitorThresholdItem[] }>();

/** 表单初值取当前阈值；el-input-number 以 min/max 约束取值范围，无需额外校验 */
const form = reactive<Record<string, number>>({});
props.items.forEach(item => {
  form[item.key] = Number(item.value ?? item.min);
});

const getPayload = (): Record<string, number> => ({ ...form });

defineExpose({ getPayload });
</script>

<template>
  <el-form label-position="top">
    <el-form-item
      v-for="item in props.items"
      :key="item.key"
      :label="item.label"
    >
      <el-input-number
        v-model="form[item.key]"
        :min="item.min"
        :max="item.max"
        class="w-full!"
      />
      <div class="mt-1 text-xs text-(--el-text-color-secondary)">
        {{ item.help_text }}
      </div>
    </el-form-item>
  </el-form>
</template>
