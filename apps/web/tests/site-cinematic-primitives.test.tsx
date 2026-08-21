import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { CinematicChapter } from "../src/site/CinematicChapter";
import { InstrumentVisual } from "../src/site/InstrumentVisual";

test("chapter retains its narrative claim without animation", () => {
  const html = renderToStaticMarkup(
    <CinematicChapter title="From information to understanding" visual="ascent">
      <p>Understanding compounds across a lifetime.</p>
    </CinematicChapter>,
  );

  expect(html).toContain("From information to understanding");
  expect(html).toContain("Understanding compounds across a lifetime.");
  expect(html).toContain("data-cinematic-chapter");
});

test("instrument visuals are decorative", () => {
  expect(renderToStaticMarkup(<InstrumentVisual visual="topology" />)).toContain(
    'aria-hidden="true"',
  );
});
