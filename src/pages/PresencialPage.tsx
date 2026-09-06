/**
 * PresencialPage — /presencial/:codigo
 *
 * Landing do QR impresso. A rota é CONGELADA (ver
 * `src/__tests__/presencialQrUrlContract.test.ts`): o QR já distribuído em
 * papel aponta para `https://simulados.sanar.com.br/presencial/:codigo` e não
 * pode mudar. O que muda é o que a página faz ao ser aberta.
 *
 * v1 (público, sem login): esta página conduzia o fluxo inteiro —
 * identificação por nome/e-mail, escolha de caderno, gabarito de bolhas,
 * resultado agregado. Ficou órfã, mas o código segue no repo porque
 * `PresencialCadernoStep`, `PresencialCadernoBanner`, `presencialCadernoColors`,
 * `PresencialIdentifyStep` e `PresencialResultStep` são reaproveitados pela
 * v2 dentro da tela de gabarito (`/simulados/:id/gabarito`).
 *
 * v2 (logado, definida pela liderança): QR → `/ranking` → login → "Fiz o
 * simulado presencialmente" → subir o gabarito. Como `/ranking` está atrás do
 * `ProtectedRoute`, basta redirecionar para lá: o login acontece naturalmente
 * no caminho, e o `ProtectedRoute` preserva o destino via `?next=` para que o
 * aluno não pare numa tela vazia depois de autenticar.
 */
import { Navigate } from 'react-router-dom';

export default function PresencialPage() {
  return <Navigate to="/ranking" replace />;
}
