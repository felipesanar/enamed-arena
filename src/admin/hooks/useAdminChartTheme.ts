import { useSyncExternalStore } from 'react'
import { getAdminChartTheme } from '@/admin/lib/adminChartTheme'

function subscribeDark(cb: () => void) {
  const el = document.documentElement
  const mo = new MutationObserver(cb)
  mo.observe(el, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

function getDarkSnapshot() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Observa `class="dark"` em `<html>` (next-themes / toggle manual) para forçar Recharts a
 * re-renderizar com tokens atualizados.
 */
export function useAdminChartTheme() {
  const chartKey = useSyncExternalStore(subscribeDark, getDarkSnapshot, () => 'light')
  return {
    chart: getAdminChartTheme(),
    chartKey,
  }
}
