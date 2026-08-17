import { describe, it, expect } from 'vitest';
import {
  checkGabarito,
  summarizeGabaritoFindings,
  stripMarkup,
  extractCorrectMarkings,
  extractAnswerLine,
  segmentByLetter,
  scoreSimilarity,
  type GabaritoCheckInput,
  type GabaritoFinding,
} from './gabaritoCheck';

function opts(overrides?: Partial<Record<'A' | 'B' | 'C' | 'D', string>>) {
  const base = {
    A: 'Texto genérico da alternativa A, sem relação com as demais.',
    B: 'Texto genérico da alternativa B, sem relação com as demais.',
    C: 'Texto genérico da alternativa C, sem relação com as demais.',
    D: 'Texto genérico da alternativa D, sem relação com as demais.',
  };
  const merged = { ...base, ...overrides };
  return (['A', 'B', 'C', 'D'] as const).map((label) => ({ label, text: merged[label] }));
}

function makeInput(overrides: Partial<GabaritoCheckInput>): GabaritoCheckInput {
  return {
    questionNumber: 1,
    gabarito: 'A',
    options: opts(),
    comentario: '',
    ...overrides,
  };
}

describe('stripMarkup', () => {
  it('remove tags HTML e decodifica entidades comuns', () => {
    expect(stripMarkup('<strong>Alternativa C:</strong> CORRETA')).toBe('Alternativa C: CORRETA');
    expect(stripMarkup('A&nbsp;&amp;&nbsp;B &lt;C&gt; &quot;D&quot; &#39;E&#39;')).toBe(
      'A & B <C> "D" \'E\'',
    );
  });

  it('remove marcadores de markdown e normaliza whitespace', () => {
    expect(stripMarkup('**Alternativa** _C_   é   \n\n correta')).toBe(
      'Alternativa C é correta',
    );
  });
});

describe('extractCorrectMarkings', () => {
  it('coleta apenas as letras marcadas como CORRETA, ignorando INCORRETA', () => {
    const marks = extractCorrectMarkings(
      'Alternativa A: INCORRETA. Alternativa B: CORRETA. Alternativa C: incorreta.',
    );
    expect(marks.map((m) => m.label)).toEqual(['B']);
  });

  it('casa as variantes gabarito / alternativa correta / resposta correta', () => {
    expect(extractCorrectMarkings('Gabarito: C')[0]?.label).toBe('C');
    expect(extractCorrectMarkings('Alternativa correta: B')[0]?.label).toBe('B');
    expect(extractCorrectMarkings('Resposta correta: D')[0]?.label).toBe('D');
  });
});

describe('extractAnswerLine', () => {
  it('pega a última ocorrência de "Resposta: ..."', () => {
    const text = 'Resposta: Alternativa B. Texto no meio. Resposta: Alternativa C';
    expect(extractAnswerLine(text)?.label).toBe('C');
  });

  it('ignora faixas já consumidas por S1', () => {
    const text = 'Resposta correta: C';
    const s1 = extractCorrectMarkings(text);
    expect(s1.map((m) => m.label)).toEqual(['C']);
    const s2 = extractAnswerLine(
      text,
      s1.map((m) => ({ start: m.start, end: m.end })),
    );
    expect(s2).toBeNull();
  });
});

describe('segmentByLetter', () => {
  it('fatia o comentário do marcador até o próximo marcador', () => {
    const segments = segmentByLetter(
      'Alternativa A: fala de X. Alternativa B: fala de Y. Alternativa C: fala de Z.',
    );
    expect(segments.A).toContain('fala de X');
    expect(segments.B).toContain('fala de Y');
    expect(segments.C).toContain('fala de Z');
  });
});

describe('scoreSimilarity', () => {
  it('pontua pela interseção de tokens relativos ao tamanho da alternativa (nunca NaN)', () => {
    expect(scoreSimilarity('qualquer coisa', '')).toBe(0);
    expect(
      scoreSimilarity(
        'descreve cardiopatias congenitas complexas com arritmias fetais graves',
        'cardiopatias congenitas complexas associadas a arritmias fetais graves',
      ),
    ).toBeGreaterThan(0.34);
    expect(scoreSimilarity('nada relacionado aqui', 'alguma coisa completamente diferente')).toBe(
      0,
    );
  });
});

