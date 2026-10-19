import { describe, it, expect } from "vitest";
import {
  generateOtpCode,
  generateToken,
  sha256Hex,
  hashOtpCode,
  constantTimeEqual,
  buildWhatsAppOtpPayload,
  isUserSideWhatsAppError,
} from "./otp";

describe("generateOtpCode", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it("is not constant", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateOtpCode());
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe("generateToken", () => {
  it("returns 64 hex characters and differs each time", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashing", () => {
  it("sha256Hex matches the known SHA-256 of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashOtpCode is stable for the same row and code", async () => {
    expect(await hashOtpCode("row-1", "123456")).toBe(await hashOtpCode("row-1", "123456"));
  });

  it("hashOtpCode differs for another code or another row", async () => {
    const base = await hashOtpCode("row-1", "123456");
    expect(await hashOtpCode("row-1", "123457")).not.toBe(base);
    expect(await hashOtpCode("row-2", "123456")).not.toBe(base);
  });
});

describe("constantTimeEqual", () => {
  it("is true only for identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("buildWhatsAppOtpPayload", () => {
  it("builds an authentication-template message with the code in body and button", () => {
    const p = buildWhatsAppOtpPayload("9876543210", "482913", "lf_otp", "en");
    expect(p.messaging_product).toBe("whatsapp");
    expect(p.to).toBe("919876543210");
    expect(p.type).toBe("template");
    expect(p.template.name).toBe("lf_otp");
    expect(p.template.language.code).toBe("en");
    const [body, button] = p.template.components;
    expect(body).toEqual({ type: "body", parameters: [{ type: "text", text: "482913" }] });
    expect(button).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "482913" }],
    });
  });
});

describe("isUserSideWhatsAppError", () => {
  it("treats 'cannot be delivered' as the person's problem, other codes as ours", () => {
    expect(isUserSideWhatsAppError(131026)).toBe(true);
    expect(isUserSideWhatsAppError(131030)).toBe(false); // app not live / number not on test list
    expect(isUserSideWhatsAppError(190)).toBe(false);    // bad access token
    expect(isUserSideWhatsAppError(undefined)).toBe(false);
  });
});
