import { describe, test } from "node:test";
import { strict as assert } from "node:assert";

import {
  CUSTOM_DIMENSION_LIMITS,
  validateCustomDimensionSpec,
} from "./ga4-spec-validation.mjs";

function dimension(overrides = {}) {
  return {
    parameter_name: "valid_parameter",
    display_name: "Valid Dimension",
    description: "A valid custom dimension.",
    ...overrides,
  };
}

describe("validateCustomDimensionSpec", () => {
  test("accepts values exactly at each Admin API length limit", () => {
    const spec = {
      event_scoped_dimensions: [
        dimension({
          parameter_name: `e${"x".repeat(CUSTOM_DIMENSION_LIMITS.parameterName.event - 1)}`,
          display_name: `D${"x".repeat(CUSTOM_DIMENSION_LIMITS.displayName - 1)}`,
          description: "x".repeat(CUSTOM_DIMENSION_LIMITS.description),
        }),
      ],
      user_scoped_dimensions: [
        dimension({
          parameter_name: `u${"x".repeat(CUSTOM_DIMENSION_LIMITS.parameterName.user - 1)}`,
        }),
      ],
    };

    assert.equal(validateCustomDimensionSpec(spec), spec);
  });

  test("aggregates description, display-name, and scope-specific parameter errors", () => {
    const spec = {
      event_scoped_dimensions: [
        dimension({
          parameter_name: `e${"x".repeat(CUSTOM_DIMENSION_LIMITS.parameterName.event)}`,
          display_name: `D${"x".repeat(CUSTOM_DIMENSION_LIMITS.displayName)}`,
          description: "x".repeat(CUSTOM_DIMENSION_LIMITS.description + 1),
        }),
        dimension({ parameter_name: "1-invalid", display_name: "Invalid-name" }),
      ],
      user_scoped_dimensions: [
        dimension({
          parameter_name: `u${"x".repeat(CUSTOM_DIMENSION_LIMITS.parameterName.user)}`,
        }),
      ],
    };

    assert.throws(
      () => validateCustomDimensionSpec(spec),
      (error) => {
        assert.match(error.message, /6 error\(s\)/);
        assert.match(error.message, /description exceeds 150 characters/);
        assert.match(error.message, /display_name exceeds 82 characters/);
        assert.match(error.message, /EVENT limit of 40 characters/);
        assert.match(error.message, /USER limit of 24 characters/);
        assert.match(error.message, /must start with an ASCII letter/);
        return true;
      },
    );
  });

  test("rejects malformed dimension groups and entries", () => {
    assert.throws(
      () =>
        validateCustomDimensionSpec({
          event_scoped_dimensions: [null],
          user_scoped_dimensions: "not-an-array",
        }),
      /event_scoped_dimensions\[0\] must be an object[\s\S]*user_scoped_dimensions must be an array/,
    );
  });
});
