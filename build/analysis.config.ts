// 仅供 `pnpm analyze:bundle` 使用的构建配置：在基准 vite.config.ts 之上追加
// rollup-plugin-visualizer 的 raw-data 模板（机器可读的模块体积 JSON），
// 产出用于「首屏预算制」的拆包决策依据。不参与常规 dev/build。
import baseConfig from "../vite.config";
import { visualizer } from "rollup-plugin-visualizer";
import type { ConfigEnv, PluginOption, UserConfig } from "vite";

export default async (env: ConfigEnv): Promise<UserConfig> => {
  const base = (await baseConfig(env)) as UserConfig;
  const basePlugins = (base.plugins ?? []) as PluginOption[];
  return {
    ...base,
    plugins: [
      ...basePlugins,
      visualizer({
        template: "raw-data",
        filename: "bundle-analysis.json",
        gzipSize: true
      })
    ]
  };
};
