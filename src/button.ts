import { IButton } from '@homenet/core';
import { EventEmitter } from 'events';

export class MqttButton extends EventEmitter implements IButton {
  constructor() {
    super();
  }

  onClick(cb: Function) {
    this.on('click', cb);
  }

  onDoubleClick(cb: Function) {
    this.on('doubleclick', cb);
  }

  onHold(cb: Function) {
    this.on('hold', cb);
  }
}
