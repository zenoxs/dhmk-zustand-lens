import { PersistOptions } from "zustand/middleware";
import { mergeDeep, objectMap, isPlainObject } from "@dhmk/utils";
import {
  Getter,
  ResolveStoreApi,
  LensContext,
  Lens,
  SetParameter,
} from "./core";

export { mergeDeep } from "@dhmk/utils";

export const mergeDeepLeft = <T>(a: unknown, b: T): T => mergeDeep(b, a as any);

export type CustomSetter<F, T, S> = [
  set: F,
  get: Getter<T>,
  api: ResolveStoreApi<S>,
  ctx: LensContext<T, S>
];

export const customSetter = (setter) => (fn) => (set, get, api, ctx) =>
  fn(setter(set), get, api, ctx);

export type NamedSet<T> = (
  partial: SetParameter<T>,
  name?: string,
  replace?: boolean
) => void;

export const namedSetter = customSetter(
  (set) => (partial, name, replace) => set(partial, replace, name)
) as <T, S = any>(
  fn: (...args: CustomSetter<NamedSet<T>, T, S>) => T
) => Lens<T, S>;

export function subscribe<S, T>(
  store: { subscribe: (fn: (s: S) => any) => any; getState(): S },
  selector: (state: S) => T,
  effect: (state: T, prevState: T) => void,
  options: {
    equalityFn?: (a: T, b: T) => boolean;
    fireImmediately?: boolean;
  } = {}
) {
  const { equalityFn = Object.is, fireImmediately = false } = options;

  let curr = selector(store.getState());

  if (fireImmediately) effect(curr, curr);

  return store.subscribe((state) => {
    const next = selector(state);
    if (!equalityFn(next, curr)) {
      const prev = curr;
      effect((curr = next), prev);
    }
  });
}

export function watch<T = any, U = any, S = any>(
  selector: (state: T) => U,
  effect: (state: U, prevState: U) => void,
  options: {
    equalityFn?: (a: T, b: T) => boolean;
    fireImmediately?: boolean;
  } = {}
) {
  const { equalityFn = Object.is, fireImmediately = false } = options;

  let curr;

  if (fireImmediately)
    effect(undefined as unknown as U, undefined as unknown as U);

  return function (set: () => void, ctx: LensContext<T, S>) {
    if (!curr) curr = selector(ctx.get());

    set();

    const next = selector(ctx.get());

    if (!equalityFn(next, curr)) {
      const prev = curr;
      effect((curr = next), prev);
    }
  };
}

const persist = Symbol("persist");

export function persistOptions<T>(conf: {
  load?: (x: unknown) => T;
  save?: (x: T) => unknown;
}) {
  return {
    [persist]: conf,
  };
}

function walk(x, fn) {
  return isPlainObject(x) ? objectMap(fn(x), (v) => walk(v, fn)) : x;
}

const zustandPersistOptions: Pick<
  PersistOptions<any>,
  "merge" | "partialize"
> = {
  merge(persistedState: any = {}, currentState) {
    return walk(
      mergeDeep(currentState, persistedState),
      (x) => x[persist]?.load?.(x) ?? x
    );
  },

  partialize(state) {
    return walk(state, (x) => x[persist]?.save?.(x) ?? x);
  },
};

// for typescript
persistOptions.merge = zustandPersistOptions.merge;
persistOptions.partialize = zustandPersistOptions.partialize;
