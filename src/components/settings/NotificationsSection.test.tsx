import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationsSection } from './NotificationsSection';

const api=vi.hoisted(()=>({
  getNotificationPreferences:vi.fn(),updateNotificationPreferences:vi.fn(),
}));
vi.mock('@/services/simuladosApi',()=>({simuladosApi:api,DEFAULT_NOTIFICATION_PREFERENCES:{caderno_daily_review:true,caderno_streak:true,caderno_reta_final:true,caderno_post_triage:true}}));

it('hides unsupported reminders without loading, resetting or mutating saved preferences',()=>{
  const saved={caderno_daily_review:false,caderno_streak:true,caderno_reta_final:false,caderno_post_triage:true};
  api.getNotificationPreferences.mockResolvedValue(saved);
  render(<NotificationsSection />);
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  for(const label of ['Revisão diária do Caderno','Sequência de estudo','Reta final','Triagem pós-prova']) {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  }
  expect(api.getNotificationPreferences).not.toHaveBeenCalled();
  expect(api.updateNotificationPreferences).not.toHaveBeenCalled();
  expect(saved).toEqual({caderno_daily_review:false,caderno_streak:true,caderno_reta_final:false,caderno_post_triage:true});
});
it('preserves adjacent functional controls and provides an honest empty state',()=>{
  render(<><button>Salvar edição</button><NotificationsSection /></>);
  expect(screen.getByRole('button',{name:'Salvar edição'})).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent('Nenhum aviso automático disponível para configurar no momento.');
});
