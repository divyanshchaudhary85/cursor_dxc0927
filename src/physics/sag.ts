/**
 * Simplified thermal-elongation sag model.
 *
 * Uses the standard parabolic-span approximation:
 *   L ≈ S + 8h² / (3S)
 * where S = span length, h = midspan sag, L = conductor length along the span.
 *
 * As the conductor heats up it elongates by ΔL = L0 * alpha * ΔT, which is
 * translated back into an increase in sag. This is a visualization-grade
 * approximation (it ignores elastic/tension effects, ice/wind loading on
 * tension, and span-to-span interaction) but captures the qualitative
 * behaviour that matters for explaining Dynamic Line Rating: hotter
 * conductor -> more sag -> less ground clearance.
 */

export interface SagParams {
  spanLength: number; // m
  referenceSagAt20C: number; // m, sag at 20 C baseline tension
  referenceTempC: number; // C
  thermalExpansionCoeff: number; // 1/C, composite ACSR ~1.7e-5 to 2.3e-5
  attachmentHeight: number; // m, height of conductor attachment point above ground
}

export const DEFAULT_SAG_PARAMS: SagParams = {
  spanLength: 350,
  referenceSagAt20C: 9.5,
  referenceTempC: 20,
  thermalExpansionCoeff: 1.9e-5,
  attachmentHeight: 27,
};

function lengthFromSag(spanLength: number, sag: number): number {
  return spanLength + (8 * sag * sag) / (3 * spanLength);
}

/** Returns midspan sag (m) at the given conductor temperature. */
export function sagAtTemperature(params: SagParams, conductorTempC: number): number {
  const { spanLength, referenceSagAt20C, referenceTempC, thermalExpansionCoeff } = params;
  const l0 = lengthFromSag(spanLength, referenceSagAt20C);
  const deltaT = conductorTempC - referenceTempC;
  const deltaL = l0 * thermalExpansionCoeff * deltaT;
  const sagSquared = referenceSagAt20C * referenceSagAt20C + ((3 * spanLength) / 8) * deltaL;
  return Math.sqrt(Math.max(sagSquared, 0));
}

/** Ground clearance at midspan (m), given a flat ground assumption. */
export function groundClearance(params: SagParams, sag: number): number {
  return params.attachmentHeight - sag;
}
