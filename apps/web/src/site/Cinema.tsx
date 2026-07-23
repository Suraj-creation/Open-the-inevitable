/**
 * Cinema — real documentary imagery as the deep layer of a page's field (CDL v2 §12 asset layer).
 * Public-domain scientific cinematography (NASA) graded to the visual DNA, drifting with a slow
 * Ken-Burns camera (IMAX stillness, ~44s period), masked to dissolve into the void so text always
 * sits on calm ground. `sources` accepts future video loops (poster-first) without code change.
 * Decorative, aria-hidden; reduced-motion renders a still frame.
 */
export function Cinema({
  src,
  video,
  position = "50% 40%",
}: {
  readonly src: string;
  /** Optional motion loop (drops in when generated); the image remains the poster. */
  readonly video?: string;
  readonly position?: string;
}) {
  return (
    <div className="site-cinema" aria-hidden>
      {video ? (
        <video
          className="site-cinema-media"
          src={video}
          poster={src}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          style={{ objectPosition: position }}
        />
      ) : (
        <img
          className="site-cinema-media"
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          style={{ objectPosition: position }}
        />
      )}
      <div className="site-cinema-grade" />
    </div>
  );
}
