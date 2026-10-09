import { getPluginsList } from "./build/plugins.ts";
import { include, exclude } from "./build/optimize.ts";
import {
  type UserConfigExport,
  type ConfigEnv,
  createLogger,
  loadEnv,
  transformWithOxc
} from "vite";
import {
  __APP_INFO__,
  alias,
  pathResolve,
  root,
  wrapperEnv,
  createProxyConfig
} from "./build/utils.ts";

export default async ({ mode }: ConfigEnv): Promise<UserConfigExport> => {
  const { VITE_CDN, VITE_PORT, VITE_COMPRESSION, VITE_PUBLIC_PATH } =
    wrapperEnv(loadEnv(mode, root));
  // E2E 专用：pnpm test:e2e 注入 E2E_API_PORT=18896，playwright 以该端口拉起独立后端
  // （见 playwright.config.ts），此处以同端口做 /api 代理目标；常规开发（pnpm dev）无
  // 注入时默认 8896，连本机 compose 容器后端，不受影响
  const apiPort = process.env.E2E_API_PORT ?? "8896";
  // ws 代理 ECONNRESET 降噪：页面跳转/关闭会重置在途 WebSocket，vite 8 对每个断连
  // 记两条 error（ws proxy error + ws proxy socket error）——E2E 跑批高频页面切换下
  // 是纯噪音，非后端故障信号。仅过滤「ws 代理 + ECONNRESET」组合，其余代理错误
  // （如后端未启动的 ECONNREFUSED）保持原样告警
  const logger = createLogger();
  const baseLoggerError = logger.error.bind(logger);
  logger.error = (msg, options) => {
    if (msg.includes("ws proxy") && msg.includes("ECONNRESET")) return;
    baseLoggerError(msg, options);
  };
  return {
    customLogger: logger,
    base: VITE_PUBLIC_PATH,
    root,
    resolve: {
      alias
    },
    // 服务端渲染
    server: {
      // 端口号
      port: VITE_PORT,
      host: "0.0.0.0",
      // 本地跨域代理 https://cn.vitejs.dev/config/server-options.html#server-proxy
      proxy: createProxyConfig({
        [`http://127.0.0.1:${apiPort}`]: ["/api", "/media", "/api-docs"],
        [`ws://127.0.0.1:${apiPort}`]: ["/ws"]
      }),
      // 预热文件以提前转换和缓存结果，降低启动期间的初始页面加载时长并防止转换瀑布
      warmup: {
        clientFiles: ["./index.html", "./src/{views,components}/*"]
      }
    },
    plugins: await getPluginsList(VITE_CDN, VITE_COMPRESSION),
    // https://cn.vitejs.cn/config/dep-optimization-options.html#dep-optimization-options
    optimizeDeps: {
      include,
      exclude,
      rolldownOptions: {
        transform: {
          jsx: {
            runtime: "automatic",
            importSource: "vue"
          }
        },
        // rolldown 依赖扫描器（dev 启动时为预打包收集 import）解析 .tsx 时未启用
        // JSX 语法，任何含 JSX 的 .tsx 都会让整次扫描以 PARSE_ERROR 中断、预打包
        // 被跳过（如 system/menu/utils/hook.tsx）。这里仅在扫描阶段先把 JSX 降级为
        // vue/jsx-runtime 调用，不影响正常 dev/build 转换链路。
        plugins: [
          {
            name: "xadmin:dep-scan-lower-jsx",
            transform: {
              filter: { id: /\.[jt]sx$/ },
              async handler(code: string, id: string) {
                if (id.includes("node_modules")) return;
                const result = await transformWithOxc(code, id, {
                  lang: id.endsWith(".tsx") ? "tsx" : "jsx",
                  jsx: {
                    runtime: "automatic",
                    importSource: "vue",
                    development: true
                  },
                  tsconfig: false
                });
                return { code: result.code, moduleType: "js" };
              }
            }
          }
        ]
      }
    },
    build: {
      // https://cn.vitejs.dev/guide/build.html#browser-compatibility
      target: "es2015",
      sourcemap: false,
      // 分包后主 chunk 已回归正常体量；vanilla-jsoneditor（懒加载 JSON 编辑器，
      // 约 1.2MB）为已知懒加载大件，不再用 4000KB 阈值掩盖其他包体膨胀
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        input: {
          index: pathResolve("./index.html", import.meta.url)
        },
        // 静态资源分类打包
        output: {
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]",
          // 第三方 vendor 分包：首屏并行加载 + 长缓存，主 chunk 只保留应用代码。
          // 注意：不要加"兜底 node_modules"组——它会把仅被懒加载视图使用的库
          // 提升进急加载依赖图（实测首屏 gzip 699KB→1203KB 的回退）。
          // 同理，为「既被急加载、又被按需 import」的库（plus-pro 语言包 + 组件库）
          // 分组时须把两者拆成两个组，否则合并后的 chunk 会被急加载侧拉回首屏。
          advancedChunks: {
            groups: [
              {
                name: "vue-core",
                test: /node_modules[\\/](vue|@vue|vue-router|pinia|vue-demi|@intlify|vue-i18n|@vueuse|@vueuse\/motion)[\\/]/
              },
              // element-plus 不设分组：手工分组会把「外壳共享内部模块」与
              // 「仅业务页面消费的组件」并进同一 chunk，该 chunk 一旦被急加载侧
              // 引用就整体回到首屏（实测闭包无收益）。交由 rolldown 按
              // 静态 / 动态 import 边界自然分块。
              // plus-pro 不设分组：语言包（App.vue 急加载）与其样式入口
              // (`plus-pro-components/index.css`) 会把同名 chunk 变成急加载块，
              // 从而把按需的组件库一并拉回首屏。交由 rolldown 自然分块。
              {
                name: "echarts",
                test: /node_modules[\\/](echarts|zrender)[\\/]/
              }
            ]
          }
        },
        checks: {
          pluginTimings: false,
          toleratedTransform: false
        }
      }
    },
    define: {
      __INTLIFY_PROD_DEVTOOLS__: false,
      __APP_INFO__: JSON.stringify(__APP_INFO__)
    }
  };
};
