import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 30_000,
  use: { baseURL:'http://127.0.0.1:5173', headless:true, viewport:{width:1440,height:1080}, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}, screenshot:'only-on-failure' },
  webServer: {command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30_000},
});
