<script lang="ts" setup>
import {
  type ButtonProps,
  closeDialog,
  type DialogOptions,
  dialogStore,
  type EventType
} from "./index";
import { computed, ref } from "vue";
import { isFunction } from "@pureadmin/utils";
import Fullscreen from "@iconify-icons/ri/fullscreen-fill";
import ExitFullscreen from "@iconify-icons/ri/fullscreen-exit-fill";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "ReDialog"
});
const fullscreen = ref(false);
const { t } = useI18n();
const footerButtons = computed(() => {
  return (options: DialogOptions) => {
    return options?.footerButtons?.length > 0
      ? options.footerButtons
      : ([
          {
            label: t("labels.cancel"),
            text: true,
            bg: true,
            btnClick: ({ dialog: { options, index } }) => {
              const done = () =>
                closeDialog(options, index, { command: "cancel" });
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
            popconfirm: options?.popconfirm,
            btnClick: ({ dialog: { options, index } }) => {
              const done = () =>
                closeDialog(options, index, { command: "sure" });
              if (options?.beforeSure && isFunction(options?.beforeSure)) {
                options.beforeSure(done, { options, index });
              } else {
                done();
              }
            }
          }
        ] as Array<ButtonProps>);
  };
});

const fullscreenClass = computed(() => {
  return [
    "el-icon",
    "el-dialog__close",
    "-translate-x-2",
    "cursor-pointer",
    "hover:!text-[red]"
  ];
});

function eventsCallBack(
  event: EventType,
  options: DialogOptions,
  index: number,
  isClickFullScreen = false
) {
  if (!isClickFullScreen) fullscreen.value = options?.fullscreen ?? false;
  if (options?.[event] && isFunction(options?.[event])) {
    return options?.[event]({ options, index });
  }
}

function handleClose(
  options: DialogOptions,
  index: number,
  args = { command: "close" }
) {
  closeDialog(options, index, args);
  eventsCallBack("close", options, index);
}
</script>

<template>
  <el-dialog
    v-for="(options, index) in dialogStore"
    :key="index"
    v-model="options.visible"
    :fullscreen="fullscreen ? true : options?.fullscreen"
    class="pure-dialog"
    v-bind="options"
    @closeAutoFocus="eventsCallBack('closeAutoFocus', options, index)"
    @closed="handleClose(options, index)"
    @openAutoFocus="eventsCallBack('openAutoFocus', options, index)"
    @opened="eventsCallBack('open', options, index)"
  >
    <!-- header -->
    <template
      v-if="options?.fullscreenIcon || options?.headerRenderer"
      #header="{ close, titleId, titleClass }"
    >
      <div
        v-if="options?.fullscreenIcon"
        class="flex items-center justify-between"
      >
        <span :id="titleId" :class="titleClass">{{ options?.title }}</span>
        <i
          v-if="!options?.fullscreen"
          :class="fullscreenClass"
          @click="
            () => {
              fullscreen = !fullscreen;
              eventsCallBack(
                'fullscreenCallBack',
                { ...options, fullscreen },
                index,
                true
              );
            }
          "
        >
          <IconifyIconOffline
            :icon="
              options?.fullscreen
                ? ExitFullscreen
                : fullscreen
                  ? ExitFullscreen
                  : Fullscreen
            "
            class="pure-dialog-svg"
          />
        </i>
      </div>
      <component
        :is="options?.headerRenderer({ close, titleId, titleClass })"
        v-else
      />
    </template>
    <component
      :is="options.contentRenderer({ options, index })"
      v-bind="options?.props"
      @close="args => handleClose(options, index, args)"
    />
    <!-- footer -->
    <template v-if="!options?.hideFooter" #footer>
      <template v-if="options?.footerRenderer">
        <component :is="options?.footerRenderer({ options, index })" />
      </template>
      <span v-else>
        <template v-for="(btn, key) in footerButtons(options)" :key="key">
          <el-popconfirm
            v-if="btn.popconfirm"
            v-bind="btn.popconfirm"
            @confirm="
              btn.btnClick({
                dialog: { options, index },
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
            v-bind="btn"
            @click="
              btn.btnClick({
                dialog: { options, index },
                button: { btn, index: key }
              })
            "
          >
            {{ btn?.label }}
          </el-button>
        </template>
      </span>
    </template>
  </el-dialog>
</template>
