export const ERROR_TYPE_KEYS = [
  "lacuna",
  "memoria",
  "atencao",
  "diferencial",
  "guessed_correctly",
] as const;

export type ErrorTypeKey = (typeof ERROR_TYPE_KEYS)[number];

export interface ErrorType {
  key: ErrorTypeKey;
  label: string;
  hint: string;
  strategy: string;
  colorBase: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  dbKey: string;
  forWrongAnswer: boolean; // true = shown when wasCorrect=false
}

export const ERROR_TYPES: Record<ErrorTypeKey, ErrorType> = {
  lacuna: {
    key: "lacuna",
    label: "Não sei o conceito",
    hint: "Nunca vi ou não domino esse assunto.",
    strategy: "Estudar do zero — Harrison, diretriz, questões comentadas.",
    colorBase: "#f43f5e",
    colorBg: "#fff1f2",
    colorBorder: "#fecdd3",
    colorText: "#be123c",
    dbKey: "did_not_know",
    forWrongAnswer: true,
  },
  memoria: {
    key: "memoria",
    label: "Sabia mas esqueci",
    hint: "Já estudei, mas não lembrei na hora.",
    strategy: "Revisão espaçada — revisitar em 1, 3 e 7 dias.",
    colorBase: "#8b5cf6",
    colorBg: "#f5f3ff",
    colorBorder: "#ddd6fe",
    colorText: "#6d28d9",
    dbKey: "did_not_remember",
    forWrongAnswer: true,
  },
  atencao: {
    key: "atencao",
    label: "Erro de leitura",
    hint: "Li errado ou marquei sem ler o enunciado completo.",
    strategy: "Técnica de prova — sublinhar palavras-chave antes de responder.",
    colorBase: "#f59e0b",
    colorBg: "#fffbeb",
    colorBorder: "#fde68a",
    colorText: "#854d0e",
    dbKey: "reading_error",
    forWrongAnswer: true,
  },
  diferencial: {
    key: "diferencial",
    label: "Confundi com outra condição",
    hint: "Sabia o assunto mas errei o diagnóstico diferencial.",
    strategy: "Estudo comparativo — tabela de diagnóstico diferencial.",
    colorBase: "#3b82f6",
    colorBg: "#eff6ff",
    colorBorder: "#bfdbfe",
    colorText: "#1d4ed8",
    dbKey: "confused_alternatives",
    forWrongAnswer: true,
  },
  guessed_correctly: {
    key: "guessed_correctly",
    label: "Acertei sem certeza",
    hint: "Acertei por exclusão ou intuição — não tenho domínio real.",
    strategy: "Tratar como lacuna — estudar para confirmar o porquê.",
    colorBase: "#eab308",
    colorBg: "#fefce8",
    colorBorder: "#fde047",
    colorText: "#854d0e",
    dbKey: "guessed_correctly",
    forWrongAnswer: false,
  },
};

export function getErrorType(key: ErrorTypeKey): ErrorType | undefined {
  return ERROR_TYPES[key];
}
