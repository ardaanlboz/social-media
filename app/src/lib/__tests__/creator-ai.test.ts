import { describe, it, expect } from "vitest";
import { parseTopicAssignments } from "../creator-ai";

describe("parseTopicAssignments", () => {
  it("parses a plain JSON array", () => {
    const text = '[{"id": "a", "topic": "Real Estate"}, {"id": "b", "topic": "Lifestyle"}]';
    expect(parseTopicAssignments(text)).toEqual([
      { id: "a", topic: "Real Estate" },
      { id: "b", topic: "Lifestyle" },
    ]);
  });

  it("extracts the array from surrounding prose and code fences", () => {
    const text = 'Here are the topics:\n```json\n[{"id": "a", "topic": "Tips"}]\n```\nDone.';
    expect(parseTopicAssignments(text)).toEqual([{ id: "a", topic: "Tips" }]);
  });

  it("returns [] for garbage input", () => {
    expect(parseTopicAssignments("no json here")).toEqual([]);
    expect(parseTopicAssignments("[broken json")).toEqual([]);
  });

  it("filters out entries with missing id or empty topic, and trims topics", () => {
    const text = '[{"id": "a", "topic": "  Tips  "}, {"id": "b", "topic": ""}, {"topic": "X"}, {"id": "c"}]';
    expect(parseTopicAssignments(text)).toEqual([{ id: "a", topic: "Tips" }]);
  });
});
