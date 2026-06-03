import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, mapResult, unwrap } from "../src/result";
import { CosError } from "../src/errors";

describe("Result", () => {
  it("narrows ok/err via type guards", () => {
    const good = ok(42);
    const bad = err(new CosError("E_TEST", "boom"));
    expect(isOk(good)).toBe(true);
    expect(isErr(bad)).toBe(true);
    if (isOk(good)) expect(good.value).toBe(42);
  });

  it("maps success values and passes errors through", () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual(ok(6));
    const e = err(new CosError("E_TEST", "boom"));
    expect(mapResult(e, (n: number) => n * 3)).toBe(e);
  });

  it("unwraps ok and throws on err", () => {
    expect(unwrap(ok("v"))).toBe("v");
    expect(() => unwrap(err(new CosError("E_TEST", "boom")))).toThrow(CosError);
  });
});
