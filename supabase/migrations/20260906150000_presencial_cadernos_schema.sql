-- Cadernos do presencial (Vermelho / Azul) — schema base.
-- Contrato congelado: docs/superpowers/specs/2026-09-06-presencial-cadernos.md
--
-- A ideia central: o caderno é só uma LENTE na montagem do esqueleto de
-- questões (buildSkeleton na edge function `presencial`). O submit, o score
-- e o finalize continuam recebendo/produzindo (question_id, option_id)
-- reais — nada disso muda. Aqui só criamos onde o mapa impresso → real fica
-- guardado, mais as duas colunas de rastreamento (sessão travada num
-- caderno; submissão gravada com qual caderno foi usado).
--
-- Convenção seguida (idêntica a 20260812100000_presencial_schema.sql): RLS
-- ligada nas tabelas novas, SEM nenhuma policy para anon/authenticated —
-- acesso só por service_role (que ignora RLS por padrão no Supabase) e por
-- RPC SECURITY DEFINER. Nenhum GRANT explícito para service_role nas
-- tabelas: o papel já tem privilégio de tabela via as default privileges do
-- schema public configuradas no projeto (mesmo padrão do arquivo acima, que
-- também não concede nada a service_role nas tabelas).

-- ─── Caderno impresso (Caderno 1 · Vermelho, Caderno 2 · Azul, ...) ───────────
CREATE TABLE IF NOT EXISTS public.presencial_cadernos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id),
  code        text NOT NULL,
  label       text NOT NULL,
  color       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presencial_cadernos_color_ck CHECK (color IN ('vermelho', 'azul')),
  CONSTRAINT presencial_cadernos_simulado_code_uq UNIQUE (simulado_id, code)
);

-- is_active só pode virar true via public.activate_caderno(), que roda as 4
-- invariantes de integridade antes de liberar (ver
-- 20260906150100_verify_caderno_map.sql e 20260906150200_activate_caderno.sql).
-- Não há CHECK aqui que imponha isso — é uma disciplina de código (só a RPC
-- de ativação e o script de importação devem escrever nesta coluna),
-- documentada também no comentário da própria activate_caderno.
COMMENT ON COLUMN public.presencial_cadernos.is_active IS
  'Só vira true via public.activate_caderno(), que verifica as 4 invariantes antes. Nunca escrever aqui diretamente.';

-- ─── Item do caderno: posição impressa → questão real + mapa de alternativas ──
CREATE TABLE IF NOT EXISTS public.presencial_caderno_items (
  caderno_id  uuid NOT NULL REFERENCES public.presencial_cadernos(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id),
  -- option_map: {"A":"<option_id>","B":"<option_id>","C":"<option_id>","D":"<option_id>"}
  -- letra IMPRESSA no caderno → id real da alternativa. A validação de forma
  -- (exatamente as 4 chaves, valores distintos, todos da mesma question_id)
  -- é feita em tempo de verificação por public.verify_caderno_map — não como
  -- CHECK de tabela, porque comparar contra question_options exige consulta
  -- a outra tabela, o que um CHECK simples não faz.
  option_map  jsonb NOT NULL,
  CONSTRAINT presencial_caderno_items_position_ck CHECK (position >= 1),
  PRIMARY KEY (caderno_id, position),
  CONSTRAINT presencial_caderno_items_caderno_question_uq UNIQUE (caderno_id, question_id)
);

-- Índice por question_id: além da PK (caderno_id, position) e do unique
-- (caderno_id, question_id) — que já cobre buscas "este caderno tem essa
-- questão?" —, um índice solto por question_id ajuda a resolver "em quais
-- cadernos essa questão aparece e em que posição", útil para auditoria e
-- para o script de importação conferir consistência entre cadernos do mesmo
-- simulado.
CREATE INDEX IF NOT EXISTS presencial_caderno_items_question_idx
  ON public.presencial_caderno_items (question_id);

-- ─── presencial_sessions: sala pode estar travada num caderno ────────────────
-- NULL = "um QR só", o front pergunta ao aluno qual caderno ele recebeu.
-- Preenchido = "um QR por cor", o front nem pergunta.
ALTER TABLE public.presencial_sessions
  ADD COLUMN IF NOT EXISTS caderno_id uuid REFERENCES public.presencial_cadernos(id);

-- ─── presencial_submissions: auditoria de qual caderno gerou aquele gabarito ──
ALTER TABLE public.presencial_submissions
  ADD COLUMN IF NOT EXISTS caderno_id uuid REFERENCES public.presencial_cadernos(id);

CREATE INDEX IF NOT EXISTS presencial_submissions_caderno_idx
  ON public.presencial_submissions (caderno_id);

-- ─── RLS: ligada, sem policy — idêntico às tabelas presenciais existentes ────
ALTER TABLE public.presencial_cadernos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencial_caderno_items  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.presencial_cadernos      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presencial_caderno_items FROM PUBLIC, anon, authenticated;
