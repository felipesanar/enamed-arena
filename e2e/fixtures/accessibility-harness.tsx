import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { SkipLink } from '../../src/components/SkipLink';
import { ExamHeader } from '../../src/components/exam/ExamHeader';
import { PreloadRecoveryNotice } from '../../src/components/PreloadRecoveryNotice';
import { installPreloadRecovery } from '../../src/lib/preloadRecovery';

// Isolated browser harness: real UI components, no App/auth/Supabase/analytics.
history.replaceState(null, '', '/simulados/fixture/prova');
installPreloadRecovery();
export function Harness() {
  const [time, setTime] = useState(301);
  return <><SkipLink /><p>Harness local, sem autenticação nem backend real</p>
    <ExamHeader title="Simulado de demonstração" currentQuestion={1} totalQuestions={5} timeRemaining={time} onFinalize={() => {}} />
    <main id="main-content" tabIndex={-1}><h1>Questão de demonstração</h1>
      <button onClick={() => setTime(t => t - 1)}>Avançar relógio</button>
      <button onClick={() => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))}>Simular falha de chunk</button>
    </main><PreloadRecoveryNotice /></>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
