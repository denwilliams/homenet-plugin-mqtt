declare module 'homenet-plugin-mqtt' {
  import { IPluginLoader } from '@homenet/core';
  export function create(annotate: any): { MqttPluginLoader: new (...args: any[]) => IPluginLoader }
}
