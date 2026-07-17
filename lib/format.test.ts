import { describe, expect, it } from "vitest";
import { deadlineUrgency, formatDate } from "./format";

describe("formatDate", () => {
  it("formats an ISO date as TT.MM.JJJJ", () => {
    expect(formatDate("2026-07-16")).toBe("16.07.2026");
    expect(formatDate("2026-07-16T10:00:00Z")).toBe("16.07.2026");
  });
  it("passes unparseable input through", () => {
    expect(formatDate("nope")).toBe("nope");
  });
});

describe("deadlineUrgency", () => {
  it("flags overdue dates red", () => {
    expect(deadlineUrgency("2000-01-01")).toEqual({
      label: "Überfällig",
      tone: "red",
    });
  });
  it("returns null for far-future dates", () => {
    expect(deadlineUrgency("2999-01-01")).toBeNull();
  });
  it("returns null for unparseable input", () => {
    expect(deadlineUrgency("nope")).toBeNull();
  });
});