describe('checkGabarito', () => {
  it('S6 Q49: comentário marca outra letra como CORRETA que diverge do gabarito', () => {
    // Incidente real: is_correct = B, comentário do banco dizia "Alternativa C: CORRETA".
    // 228 de 265 alunos marcaram C; 6,8% de acerto oficial. Corrigido 17/08 (ticket #30458).
    const input = makeInput({
      questionNumber: 49,
      gabarito: 'B',
      options: opts({
        A: 'Qualquer pessoa que resida no mesmo bairro da unidade de saúde.',
        B: 'Todas as pessoas do domicílio, incluindo agregados sem vínculo familiar direto.',
        C: 'Pessoas que residem no mesmo domicílio e mantêm vínculo de parentesco ou dependência direta.',
        D: 'Qualquer indivíduo cadastrado no sistema de saúde da equipe responsável pela área.',
      }),
      comentario: `
        A questão trata do limite do domicílio em uma família adscrita à equipe de saúde.
        Alternativa A: INCORRETA, pois considera qualquer pessoa do mesmo bairro da unidade de saúde, o que extrapola o conceito de domicílio compartilhado.
        Alternativa B: INCORRETA, pois inclui agregados sem vínculo familiar direto no mesmo domicílio.
        Alternativa C: CORRETA, pois define o núcleo familiar como as pessoas que residem no mesmo domicílio e mantêm vínculo de parentesco ou dependência direta.
        Alternativa D: INCORRETA, pois considera qualquer indivíduo cadastrado no sistema de saúde da equipe responsável pela área.
      `,
    });

    const findings = checkGabarito(input);
    const keyConflicts = findings.filter((f) => f.checkType === 'key_comment_conflict');
    expect(keyConflicts).toHaveLength(1);
    expect(keyConflicts[0].proposedLabel).toBe('C');
    expect(keyConflicts[0].severity).toBe('error');
  });

  it('S5 Q35: corpo e linha "Resposta:" discordam entre si (bloqueia mesmo quando gabarito concorda com um dos lados)', () => {
    // Incidente real: corpo do comentário dizia "Alternativa B: CORRETA", a
    // última linha dizia "Resposta: Alternativa C"; o banco ficou em C.
    // Corrigido 29/07.
    const input = makeInput({
      questionNumber: 35,
      gabarito: 'C',
      options: opts({
        A: 'Quadro sem febre materna isolada como critério diagnóstico.',
        B: 'Critérios clínicos e laboratoriais consistentes com o diagnóstico de corioamnionite.',
        C: 'Quadro restrito apenas à taquicardia fetal isolada.',
        D: 'Quadro que desconsidera a leucocitose materna associada.',
      }),
      comentario: `
        A questão aborda achados sugestivos de corioamnionite no trabalho de parto prematuro.
        Alternativa A: INCORRETA, pois não contempla a febre materna como critério isolado.
        Alternativa B: CORRETA, pois reúne os critérios clínicos e laboratoriais mais consistentes com o diagnóstico.
        Alternativa C: INCORRETA, pois restringe o quadro apenas à taquicardia fetal isolada.
        Alternativa D: INCORRETA, pois desconsidera a leucocitose materna associada.
        Resposta: Alternativa C
      `,
    });

    const findings = checkGabarito(input);
    const internal = findings.filter((f) => f.checkType === 'comment_internal_conflict');
    expect(internal).toHaveLength(1);
    expect(internal[0].severity).toBe('error');
    expect(internal[0].proposedLabel).toBeUndefined();
    // Regra de maior custo: dispara mesmo com o gabarito concordando com a linha "Resposta:".
    expect(findings.some((f) => f.checkType === 'key_comment_conflict')).toBe(false);
    expect(findings.some((f) => f.checkType === 'key_answer_line_conflict')).toBe(false);
  });

  it('S5 Q46: parágrafo do comentário casa melhor com outra alternativa (letras trocadas)', () => {
    // Incidente real: gabarito em C (aloimunização), comentário justificava
    // cardiopatias congênitas = D; parágrafos C/D trocados em relação ao
    // texto das alternativas. Corrigido 29/07.
    const input = makeInput({
      questionNumber: 46,
      gabarito: 'C',
      options: opts({
        A: 'Infecção congênita por toxoplasmose com calcificações cerebrais difusas ao ultrassom.',
        B: 'Restrição de crescimento fetal por insuficiência placentária tardia.',
        C: 'Aloimunização materna anti-Rh sem profilaxia adequada, levando a hemólise fetal grave.',
        D: 'Cardiopatias congênitas complexas associadas a arritmias fetais graves.',
      }),
      comentario: `
        Alternativa A: descreve infecção congênita por toxoplasmose, com calcificações cerebrais difusas ao ultrassom.
        Alternativa B: descreve restrição de crescimento fetal por insuficiência placentária tardia.
        Alternativa C: descreve cardiopatias congênitas complexas associadas a arritmias fetais graves, com necessidade de acompanhamento especializado.
        Alternativa D: descreve aloimunização materna anti-Rh sem profilaxia adequada, levando a hemólise fetal grave e necessidade de transfusão intrauterina.
      `,
    });

    const findings = checkGabarito(input);
    const misaligned = findings.find(
      (f) => f.checkType === 'option_letter_misalignment' && f.evidence.includes('Alternativa C'),
    );
    expect(misaligned).toBeDefined();
    expect(misaligned?.proposedLabel).toBe('D');
    expect(misaligned?.severity).toBe('warning');
  });

  it('comentário coerente com o gabarito não gera achados', () => {
    const input = makeInput({
      questionNumber: 2,
      gabarito: 'B',
      comentario: `
        Alternativa A: INCORRETA, pois não atende ao critério clínico principal.
        Alternativa B: CORRETA, pois atende integralmente ao critério clínico principal.
        Alternativa C: INCORRETA, pois contraria o critério clínico principal.
        Alternativa D: INCORRETA, pois é irrelevante para o critério clínico principal.
      `,
    });

    expect(checkGabarito(input)).toEqual([]);
  });

  it('comentário sem nenhuma marcação gera só key_unverifiable', () => {
    const input = makeInput({
      questionNumber: 3,
      gabarito: 'A',
      comentario:
        'Este é um tema clássico de prova e costuma ser cobrado com frequência nos exames de residência.',
    });

    const findings = checkGabarito(input);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkType).toBe('key_unverifiable');
    expect(findings[0].severity).toBe('info');
  });

  it('HTML e markdown no comentário são normalizados antes da extração (stripMarkup)', () => {
    const input = makeInput({
      questionNumber: 4,
      gabarito: 'A',
      comentario:
        '<p>Alternativa A: incorreta. <strong>Alternativa C:</strong> CORRETA. Alternativa B: incorreta. Alternativa D: incorreta.</p>',
    });

    const findings = checkGabarito(input);
    const keyConflict = findings.find((f) => f.checkType === 'key_comment_conflict');
    expect(keyConflict?.proposedLabel).toBe('C');
  });

  it('"resposta correta: C" com gabarito C não conflita consigo mesma', () => {
    const input = makeInput({
      questionNumber: 5,
      gabarito: 'C',
      comentario:
        'O quadro clínico apresentado é compatível com o diagnóstico descrito. Resposta correta: C',
    });

    expect(checkGabarito(input)).toEqual([]);
  });

  it('alternativas parafraseadas sem citação literal não geram option_letter_misalignment (piso de 0.34)', () => {
    const input = makeInput({
      questionNumber: 6,
      gabarito: 'A',
      options: opts({
        A: 'Pneumonia adquirida na comunidade em paciente idoso hospitalizado.',
        B: 'Insuficiência cardíaca descompensada com edema pulmonar agudo.',
        C: 'Embolia pulmonar maciça com instabilidade hemodinâmica.',
        D: 'Tuberculose pulmonar cavitária em paciente imunossuprimido.',
      }),
      comentario: `
        Alternativa A: é o tema mais cobrado nas provas e merece atenção redobrada do candidato.
        Alternativa B: também aparece com frequência e costuma gerar dúvida entre os candidatos.
        Alternativa C: é um assunto correlato que vale a pena revisar com calma.
        Alternativa D: fecha o rol de diagnósticos diferenciais dessa questão.
      `,
    });

    const findings = checkGabarito(input);
    expect(findings.filter((f) => f.checkType === 'option_letter_misalignment')).toEqual([]);
  });

  it('multiple_correct_marked quando mais de uma letra é marcada como CORRETA', () => {
    const input = makeInput({
      questionNumber: 7,
      gabarito: 'A',
      comentario: 'Alternativa A: CORRETA. Alternativa C: CORRETA. Alternativa D: incorreta.',
    });

    const findings = checkGabarito(input);
    const multi = findings.find((f) => f.checkType === 'multiple_correct_marked');
    expect(multi).toBeDefined();
    expect(multi?.severity).toBe('error');
    // proposedLabel é "a primeira, se houver várias" (ordem de aparição no comentário).
    expect(multi?.proposedLabel).toBe('A');
  });

  it('gabarito estruturalmente inválido não gera achados (fica para a validação estrutural)', () => {
    const input = makeInput({
      questionNumber: 8,
      gabarito: 'X',
      comentario: 'Alternativa B: CORRETA.',
    });

    expect(checkGabarito(input)).toEqual([]);
  });
});

