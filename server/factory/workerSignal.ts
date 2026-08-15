import { EventEmitter } from "node:events";

const workerEvents = new EventEmitter();

export function signalBackgroundWorker() {
  workerEvents.emit("workflow-enqueued");
}

export function subscribeToBackgroundWork(listener: () => void) {
  workerEvents.on("workflow-enqueued", listener);
  return () => workerEvents.off("workflow-enqueued", listener);
}
