export function logInfo(event: string, payload?: Record<string, unknown>) {
  if (payload) console.log(event, payload);
  else console.log(event);
}

export function logError(event: string, payload?: Record<string, unknown>) {
  if (payload) console.error(event, payload);
  else console.error(event);
}
