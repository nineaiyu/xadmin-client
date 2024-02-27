<script lang="ts" setup>
import { animates } from "./animate";
import { computed, ref } from "vue";
import { cloneDeep } from "@pureadmin/utils";
import { $t, transformI18n } from "@/plugins/i18n";

defineOptions({
  name: "ReAnimateSelector"
});

const props = defineProps({
  placeholder: {
    type: String,
    default: transformI18n($t("menu.verifyTransition"))
  }
});

const inputValue = defineModel({ type: String });
const searchVal = ref();
const animatesList = ref(animates);
const copyAnimatesList = cloneDeep(animatesList);

const animateClass = computed(() => {
  return [
    "mt-1",
    "flex",
    "border",
    "w-[130px]",
    "h-[100px]",
    "items-center",
    "cursor-pointer",
    "transition-all",
    "justify-center",
    "border-[#e5e7eb]",
    "hover:text-primary",
    "hover:duration-[700ms]"
  ];
});

const animateStyle = computed(
  () => (i: string) =>
    inputValue.value === i
      ? {
          borderColor: "var(--el-color-primary)",
          color: "var(--el-color-primary)"
        }
      : ""
);

function onChangeIcon(animate: string) {
  inputValue.value = animate;
}

function onClear() {
  inputValue.value = "";
}

function filterMethod(value: any) {
  searchVal.value = value;
  animatesList.value = copyAnimatesList.value.filter((i: string | any[]) =>
    i.includes(value)
  );
}

const animateMap = ref({});

function onMouseEnter(index: string | number) {
  animateMap.value[index] = animateMap.value[index]?.loading
    ? Object.assign({}, animateMap.value[index], {
        loading: false
      })
    : Object.assign({}, animateMap.value[index], {
        loading: true
      });
}

function onMouseleave() {
  animateMap.value = {};
}
</script>

<template>
  <el-select
    :filter-method="filterMethod"
    :model-value="inputValue"
    :placeholder="props.placeholder"
    clearable
    filterable
    popper-class="pure-animate-popper"
    @clear="onClear"
  >
    <template #empty>
      <div class="w-[280px]">
        <el-scrollbar
          :view-style="{ overflow: 'hidden' }"
          class="border-t border-[#e5e7eb]"
          height="212px"
          noresize
        >
          <ul class="flex flex-wrap justify-around mb-1">
            <li
              v-for="(animate, index) in animatesList"
              :key="index"
              :class="animateClass"
              :style="animateStyle(animate)"
              @click="onChangeIcon(animate)"
              @mouseenter.prevent="onMouseEnter(index)"
              @mouseleave.prevent="onMouseleave"
            >
              <h4
                :class="[
                  `animate__animated animate__${
                    animateMap[index]?.loading
                      ? animate + ' animate__infinite'
                      : ''
                  } `
                ]"
              >
                {{ animate }}
              </h4>
            </li>
          </ul>
          <el-empty
            v-show="animatesList.length === 0"
            :description="`${searchVal} ${transformI18n($t('layout.noData'))}`"
            :image-size="60"
          />
        </el-scrollbar>
      </div>
    </template>
  </el-select>
</template>

<style>
.pure-animate-popper {
  min-width: 0 !important;
}
</style>