describe('summarizeGabaritoFindings', () => {
  it('separa errors/warnings, conta unverifiable à parte e lista questões bloqueadas', () => {
    const findings: GabaritoFinding[] = [
      {
        questionNumber: 1,
        checkType: 'key_comment_conflict',
        severity: 'error',
        proposedLabel: 'C',
        what: 'x',
        how: 'y',
        evidence: 'z',
      },
      {
        questionNumber: 1,
        checkType: 'multiple_correct_marked',
        severity: 'error',
        proposedLabel: 'C',
        what: 'x',
        how: 'y',
        evidence: 'z',
      },
      {
        questionNumber: 2,
        checkType: 'option_letter_misalignment',
        severity: 'warning',
        proposedLabel: 'D',
        what: 'x',
        how: 'y',
        evidence: 'z',
      },
      {
        questionNumber: 3,
        checkType: 'key_unverifiable',
        severity: 'info',
        what: 'x',
        how: 'y',
        evidence: 'z',
      },
      {
        questionNumber: 4,
        checkType: 'key_unverifiable',
        severity: 'info',
        what: 'x',
        how: 'y',
        evidence: 'z',
      },
    ];

    const summary = summarizeGabaritoFindings(findings);
    expect(summary.errors).toHaveLength(2);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.unverifiableCount).toBe(2);
    expect(summary.blockedQuestionNumbers).toEqual([1]);
  });
});
