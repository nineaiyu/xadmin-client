<template>
  <div class="w-full">
    <el-input
      v-model="phone"
      required
      clearable
      :disabled="disabled"
      @input="onInputChange"
    >
      <template v-slot:prepend>
        <el-select
          v-model="selectedCode"
          :disabled="disabled"
          filterable
          style="width: 160px"
          default-first-option
          @change="onCodeChange"
        >
          <el-option
            v-for="country in countries"
            :key="country.value"
            :label="`${country.name} ${country.value}`"
            :value="country.value"
          >
            <span class="country-name">{{ country.name }}</span>
            <span style="float: right; font-size: var(--font-size-sm)">{{
              country.value
            }}</span>
          </el-option>
          <template #label>{{ selectedLabel }}</template>
        </el-select>
      </template>
    </el-input>
  </div>
</template>

<script lang="ts" setup>
import { isSuccess } from "@/api/types";
import { computed, onMounted, ref, watch } from "vue";
import { countriesApi } from "@/api/common";
import type { PhoneInputProps } from "../utils/types";
defineOptions({ name: "PhoneInput" });

type CountryOption = { name: string; value: string };

const DEFAULT_COUNTRY: CountryOption = { name: "China", value: "+86" };

// 模块级缓存：一次会话只拉一次国家区号列表（多字段挂载不重复请求）
let countriesCache: CountryOption[] | undefined;
let countriesRequest: Promise<CountryOption[]> | undefined;

function loadCountries(): Promise<CountryOption[]> {
  if (countriesCache) return Promise.resolve(countriesCache);
  if (!countriesRequest) {
    countriesRequest = countriesApi()
      .then(res => {
        if (!isSuccess(res)) return [DEFAULT_COUNTRY];
        // 同一区号可能对应多个国家/地区（如 +1）：按区号去重，保留下拉首项
        const seen = new Set<string>();
        return res.data
          .map(item => ({
            name: `${item.flag} ${item.name}`,
            value: item.phone_code
          }))
          .filter(item => {
            if (seen.has(item.value)) return false;
            seen.add(item.value);
            return true;
          });
      })
      .catch(() => [DEFAULT_COUNTRY])
      .then(options => {
        countriesCache = options;
        countriesRequest = undefined;
        return options;
      });
  }
  return countriesRequest;
}

const value = defineModel<PhoneInputProps>({
  default: () => ({ code: "+86", phone: "" })
});
defineProps({
  disabled: {
    type: Boolean
  }
});

const selectedCode = ref(value.value?.code || DEFAULT_COUNTRY.value);
const countries = ref<CountryOption[]>([DEFAULT_COUNTRY]);

const phone = computed({
  get: () => String(value.value?.phone ?? ""),
  set: phoneValue => {
    value.value = { code: selectedCode.value, phone: phoneValue };
  }
});

const selectedLabel = computed(() => {
  const country = countries.value.find(
    item => item.value === selectedCode.value
  );
  return country ? `${country.name} ${country.value}` : selectedCode.value;
});

const emit = defineEmits<{
  change: [values: PhoneInputProps];
}>();

onMounted(() => {
  loadCountries().then(options => {
    countries.value = options;
  });
});

watch(
  () => value.value?.code,
  code => {
    if (code && code !== selectedCode.value) selectedCode.value = code;
  }
);

const onCodeChange = () => {
  onInputChange();
};

/** 提交净化后的 {code, phone}：不含国家显示名等展示键 */
const onInputChange = () => {
  const payload = {
    code: selectedCode.value,
    phone: String(value.value?.phone ?? "")
  };
  value.value = payload;
  emit("change", payload);
};
</script>

<style scoped>
.country-name {
  display: inline-block;
  width: 150px;
  padding-right: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
