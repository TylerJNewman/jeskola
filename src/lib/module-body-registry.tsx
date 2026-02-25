import type { ComponentType } from 'react'

const bodyComponents = new Map<string, ComponentType<{ moduleId: string }>>()

export function registerModuleBody(type: string, component: ComponentType<{ moduleId: string }>) {
  bodyComponents.set(type, component)
}

export function getModuleBody(type: string): ComponentType<{ moduleId: string }> | undefined {
  return bodyComponents.get(type)
}
