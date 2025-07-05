import { EventEmitter } from 'events';

export const bus = new EventEmitter();

export function emit(topic: string, payload: any) {
  bus.emit(topic, payload);
}

export function on(topic: string, handler: (payload: any) => void) {
  bus.on(topic, handler);
} 