<script lang="ts" setup>
import {
  type ButtonProps,
  closeDrawer,
  type DrawerOptions,
  drawerStore,
  type EventType
} from "./index";
import { computed, ref } from "vue";
import { isFunction } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "ReDrawer"
});

const sureBtnMap = ref({});
const { t } = useI18n();

const footerButtons = computed(() => {
  return (options: DrawerOptions) => {
    return options?.footerButtons?.length > 0
      ? options.footerButtons
      : ([
          {
            label: t("buttons.cancel"),
            text: true,
            bg: true,
            btnClick: ({ drawer: { options, index } }) => {
              const done = () =>
                handleCloseDrawer(options, index, { command: "cancel" });
              if (options?.beforeCancel && isFunction(options?.beforeCancel)) {
                options.beforeCancel(done, { options, index });
              } else {
                done();
              }
            }
          },
          {
            label: t("buttons.save"),
            type: "primary",
            text: true,
            bg: true,
            popConfirm: options?.popConfirm,
            btnClick: ({ drawer: { options, index } }) => {
              if (options?.sureBtnLoading) {
                sureBtnMap.value[index] = Object.assign(
                  {},
                  sureBtnMap.value[index],
                  {
                    loading: true
                  }
                );
              }
              const closeLoading = () => {
                if (options?.sureBtnLoading) {
                  sureBtnMap.value[index].loading = false;
                }
              };
              const done = () => {
                handleCloseDrawer(options, index, { command: "sure" });
              };
              if (options?.beforeSure && isFunction(options?.beforeSure)) {
                options.beforeSure(done, { options, index, closeLoading });
              } else {
                done();
              }
            }
          }
        ] as Array<ButtonProps>);
  };
});

function eventsCallBack(
  event: EventType,
  options: DrawerOptions,
  index: number
) {
  if (options?.[event] && isFunction(options?.[event])) {
    return options?.[event]({ options, index });
  }
}

function handleCloseDrawer(options: DrawerOptions, index: number, args: any) {
  if (options?.sureBtnLoading && sureBtnMap.value[index]?.loading) {
    sureBtnMap.value[index].loading = false;
  }
  closeDrawer(options, index, args);
}

function handleClose(
  options: DrawerOptions,
  index: number,
  args = { command: "close" }
) {
  handleCloseDrawer(options, index, args);
  eventsCallBack("close", options, index);
}

function handleChange(options: DrawerOptions, index: number, values: any) {
  options?.onChange && options.onChange({ options, index, values });
}
</script>

<template>
  <el-drawer
    v-for="(options, index) in drawerStore"
    :key="index"
    v-model="options.visible"
    :append-to="options?.appendTo ? options.appendTo : 'body'"
    class="pure-drawer"
    v-bind="options"
    @closed="handleClose(options, index)"
    @opened="eventsCallBack('open', options, index)"
    @open-auto-focus="eventsCallBack('openAutoFocus', options, index)"
    @close-auto-focus="eventsCallBack('closeAutoFocus', options, index)"
  >
    <!-- header  -->
    <template
      v-if="options?.headerRenderer"
      #header="{ close, titleId, titleClass }"
    >
      <component
        :is="options?.headerRenderer({ close, titleId, titleClass })"
      />
    </template>
    <!--  body  -->
    <component
      :is="options.contentRenderer({ options, index })"
      v-bind="options?.props"
      @change="values => handleChange(options, index, values)"
      @close="args => handleClose(options, index, args)"
    />
    <!-- footer  -->
    <template v-if="!options?.hideFooter" #footer>
      <template v-if="options?.footerRenderer">
        <component :is="options?.footerRenderer({ options, index })" />
      </template>
      <span v-else>
        <template v-for="(btn, key) in footerButtons(options)" :key="key">
          <el-popconfirm
            v-if="btn.popConfirm"
            v-bind="btn.popConfirm"
            @confirm="
              btn.btnClick({
                drawer: { options, index },
                button: { btn, index: key }
              })
            "
          >
            <template #reference>
              <el-button v-bind="btn">{{ btn?.label }}</el-button>
            </template>
          </el-popconfirm>
          <el-button
            v-else
            :loading="key === 1 && sureBtnMap[index]?.loading"
            v-bind="btn"
            @click="
              btn.btnClick({
                drawer: { options, index },
                button: { btn, index: key }
              })
            "
          >
            {{ btn?.label }}
          </el-button>
        </template>
      </span>
    </template>
  </el-drawer>
</template>
