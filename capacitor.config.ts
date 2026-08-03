import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.instrubyte.crm',
  appName: 'Instrubyte CRM',
  webDir: 'public',
  server: {
    url: 'https://ieescrm.vercel.app',
    androidScheme: 'https',
  },
};

export default config;
