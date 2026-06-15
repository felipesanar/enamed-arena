import { describe, it, expect } from 'vitest'
import { getAvailableCommands } from '@/admin/lib/commandRegistry'

describe('commandRegistry', () => {
  it('filtra comandos por capability', () => {
    const cmds = getAvailableCommands(new Set(['dashboard.view', 'intel.view']))
    const ids = cmds.map(c => c.id)
    expect(ids).toContain('nav.dashboard')
    expect(ids).toContain('nav.analytics')
    expect(ids).not.toContain('nav.simulados')
    expect(ids).not.toContain('action.create-simulado')
  })

  it('ações utilitárias (tema/sidebar) aparecem para qualquer acesso', () => {
    const cmds = getAvailableCommands(new Set(['intel.view']))
    expect(cmds.map(c => c.id)).toContain('action.toggle-theme')
  })
})
