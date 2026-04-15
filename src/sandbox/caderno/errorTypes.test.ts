import { describe, it, expect } from "vitest";
import {
  ERROR_TYPES,
  getErrorType,
  ERROR_TYPE_KEYS,
  type ErrorTypeKey,
} from "./errorTypes";

describe("ERROR_TYPES", () => {
  it("has exactly 5 types", () => {
    expect(Object.keys(ERROR_TYPES)).toHaveLength(5);
  });

  it("each type has required fields", () => {
    for (const key of ERROR_TYPE_KEYS) {
      const t = ERROR_TYPES[key];
      expect(t.key).toBe(key);
      expect(typeof t.label).toBe("string");
      expect(typeof t.hint).toBe("string");
      expect(typeof t.strategy).toBe("string");
      expect(typeof t.colorBase).toBe("string");
      expect(typeof t.colorBg).toBe("string");
      expect(typeof t.colorBorder).toBe("string");
      expect(typeof t.colorText).toBe("string");
      expect(typeof t.dbKey).toBe("string");
    }
  });

  it("wasCorrect=false types do not include guessed_correctly", () => {
    const wrongTypes = ERROR_TYPE_KEYS.filter(
      (k) => ERROR_TYPES[k].forWrongAnswer
    );
    expect(wrongTypes).not.toContain("guessed_correctly");
    expect(wrongTypes).toHaveLength(4);
  });

  it("wasCorrect=true type is only guessed_correctly", () => {
    const correctTypes = ERROR_TYPE_KEYS.filter(
      (k) => !ERROR_TYPES[k].forWrongAnswer
    );
    expect(correctTypes).toEqual(["guessed_correctly"]);
  });
});

describe("getErrorType", () => {
  it("returns the type for a valid key", () => {
    expect(getErrorType("lacuna").label).toBe("Não sei o conceito");
  });

  it("returns undefined for unknown key", () => {
    expect(getErrorType("unknown" as ErrorTypeKey)).toBeUndefined();
  });
});
