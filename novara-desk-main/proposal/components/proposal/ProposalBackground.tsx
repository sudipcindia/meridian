// Grid column lines — Figma background overlay (18 vertical + 10 horizontal rects at 5% opacity).
const GRID_SVG = `<svg preserveAspectRatio="none" width="100%" height="100%" overflow="visible" viewBox="0 0 1920 1080.06" fill="none" xmlns="http://www.w3.org/2000/svg"><g><g><rect x="0.376608" y="0.737685" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="107.277" y="0.737785" width="105.447" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="213.477" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="320.377" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="427.277" y="0.737785" width="105.447" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="533.477" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="640.377" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="747.277" y="0.737785" width="105.447" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="853.477" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="960.377" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1067.28" y="0.737785" width="105.447" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1173.48" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1280.38" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1387.28" y="0.737785" width="105.447" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1493.48" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1600.38" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1707.28" y="0.737785" width="105.447" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1813.48" y="0.737785" width="106.147" height="1078.95" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/></g><g><rect x="1919.62" y="0.376576" width="107.247" height="1919.25" transform="rotate(90 1919.62 0.376576)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="108.377" width="106.247" height="1919.25" transform="rotate(90 1919.62 108.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="215.377" width="108.247" height="1919.25" transform="rotate(90 1919.62 215.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="324.377" width="106.247" height="1919.25" transform="rotate(90 1919.62 324.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="431.377" width="108.247" height="1919.25" transform="rotate(90 1919.62 431.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="540.377" width="107.247" height="1919.25" transform="rotate(90 1919.62 540.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="648.377" width="107.247" height="1919.25" transform="rotate(90 1919.62 648.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="756.377" width="107.247" height="1919.25" transform="rotate(90 1919.62 756.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="864.377" width="107.247" height="1919.25" transform="rotate(90 1919.62 864.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/><rect x="1919.62" y="972.377" width="107.247" height="1919.25" transform="rotate(90 1919.62 972.377)" stroke="#E4EEF0" stroke-opacity="0.05" stroke-width="0.752941"/></g></g></svg>`

const MASK_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(GRID_SVG)}`

const svgRaw = `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect x="0" y="0" width="100%" height="100%" fill="url(#grad)"/>
  <defs>
    <radialGradient id="grad" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="10"
      gradientTransform="matrix(2.6107e-14 134.4 -238.93 1.8368e-7 935 -894)">
      <stop stop-color="rgba(7,80,86,0.16)" offset="0"/>
      <stop stop-color="rgba(10,53,59,0.58)" offset="0.5"/>
      <stop stop-color="rgba(13,26,31,1)" offset="1"/>
    </radialGradient>
  </defs>
</svg>`

const BG_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRaw)}`

export function ProposalBackground() {
  return (
    <>
      {/*
        Dark radial gradient base — a 1920×1080 SVG image, not a live CSS
        gradient, so it has to be explicitly sized rather than just filling
        the container. Pages locked to a fixed 16:9 box (DesktopTabletWrapper)
        never notice either way, but pages that grow taller than 16:9 for
        their own reasons (Page07/DynamicInsight's "aspectRatio as a minimum,
        not a cap" layout; Page09's non-16:9 aspect ratio) used to size this
        with `cover`, which scales an image to fully fill a taller box by
        zooming in on its centre — cropping away the gradient's own dark
        outer stop and leaving only its brighter teal-toned middle visible,
        so those specific pages rendered with a visibly wrong (too blue/
        teal) background colour despite their layout otherwise being fine.
        `100% auto` instead preserves the image's real 16:9 proportions
        (identical result to `cover` on an actual 16:9 box, so every normal
        page is unaffected) and anchors it to the top, where the gradient's
        light source actually sits — any extra height below it is simply the
        flat #0D1A1F fallback, which already equals the gradient's own
        darkest/outer stop, so the seam is invisible.
      */}
      <div
        aria-hidden="true"
        data-proposal-bg="base"
        className="absolute inset-0"
        style={{
          background: `url("${BG_SVG}") no-repeat top center / 100% auto, #0D1A1F`,
        }}
      />

      {/* Teal gradient glow — masked to organic shape from Figma. Same
          top-anchored, aspect-preserving sizing as the base layer above and
          for the same reason — `100% 100%` would otherwise stretch this
          grid-line mask pattern vertically on any page taller than 16:9. */}
      <div
        aria-hidden="true"
        data-proposal-bg="glow"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #0FAFBC 0%, rgba(15,175,188,0) 100%)',
          border: '0.753px solid rgba(228,238,240,0.05)',
          maskImage: `url("${MASK_URL}")`,
          WebkitMaskImage: `url("${MASK_URL}")`,
          maskSize: '100% auto',
          maskPosition: 'top center',
          maskRepeat: 'no-repeat',
        }}
      />
    </>
  )
}
