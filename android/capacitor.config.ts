import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.magi.quorum',
  appName: 'MAGI决策系统',
  webDir: 'www',
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true
  },
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
