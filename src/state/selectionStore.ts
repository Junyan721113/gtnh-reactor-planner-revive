import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let selectedId: number | null = 45;

export function getSelectedId() {
  return selectedId;
}

export function setSelectedId(next: number | null) {
  if (selectedId === next) return;
  selectedId = next;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSelectedId() {
  return useSyncExternalStore(subscribe, getSelectedId, getSelectedId);
}
