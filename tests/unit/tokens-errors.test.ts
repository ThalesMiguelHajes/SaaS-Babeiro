import { describe, expect, it } from "vitest";

import { messageFor, toDomainErrorCode } from "@/lib/errors";
import { generateToken, hashTokenForDb, isWellFormedToken } from "@/lib/tokens";

describe("tokens", () => {
  it("gera tokens de 256 bits em base64url, sempre diferentes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(isWellFormedToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("gera hash SHA-256 no formato bytea", () => {
    expect(hashTokenForDb("abc")).toBe(
      "\\xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("toDomainErrorCode", () => {
  it("usa o código de domínio lançado pelo banco", () => {
    expect(toDomainErrorCode({ code: "P0001", message: "LAST_OWNER" })).toBe("LAST_OWNER");
  });

  it("mapeia permissão negada e violação de EXCLUDE", () => {
    expect(toDomainErrorCode({ code: "42501", message: "permission denied" })).toBe("FORBIDDEN");
    expect(toDomainErrorCode({ code: "23P01", message: "conflicting key" })).toBe(
      "SLOT_UNAVAILABLE",
    );
  });

  it("nunca repassa mensagens SQL desconhecidas", () => {
    expect(toDomainErrorCode({ code: "P0001", message: "select * from x" })).toBe("UNEXPECTED");
    expect(messageFor("UNEXPECTED")).not.toMatch(/select/i);
  });
});
