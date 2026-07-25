import { useMemo, type CSSProperties } from "react"

const GRID = 12

function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

type Cube = {
  dur: number
  delay: number
  rise: number
  light: number
}

export function BlocksBackground() {
  const cubes = useMemo<Cube[]>(
    () =>
      Array.from({ length: GRID * GRID }, (_, i) => ({
        dur: 6 + rand(i + 1) * 7,
        delay: -rand(i + 101) * 13,
        rise: 10 + rand(i + 501) * 42,
        light: 0.11 + rand(i + 901) * 0.07,
      })),
    []
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="blocks-plane">
        {cubes.map((c, i) => (
          <div
            key={i}
            className="blocks-cube"
            style={
              {
                "--dur": `${c.dur.toFixed(2)}s`,
                "--delay": `${c.delay.toFixed(2)}s`,
                "--rise": `${c.rise.toFixed(0)}px`,
                "--face": `oklch(${c.light.toFixed(3)} 0 0)`,
              } as CSSProperties
            }
          >
            <div className="blocks-cube-top" />
            <div className="blocks-cube-s1" />
            <div className="blocks-cube-s2" />
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 75% at 50% 42%, transparent 0%, oklch(0 0 0 / 0.4) 55%, oklch(0 0 0 / 0.88) 100%)",
        }}
      />
    </div>
  )
}
