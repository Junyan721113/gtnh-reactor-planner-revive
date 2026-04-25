import { useSyncExternalStore } from "react";

export type InfoBarMessage = {
  title: string;
  detail: string;
};

export const DEFAULT_INFO_BAR: InfoBarMessage = {
  title: "GTNH / IC2 Experimental · 反应堆模拟器重制版",
  detail: "Worker 模拟核心、热图、状态曲线、事件流",
};

type Listener = () => void;

const listeners = new Set<Listener>();
let currentMessage = DEFAULT_INFO_BAR;

export function getInfoBarMessage() {
  return currentMessage;
}

export function showInfo(message: InfoBarMessage) {
  if (currentMessage.title === message.title && currentMessage.detail === message.detail) return;
  currentMessage = message;
  listeners.forEach((listener) => listener());
}

export function resetInfo() {
  showInfo(DEFAULT_INFO_BAR);
}

export function subscribeInfoBar(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInfoBarMessage() {
  return useSyncExternalStore(subscribeInfoBar, getInfoBarMessage, getInfoBarMessage);
}
