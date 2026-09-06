import { getPluginsList } from "./build/plugins.ts";
import { include, exclude } from "./build/optimize.ts";
import { type UserConfigExport, type ConfigEnv, loadEnv } from "vite";
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
  // E2E 专用：playwright 以 E2E_API_PORT 拉起独立后端（见 playwright.config.ts），
  // 默认仍指向 8896，不影响常规开发
  const apiPort = process.env.E2E_API_PORT ?? "8896";
  return {
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
        }
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
          // 第三方 vendor 分包（T3.4）：首屏并行加载 + 长缓存，主 chunk 只保留应用代码。
          // 注意：不要加"兜底 node_modules"组——它会把仅被懒加载视图使用的库
          // 提升进急加载依赖图（实测首屏 gzip 699KB→1203KB 的回退）。
          advancedChunks: {
            groups: [
              {
                name: "vue-core",
                test: /node_modules[\\/](vue|@vue|vue-router|pinia|vue-demi|@intlify|vue-i18n|@vueuse|@vueuse\/motion)[\\/]/
              },
              {
                name: "element-plus",
                test: /node_modules[\\/](element-plus|@element-plus)[\\/]/
              },
              {
                name: "plus-pro",
                test: /node_modules[\\/]plus-pro-components[\\/]/
              },
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
