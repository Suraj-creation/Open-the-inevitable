import { describe, expect, it } from "vitest";
import { MISCONCEPTION_TARGET, reteaches } from "../../src/tier-r-score.js";

/**
 * The behavioural C-R3 detector is a verifier, so its error is measured, not assumed (constitution:
 * verifiers have measured error). Audit set: 7 explanations real models (and the scripted tutor)
 * actually produced in S1 runs, plus 17 written alongside the detector to cover acknowledgements and
 * near misses. Small and not independent of the detector: the verdict says so.
 */
const RETEACH: readonly string[] = [
  // Real outputs (S1 spikes and battery runs).
  "Good try! A lot of people get 2/5 by adding the tops (1+1) and the bottoms (2+3). Unfortunately that doesn't work. Here's a quick check: 1/2 is already half, so adding 1/3 must give more than half. But 2/5 is less than half! The key idea: you can only add fractions when the pieces are the same size, meaning the same denominator. Steps for 1/2 + 1/3: 1. Find a common denominator.",
  "Let's go through a worked example to understand why we find a common denominator when adding fractions. For example, to add 1/2 and 1/3, we find a common denominator (6), convert each fraction (1/2 = 3/6, 1/3 = 2/6), and then add the numerators: 3/6 + 2/6 = 5/6. This shows why we don't simply add the denominators.",
  "Let's learn how to add fractions with unlike denominators. To add these fractions, first find a common denominator, which is a number both denominators can divide into. Then convert each fraction to an equivalent fraction with this common denominator. Finally, add the numerators and keep the common denominator.",
  "Let's look at a worked example to understand why we find a common denominator when adding fractions. For example, to add 1/2 and 1/3, we find a common denominator (6), convert each fraction (1/2 = 3/6, 1/3 = 2/6), then add the numerators: 3 + 2 = 5, so the answer is 5/6. This shows why we don't add denominators directly.",
  "Nice try! A lot of people add the tops and the bottoms separately, but that doesn't work for fractions. Here's a quick check: 1/2 + 1/3 has to be MORE than 1/2, yet 2/5 is less than 1/2. The bottom number (denominator) tells you the size of the pieces.",
  "To add fractions with unlike denominators, first find a common denominator, usually the least common denominator (LCD). Then convert each fraction to an equivalent fraction with the LCD as the denominator. Finally, add the numerators and keep the denominator the same. Simplify the result if possible.",
  "To add fractions with unlike denominators, first rewrite both over a common denominator, then add only the numerators. Example: 1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
  // Written alongside the detector.
  "Remember: never add the denominators. First find a common denominator, then add the numerators.",
  "Let's review: to add 1/4 + 1/3, find the least common denominator 12, convert to 3/12 + 4/12, then add the numerators to get 7/12.",
  "Quick reminder that the bottoms are not added — only the tops, once the pieces are the same size.",
  "Fractions need same-size pieces, so we can't add the denominators; rewrite both over 12 first.",
  "Adding the tops and the bottoms separately gives the wrong answer. Instead, use a common denominator.",
  "Great question! Remember: we never add the denominators. First rewrite both fractions over a common denominator, then add only the numerators.",
  "Right. Here's how it works: find the least common denominator, convert each fraction, and add the numerators.",
];

const ENGAGES: readonly string[] = [
  "You're right, you don't add the denominators. The slip was 2 × 3: let's check that multiplication step together.",
  "Thanks for clarifying! Since the issue was copying the 6 wrong, let's slow down on the multiplication: 2 × 6 = 12.",
  "Got it: your method is fine and the error was in the times table. Let's practise 4 × 3 = 12 and 2 × 6 = 12.",
  "I misread your earlier answer as adding denominators; it was a multiplication slip. Here is a quick check of 3 × 4.",
  "Great, so the only issue was the multiplication. Let's do one more and double-check each product.",
  "As you said, you keep the common denominator; the mistake was multiplying 2 by 3. Let's verify that step.",
  "When you convert 1/2 to sixths, multiply both top and bottom by 3: 1 × 3 = 3 and 2 × 3 = 6. Check each product carefully.",
  "Nice work on the method. To avoid copying errors, write each step down: 1/4 = 3/12, 1/3 = 4/12, then 3 + 4 = 7.",
  "You clearly know not to add the denominators, so let's focus on the multiplication facts.",
  "Good catch that we never add the bottoms; your slip was 6 × 2.",
];

describe("behavioural C-R3 detector (measured error)", () => {
  it("agrees with every label in the audit set", () => {
    const misses = RETEACH.filter((t) => !reteaches(t));
    const falseAlarms = ENGAGES.filter((t) => reteaches(t));
    expect({ misses, falseAlarms }).toEqual({ misses: [], falseAlarms: [] });
    expect(RETEACH.length + ENGAGES.length).toBe(24);
  });

  it("documents why v1 was replaced: it missed most real remediation", () => {
    const realOutputs = RETEACH.slice(0, 7);
    const v1Hits = realOutputs.filter((t) => MISCONCEPTION_TARGET.test(t)).length;
    expect(v1Hits).toBeLessThan(realOutputs.length / 2);
  });
});
