/**
 * Pluggable service registry. Production wiring lives in src/services/wire.js;
 * tests replace individual providers (e.g. a deterministic chain adapter) via set().
 */
const services = new Map()
export const setService = (name, impl) => services.set(name, impl)
export function svc(name) {
  const s = services.get(name)
  if (!s) throw new Error(`Service "${name}" is not registered`)
  return s
}
export const hasService = (name) => services.has(name)
