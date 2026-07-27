import { describe, it, expect } from "vitest";
import { buildRenderPayload } from "./renderPayload";

const simuladoRow = {
  title: "ENAMED 2026.1",
  sequence_number: 1,
  questions_count: 100,
  duration_minutes: 300,
};

describe("buildRenderPayload", () => {
  it("produces the exact contract shape (simulado block)", () => {
    const payload = buildRenderPayload(simuladoRow, []);
    expect(payload).toEqual({
      simulado: {
        title: "ENAMED 2026.1",
        sequence_number: 1,
        questions_count: 100,
        duration_minutes: 300,
      },
      questions: [],
    });
  });

  it("maps questions and options into the contract shape with correct types", () => {
    const questions = [
      {
        number: 1,
        text: "Qual a conduta?",
        image_url: null,
        options: [
          { label: "A", text: "Observar" },
          { label: "B", text: "Operar" },
        ],
      },
      {
        number: 2,
        text: "Paciente com dor torácica.",
        image_url: "https://cdn.example.com/img/2.png",
        options: [{ label: "A", text: "ECG" }],
      },
    ];

    const payload = buildRenderPayload(simuladoRow, questions);

    expect(payload.questions).toHaveLength(2);
    expect(payload.questions[0]).toEqual({
      number: 1,
      text: "Qual a conduta?",
      image_url: null,
      options: [
        { label: "A", text: "Observar" },
        { label: "B", text: "Operar" },
      ],
    });
    expect(payload.questions[1].image_url).toBe("https://cdn.example.com/img/2.png");

    // Type sanity
    expect(typeof payload.simulado.title).toBe("string");
    expect(typeof payload.simulado.sequence_number).toBe("number");
    expect(typeof payload.simulado.questions_count).toBe("number");
    expect(typeof payload.simulado.duration_minutes).toBe("number");
    expect(Array.isArray(payload.questions)).toBe(true);
    expect(Array.isArray(payload.questions[0].options)).toBe(true);
  });

  it("passes text through raw/unescaped — escaping is the render service's job", () => {
    const rawText = 'Texto com <tag>, "aspas", \\backslash, & ampersand, 100% & $valor$ e \\LaTeX{} literal.';
    const questions = [
      {
        number: 1,
        text: rawText,
        image_url: null,
        options: [{ label: "A", text: "Opção com % e _sublinhado_ crus" }],
      },
    ];

    const payload = buildRenderPayload(simuladoRow, questions);

    // Exact same string, byte for byte — no HTML-escaping, no LaTeX-escaping.
    expect(payload.questions[0].text).toBe(rawText);
    expect(payload.questions[0].options[0].text).toBe("Opção com % e _sublinhado_ crus");
  });

  it("does not mutate the input arrays/objects", () => {
    const questions = [
      { number: 1, text: "t", image_url: null, options: [{ label: "A", text: "a" }] },
    ];
    const snapshot = JSON.parse(JSON.stringify(questions));

    buildRenderPayload(simuladoRow, questions);

    expect(questions).toEqual(snapshot);
  });
});
