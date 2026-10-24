import { describe, expect, it } from "vitest";

import {
  TASKCORE_QUESTION_RESPONSE_SCHEMA,
  TASKCORE_QUESTION_SET_SCHEMA,
  parseTaskcoreQuestionResponse,
  parseTaskcoreQuestionSet,
  type TaskcoreQuestionSet,
} from "./question-set.js";

const questionSet: TaskcoreQuestionSet = {
  schema: TASKCORE_QUESTION_SET_SCHEMA,
  title: "Release input",
  questions: [
    {
      id: "environment",
      prompt: "Where should we deploy?",
      required: true,
      answerMode: "single_select",
      options: [
        { id: "staging", label: "Staging", recommended: true },
        { id: "production", label: "Production" },
      ],
      customAnswer: { enabled: true, label: "Other" },
    },
    {
      id: "replicas",
      prompt: "How many replicas?",
      required: true,
      answerMode: "text",
      textValidation: { inputType: "integer", minimum: 1, maximum: 20 },
    },
  ],
};

describe("Taskcore question-set contract", () => {
  it("round-trips the portable presentation model", () => {
    expect(parseTaskcoreQuestionSet(questionSet)).toEqual(questionSet);
    expect(parseTaskcoreQuestionResponse(questionSet, {
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: {
        environment: { selectedOptionIds: ["staging"] },
        replicas: { text: "3" },
      },
    })).toEqual({
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: {
        environment: { selectedOptionIds: ["staging"] },
        replicas: { text: "3" },
      },
    });
  });

  it("rejects missing, unknown, and provider-shaped answers", () => {
    expect(() => parseTaskcoreQuestionResponse(questionSet, {
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: { environment: { selectedOptionIds: ["unknown"] }, replicas: { text: "3" } },
    })).toThrow(/unknown option/);
    expect(() => parseTaskcoreQuestionResponse(questionSet, {
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: { environment: { selectedOptionIds: ["staging"] } },
    })).toThrow(/replicas.*required/);
    expect(() => parseTaskcoreQuestionResponse(questionSet, {
      answers: { environment: { answers: ["Staging"] } },
    })).toThrow(/taskcore.question_response.v1/);
    expect(() => parseTaskcoreQuestionResponse(questionSet, {
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: {
        environment: { answers: ["Staging"] },
        replicas: { text: "3" },
      },
    })).toThrow(/canonical response contract/);
  });

  it("applies typed numeric validation before an adapter sees the answer", () => {
    expect(() => parseTaskcoreQuestionResponse(questionSet, {
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: {
        environment: { customText: "Canary" },
        replicas: { text: "3.5" },
      },
    })).toThrow(/valid integer/);
    expect(() => parseTaskcoreQuestionResponse(questionSet, {
      schema: TASKCORE_QUESTION_RESPONSE_SCHEMA,
      answers: {
        environment: { customText: "Canary" },
        replicas: { text: "21" },
      },
    })).toThrow(/at most 20/);
  });
});
