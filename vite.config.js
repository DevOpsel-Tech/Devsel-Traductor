import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": `http://127.0.0.1:${env.PORT ?? "3000"}`,
      },
    },
  };
});
