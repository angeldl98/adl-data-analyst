"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = logInfo;
exports.logError = logError;
function logInfo(event, payload) {
    if (payload)
        console.log(event, payload);
    else
        console.log(event);
}
function logError(event, payload) {
    if (payload)
        console.error(event, payload);
    else
        console.error(event);
}
