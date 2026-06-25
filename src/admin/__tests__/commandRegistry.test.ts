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

  it('ações utilitárias (tema/menu) aparecem para qualquer acesso', () => {
    const cmds = getAvailableCommands(new Set(['intel.view']))
    const ids = cmds.map(c => c.id)
    expect(ids).toContain('action.toggle-theme')
    expect(ids).toContain('action.toggle-sidebar')
  })

  it('usa rótulos diretos em português, sem jargão em inglês', () => {
    const cmds = getAvailableCommands(new Set(['dashboard.view', 'content.manage']))
    const byId = Object.fromEntries(cmds.map(c => [c.id, c.label]))
    expect(byId['action.create-simulado']).toBe('Novo simulado')
    expect(byId['action.upload-questions']).toBe('Subir questões por planilha')
    expect(byId['action.toggle-theme']).toBe('Trocar entre tema claro e escuro')
    // sem termos crus em inglês nos rótulos
    for (const cmd of cmds) {
      expect(cmd.label.toLowerCase()).not.toMatch(/upload|sidebar|dark|light/)
    }
  })
})
