"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAnomalyConfig = readAnomalyConfig;
exports.validatePluginName = validatePluginName;
function readPositiveIntEnv(name, defaultValue) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === "")
        return defaultValue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`Invalid ${name} value: ${raw}`);
    }
    return Math.trunc(num);
}
function readAnomalyConfig() {
    const baselineDays = readPositiveIntEnv("ANALYST_ANOMALY_BASELINE_DAYS", 14);
    const dropThresholdPct = readPositiveIntEnv("ANALYST_ANOMALY_DROP_THRESHOLD_PCT", 80);
    return { baselineDays, dropThresholdPct };
}
function validatePluginName(name) {
    if (!name || !name.trim())
        throw new Error("plugin argument is required");
    return name.trim();
}
