import { MqttButton } from './button';
import { MqttSensor } from './sensor';
import { plugin, service, Dict, IPluginLoader, ILogger, IConfig, IClassTypeFactory, IButtonManager, ISensorManager, IButton, ISensor } from '@homenet/core';
import * as mqtt from 'mqtt';

@plugin()
export class MqttPluginLoader implements IPluginLoader {
  private _logger : ILogger;
  private _config : IConfig;
  private _buttons : Dict<MqttButton> = {};
  private _subscriptions : Dict<Function> = {};
  private _mqttConnected : boolean = false;
  private _mqttClient : any;

  constructor(
          @service('IButtonManager') buttons: IButtonManager,
          @service('ISensorManager') sensors: ISensorManager,
          @service('IConfig') config: IConfig,
          @service('ILogger') logger: ILogger) {

    this._logger = logger;
    this._config = config;

    this._init();

    buttons.addType('mqtt', this._createButtonFactory());
    sensors.addType('mqtt-trigger', this._createSensorsFactory('trigger'));
    sensors.addType('mqtt-value', this._createSensorsFactory('value'));
  }

  load() : void {
  }

  private _init() : void {
    this._logger.info('Starting MQTT plugin');

    const mqttConfig = (<any>this._config).mqtt || {};
    const host = mqttConfig.host || 'localhost';
    const mqttUri = 'mqtt://' + host;

    this._logger.info('Connecting to broker ' + mqttUri);
    const mqttClient  = mqtt.connect(mqttUri);
    this._mqttConnected = false;

    mqttClient.on('connect', () => {
      this._logger.info('MQTT connected');
      this._mqttConnected = true;
      this._onConnected();
    });

    mqttClient.on('close', () => {
      this._logger.info('MQTT closed');
      this._mqttConnected = false;
    });

    mqttClient.on('offline', () => {
      this._logger.info('MQTT offline');
      this._mqttConnected = false;
    });

    this._mqttClient = mqttClient;

    // mqttClient.on('error', console.error);
    // mqttClient.on('message', console.log);
    
    mqttClient.on('message', (topic, message) => {
      // message is Buffer 
      const msgObj = tryParse(message.toString());

      const handler = this._subscriptions[topic];
      if (handler) handler(msgObj);
    });
  }

  private _onConnected() {
    this._bindExistingSubscriptions();
  }

  private _addSubscription(topic: string, callback: Function) {
    this._subscriptions[topic] = callback;
    if (!this._mqttConnected) return;

    this._subscribe(topic);
  }

  private _subscribe(topic) {
    this._mqttClient.subscribe(topic);
  }

  private _bindExistingSubscriptions() {
    for (const topic in this._subscriptions) {
      this._subscribe(topic);
    }
  }

  private _createButtonFactory() {
    return (id: string, opts: { }) : IButton => {
      this._logger.info(`Adding MQTT button: ${id}`);
      const button = new MqttButton();
      this._buttons[id] = button;

      const baseTopic = `homenet/button/${id}/input`;
      this._addSubscription(`${baseTopic}/click`, (e) => {
        button.emit('click', e);
      });
      this._addSubscription(`${baseTopic}/doubleclick`, (e) => {
        button.emit('dblclick', e);
      });
      this._addSubscription(`${baseTopic}/hold`, (e) => {
        button.emit('hold', e);
      });
      return button;
    };
  }

  private _createSensorsFactory(type?: 'trigger' | 'value') : IClassTypeFactory<ISensor> {
    return (id: string, opts: {bridge: string, deviceName: string, zone?: string, timeout?: number}) : ISensor => {
      const sensor = new MqttSensor(id, opts);
      
      const baseTopic = `homenet/sensor/${id}/input`;

      if (!type || type === 'trigger') {
        this._addSubscription(`${baseTopic}/trigger`, (e) => {
          sensor.emit('trigger');
        });
        sensor.isTrigger = true;
        sensor.isToggle = false;
        sensor.isValue = false;
      } else if (type && type === 'value') {
        this._addSubscription(`${baseTopic}/value`, (e) => {
          Object.keys(e).forEach(key => {
            sensor.emit('value', key, e[key]);
          });
        });
        sensor.isTrigger = false;
        sensor.isToggle = false;
        sensor.isValue = true;
      }
      return sensor;
    }
  }
}

function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
}
