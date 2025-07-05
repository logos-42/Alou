"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bus = void 0;
exports.emit = emit;
exports.on = on;
const events_1 = require("events");
exports.bus = new events_1.EventEmitter();
function emit(topic, payload) {
    exports.bus.emit(topic, payload);
}
function on(topic, handler) {
    exports.bus.on(topic, handler);
}
//# sourceMappingURL=event-bus.js.map