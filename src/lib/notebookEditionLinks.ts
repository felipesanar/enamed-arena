export function notebookEditionLink(href: string, editionId: string | null, enabled: boolean): string {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.delete('edition');
  if (enabled && editionId && ['/caderno', '/caderno/insights', '/caderno/revisao', '/caderno/treino'].includes(path)) params.set('edition', editionId);
  return path + (params.size ? `?${params}` : '');
}
