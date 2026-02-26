import { registerModuleBody } from '@/lib/module-body-registry'

function MasterBody(_props: { moduleId: string }) {
  return null
}

registerModuleBody('master', MasterBody)
export { MasterBody }
