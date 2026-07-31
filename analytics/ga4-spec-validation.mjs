/**
 * Local validation for the GA4 Admin API CustomDimension contract.
 *
 * Keep these limits aligned with:
 * https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.customDimensions
 */
export const CUSTOM_DIMENSION_LIMITS = Object.freeze({
  description: 150,
  displayName: 82,
  parameterName: Object.freeze({
    event: 40,
    user: 24,
  }),
  /**
   * Per-property caps. Creation simply fails at the cap and archiving is the
   * only way back, so this is a hard ceiling rather than a budget.
   *
   * Added 2026-07-29 (issue #240): the property reached 47/50 with 9 of those
   * slots held by dimensions belonging to features retired in #205 and in the
   * 2026-05 modal removal. Nothing reported the approach to the cap, so the
   * first symptom would have been a sync failing mid-change.
   */
  perProperty: Object.freeze({
    event: 50,
    user: 25,
  }),
});

const PARAMETER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const DISPLAY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 _]*$/;

function characterLength(value) {
  return [...value].length;
}

function validateDimension(dimension, scope, index, errors) {
  const location = `${scope}_scoped_dimensions[${index}]`;
  if (!dimension || typeof dimension !== "object" || Array.isArray(dimension)) {
    errors.push(`${location} must be an object`);
    return;
  }

  const parameterName = dimension.parameter_name;
  const displayName = dimension.display_name;
  const description = dimension.description;
  const parameterLimit = CUSTOM_DIMENSION_LIMITS.parameterName[scope];

  if (typeof parameterName !== "string" || parameterName.length === 0) {
    errors.push(`${location}.parameter_name must be a non-empty string`);
  } else {
    const length = characterLength(parameterName);
    if (length > parameterLimit) {
      errors.push(
        `${location}.parameter_name exceeds the ${scope.toUpperCase()} limit ` +
          `of ${parameterLimit} characters (got ${length}): ${JSON.stringify(parameterName)}`,
      );
    }
    if (!PARAMETER_NAME_PATTERN.test(parameterName)) {
      errors.push(
        `${location}.parameter_name must start with an ASCII letter and contain only ` +
          `ASCII letters, digits, or underscores: ${JSON.stringify(parameterName)}`,
      );
    }
  }

  if (typeof displayName !== "string" || displayName.length === 0) {
    errors.push(`${location}.display_name must be a non-empty string`);
  } else {
    const length = characterLength(displayName);
    if (length > CUSTOM_DIMENSION_LIMITS.displayName) {
      errors.push(
        `${location}.display_name exceeds ${CUSTOM_DIMENSION_LIMITS.displayName} characters ` +
          `(got ${length}): ${JSON.stringify(displayName)}`,
      );
    }
    if (!DISPLAY_NAME_PATTERN.test(displayName)) {
      errors.push(
        `${location}.display_name must start with an ASCII letter and contain only ` +
          `ASCII letters, digits, spaces, or underscores: ${JSON.stringify(displayName)}`,
      );
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      errors.push(`${location}.description must be a string when provided`);
    } else {
      const length = characterLength(description);
      if (length > CUSTOM_DIMENSION_LIMITS.description) {
        errors.push(
          `${location}.description exceeds ${CUSTOM_DIMENSION_LIMITS.description} characters ` +
            `(got ${length}) for ${JSON.stringify(parameterName)}`,
        );
      }
    }
  }
}

export function validateCustomDimensionSpec(spec) {
  const errors = [];
  const groups = [
    ["event", spec?.event_scoped_dimensions],
    ["user", spec?.user_scoped_dimensions],
  ];

  for (const [scope, dimensions] of groups) {
    if (!Array.isArray(dimensions)) {
      errors.push(`spec.${scope}_scoped_dimensions must be an array`);
      continue;
    }
    dimensions.forEach((dimension, index) =>
      validateDimension(dimension, scope, index, errors),
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `GA4 CustomDimension spec validation failed (${errors.length} error(s)):\n` +
        errors.map((error) => `  - ${error}`).join("\n"),
    );
  }

  return spec;
}
