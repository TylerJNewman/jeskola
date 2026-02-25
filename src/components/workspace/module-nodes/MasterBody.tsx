import { registerModuleBody } from '@/lib/module-body-registry'

function MasterBody(_props: { moduleId: string }) {
  return (
    <div className="text-[9px] text-text-muted text-center py-1">
      Audio Output
    </div>
  )
}

registerModuleBody('master', MasterBody)
export { MasterBody }
