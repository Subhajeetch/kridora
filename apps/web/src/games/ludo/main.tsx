import type { LudoColor, LudoGameState, LudoPlayerState } from "@kridora/shared"
import { getLudoTrackSquare, LUDO_COLOR_STARTS, LUDO_STAR_SQUARES, LUDO_TRACK_COORDINATES } from "@kridora/shared"
import { motion } from "framer-motion"
import { UserRound, Volume2, VolumeX } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useAudioSettings, updateAudioSettings } from "@/lib/audio-settings"
import { describeError, request } from "@/lib/socket"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/providers/realtime-context"
import type { GameComponentProps } from "../types"
import { playLudoSound } from "./sounds"

const COLORS: Record<LudoColor, { main: string; pale: string; deep: string; label: string }> = {
  coral: { main: "#f51d38", pale: "#ffe0e4", deep: "#9f1025", label: "Red" },
  mint: { main: "#119b37", pale: "#d8f4df", deep: "#14602a", label: "Green" },
  sunshine: { main: "#ffd51b", pale: "#fff4c2", deep: "#927000", label: "Yellow" },
  sky: { main: "#1599e8", pale: "#d7efff", deep: "#105a8a", label: "Blue" },
}

const COLOR_SEATS: LudoColor[] = ["coral", "mint", "sunshine", "sky"]
const CELL = 40
const BOARD_TRACK = LUDO_TRACK_COORDINATES

const HOME_YARDS: Record<LudoColor, Array<[number, number]>> = {
  coral: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  mint: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  sunshine: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  sky: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
}

const HOME_LANES: Record<LudoColor, Array<[number, number]>> = {
  coral: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  mint: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  sunshine: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  sky: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
}

const START_SQUARES = Object.fromEntries(
  COLOR_SEATS.map((color) => [color, BOARD_TRACK[LUDO_COLOR_STARTS[color]]]),
) as Record<LudoColor, readonly [number, number]>
const SAFE_INDICES = LUDO_STAR_SQUARES
const STAR = "M0 -11 L2.8 -3.5 L10.5 -3.5 L4.2 1.2 L6.5 9 L0 4.5 L-6.5 9 L-4.2 1.2 L-10.5 -3.5 L-2.8 -3.5 Z"
const START_ARROWS: Array<{ column: number; row: number; rotation: number }> = [
  { column: 0, row: 7, rotation: 0 },
  { column: 7, row: 0, rotation: 90 },
  { column: 14, row: 7, rotation: 180 },
  { column: 7, row: 14, rotation: 270 },
]
function cellCenter([column, row]: readonly [number, number]): [number, number] {
  return [column * CELL + CELL / 2, row * CELL + CELL / 2]
}

function getTokenCellAt(color: LudoColor, tokenIndex: number, progress: number): readonly [number, number] {
  if (progress < 0) return HOME_YARDS[color][tokenIndex]
  if (progress <= 51) return BOARD_TRACK[getLudoTrackSquare(color, progress) ?? 0]!
  return HOME_LANES[color][Math.min(5, progress - 52)]!
}

function getTokenCell(player: LudoPlayerState, tokenIndex: number): readonly [number, number] {
  return getTokenCellAt(player.color, tokenIndex, player.tokens[tokenIndex])
}

type DragState = {
  tokenId: string
  tokenIndex: number
  playerId: string
  color: LudoColor
  x: number
  y: number
  startClientX: number
  startClientY: number
  pointerId: number
}
type BoardPosition = readonly [number, number]
type MovementPath = { id: number; points: BoardPosition[]; step: number; launchFrom?: BoardPosition }

function houseAt(column: number, row: number): LudoColor | null {
  if (column < 6 && row < 6) return "coral"
  if (column > 8 && row < 6) return "mint"
  if (column > 8 && row > 8) return "sunshine"
  if (column < 6 && row > 8) return "sky"
  return null
}

function LudoToken({ x, y, color, rotation, movable = false, dragging = false, dragPreview = false, movementPath, stackScale = 1, onPointerDown, onMove, label }: {
  x: number
  y: number
  color: LudoColor
  rotation: number
  movable?: boolean
  dragging?: boolean
  dragPreview?: boolean
  movementPath?: MovementPath
  stackScale?: number
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void
  onMove?: () => void
  label: string
}) {
  const fill = COLORS[color]
  const center = 20
  const radians = rotation * Math.PI / 180
  const liftX = -13 * Math.sin(radians)
  const liftY = -13 * Math.cos(radians)
  const landX = 2 * Math.sin(radians)
  const landY = 2 * Math.cos(radians)
  const launchX = movementPath?.launchFrom ? movementPath.launchFrom[0] - x : 0
  const launchY = movementPath?.launchFrom ? movementPath.launchFrom[1] - y : 0
  const isLaunching = Boolean(movementPath?.launchFrom)
  return (
    <svg
      x={x - center}
      y={y - center}
      width="40"
      height="40"
      viewBox="0 0 40 40"
      style={{
        opacity: dragging && !dragPreview ? 0.28 : undefined,
        filter: dragPreview ? "drop-shadow(0 4px 4px #0008)" : undefined,
        touchAction: "none",
        overflow: "visible",
      }}
      role={movable ? "button" : undefined}
      tabIndex={movable ? 0 : undefined}
      aria-label={label}
      className={movable ? (dragging ? "cursor-grabbing" : "cursor-grab") : "pointer-events-none"}
      onPointerDown={movable ? onPointerDown : undefined}
      onKeyDown={movable ? (event) => { if (event.key === "Enter" || event.key === " ") onMove?.() } : undefined}
    >
      <motion.g
        key={movementPath ? `${movementPath.id}:${movementPath.step}` : "piece-rest"}
        initial={movementPath ? {
          x: isLaunching ? launchX : 0,
          y: isLaunching ? launchY : 0,
          scaleX: isLaunching ? 0.82 : 0.9,
          scaleY: isLaunching ? 0.9 : 1.08,
        } : false}
        animate={movementPath ? {
          x: isLaunching ? [launchX, 0] : [0, liftX, landX, 0],
          y: isLaunching ? [launchY, 0] : [0, liftY, landY, 0],
          scaleX: isLaunching ? [0.82 * stackScale, stackScale] : [0.9 * stackScale, 1.08 * stackScale, 0.88 * stackScale, stackScale],
          scaleY: isLaunching ? [0.9 * stackScale, stackScale] : [1.08 * stackScale, 1.18 * stackScale, 0.84 * stackScale, stackScale],
        } : { x: 0, y: 0, scaleX: stackScale, scaleY: stackScale }}
        transition={movementPath ? { duration: 0.25, ease: [0.2, 0.8, 0.25, 1] } : { duration: 0 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <g transform={`rotate(${-rotation} ${center} ${center})`}>
          {movable && <circle cx={center} cy={center} r="19" fill={fill.main} opacity=".2" className="animate-pulse" />}
          <g transform={`translate(${center} ${center}) scale(1.2) translate(${-center} ${-center})`}>
            <ellipse cx={center} cy={center + 11} rx="12" ry="4.5" fill="#000" opacity=".3" />
            <ellipse cx={center} cy={center + 8} rx="12" ry="4.5" fill={fill.deep} stroke="#20242a" strokeWidth="1.8" />
            <path d={`M ${center - 8} ${center + 7} Q ${center - 8} ${center + 3} ${center - 5} ${center} L ${center - 5} ${center - 4} L ${center + 5} ${center - 4} L ${center + 5} ${center} Q ${center + 8} ${center + 3} ${center + 8} ${center + 7} Q ${center} ${center + 12} ${center - 8} ${center + 7} Z`} fill={fill.main} stroke="#20242a" strokeWidth="1.8" />
            <circle cx={center} cy={center - 6} r="11" fill={fill.main} stroke="#20242a" strokeWidth="1.8" />
            <circle cx={center} cy={center - 6} r="6.5" fill={fill.pale} stroke="#fff" strokeWidth="1.6" />
            <circle cx={center} cy={center - 6} r="3.4" fill={fill.main} />
            <ellipse cx={center - 4} cy={center - 10} rx="2.4" ry="1.4" fill="#fff" opacity=".65" />
          </g>
        </g>
      </motion.g>
    </svg>
  )
}

function LudoBoard({ state, userId, onMove, rotation, busy, audio }: { state: LudoGameState; userId: string; onMove: (tokenIndex: number) => void; rotation: number; busy: boolean; audio: ReturnType<typeof useAudioSettings> }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [movementPaths, setMovementPaths] = useState<Record<string, MovementPath>>({})
  const previousProgress = useRef<Map<string, number> | null>(null)
  const movementTimers = useRef(new Map<string, number[]>())
  const movementSequence = useRef(0)
  const activePlayer = state.players[state.currentPlayerIndex]

  const pointerToBoardPoint = (clientX: number, clientY: number): BoardPosition | null => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    const rotatedX = (clientX - rect.left) * 600 / rect.width
    const rotatedY = (clientY - rect.top) * 600 / rect.height
    const radians = -rotation * Math.PI / 180
    const dx = rotatedX - 300
    const dy = rotatedY - 300
    return [300 + dx * Math.cos(radians) - dy * Math.sin(radians), 300 + dx * Math.sin(radians) + dy * Math.cos(radians)]
  }

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>, player: LudoPlayerState, tokenIndex: number) => {
    if (busy || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointerToBoardPoint(event.clientX, event.clientY)
    if (!point) return
    const nextDrag = {
      tokenId: `${player.userId}:${tokenIndex}`,
      tokenIndex,
      playerId: player.userId,
      color: player.color,
      x: point[0],
      y: point[1],
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerId: event.pointerId,
    }
    dragRef.current = nextDrag
    setDrag(nextDrag)
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = dragRef.current
    if (!current || event.pointerId !== current.pointerId) return
    const point = pointerToBoardPoint(event.clientX, event.clientY)
    if (!point) return
    const nextDrag = { ...current, x: point[0], y: point[1] }
    dragRef.current = nextDrag
    setDrag(nextDrag)
  }

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = dragRef.current
    if (!current || event.pointerId !== current.pointerId) return
    const player = state.players.find((candidate) => candidate.userId === current.playerId)
    const progress = player?.tokens[current.tokenIndex]
    const didDrag = Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY) > 7
    const point = pointerToBoardPoint(event.clientX, event.clientY)
    const nextProgress = progress === undefined ? null : progress < 0 ? 0 : progress + (state.dice ?? 0)
    const destination = nextProgress === null || nextProgress < 0 || nextProgress > 57
      ? null
      : getTokenCellAt(current.color, current.tokenIndex, nextProgress)
    const landedOnDestination = Boolean(point && destination
      && Math.floor(point[0] / CELL) === Math.floor(destination[0])
      && Math.floor(point[1] / CELL) === Math.floor(destination[1]))

    dragRef.current = null
    setDrag(null)
    if (!busy && (!didDrag || landedOnDestination)) onMove(current.tokenIndex)
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
  }

  const cancelDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDrag(null)
  }

  useLayoutEffect(() => {
    const nextProgress = new Map<string, number>()
    for (const player of state.players) {
      player.tokens.forEach((progress, tokenIndex) => nextProgress.set(`${player.userId}:${tokenIndex}`, progress))
    }
    const previous = previousProgress.current
    previousProgress.current = nextProgress
    if (!previous) return

    const moved = state.players.flatMap((player) => player.tokens.flatMap((progress, tokenIndex) => {
      const id = `${player.userId}:${tokenIndex}`
      const oldProgress = previous.get(id)
      if (oldProgress === undefined || progress < 0 || progress <= oldProgress) return []
      const from = cellCenter(getTokenCellAt(player.color, tokenIndex, oldProgress))
      const points: BoardPosition[] = [from]
      for (let step = oldProgress < 0 ? 0 : oldProgress + 1; step <= progress; step += 1) {
        points.push(cellCenter(getTokenCellAt(player.color, tokenIndex, step)))
      }
      return [{ id, oldProgress, progress, points }]
    }))[0]

    if (!moved || moved.points.length < 2) return

    const steps = moved.points.length - 1
    const launchFrom = moved.oldProgress < 0 ? moved.points[0] : undefined
    const initialStep = launchFrom ? 1 : 0
    const animationId = ++movementSequence.current
    const previousTimers = movementTimers.current.get(moved.id)
    previousTimers?.forEach((timer) => window.clearTimeout(timer))
    if (launchFrom) playLudoSound("unlock", audio)
    setMovementPaths((paths) => ({ ...paths, [moved.id]: {
      id: animationId,
      points: moved.points,
      step: initialStep,
      ...(launchFrom ? { launchFrom } : {}),
    } }))
    const timers: number[] = []
    for (let step = initialStep + 1; step <= steps; step += 1) {
      timers.push(window.setTimeout(() => {
        playLudoSound(step === steps && moved.progress === 57 && !state.winnerId ? "home" : "step", audio)
        setMovementPaths((paths) => {
          const active = paths[moved.id]
          if (!active || active.id !== animationId) return paths
          return { ...paths, [moved.id]: { id: active.id, points: active.points, step } }
        })
      }, (step - initialStep) * 250))
    }
    timers.push(window.setTimeout(() => {
      setMovementPaths((paths) => {
        if (paths[moved.id]?.id !== animationId) return paths
        const next = { ...paths }
        delete next[moved.id]
        return next
      })
      movementTimers.current.delete(moved.id)
    }, (steps - initialStep) * 250 + 270))
    movementTimers.current.set(moved.id, timers)
  }, [audio, state.players, state.updatedAt])

  useEffect(() => () => {
    for (const timers of movementTimers.current.values()) timers.forEach((timer) => window.clearTimeout(timer))
    movementTimers.current.clear()
  }, [])

  const draggedPlayer = drag ? state.players.find((player) => player.userId === drag.playerId) : undefined
  const draggedProgress = draggedPlayer?.tokens[drag?.tokenIndex ?? -1]
  const dropProgress = draggedProgress === undefined ? null : draggedProgress < 0 ? 0 : draggedProgress + (state.dice ?? 0)
  const dropCell = drag && dropProgress !== null && dropProgress >= 0 && dropProgress <= 57
    ? getTokenCellAt(drag.color, drag.tokenIndex, dropProgress)
    : null
  const visibleTokens = state.players.flatMap((player) => player.tokens.flatMap((progress, tokenIndex) => {
    if (progress < 0) return []
    const id = `${player.userId}:${tokenIndex}`
    const movementPath = movementPaths[id]
    const cell = movementPath?.points[movementPath.step] ?? cellCenter(getTokenCell(player, tokenIndex))
    return [{ id, player, tokenIndex, movementPath, cell }]
  }))
  const stacks = new Map<string, typeof visibleTokens>()
  for (const token of visibleTokens) {
    const key = `${token.cell[0]}:${token.cell[1]}`
    const stack = stacks.get(key) ?? []
    stack.push(token)
    stacks.set(key, stack)
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 600"
      role="img"
      aria-label="Square Ludo board with all four colored houses"
      className="block aspect-square w-full touch-none"
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
    >
      <defs>
        <filter id="boardGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#24e9ff" floodOpacity=".28" />
        </filter>
      </defs>

      <rect x="3" y="3" width="594" height="594" rx="2" fill="#fff" stroke="#65f2ff" strokeWidth="5" filter="url(#boardGlow)" />

      <g transform={`rotate(${rotation} 300 300)`}>

      {Array.from({ length: 15 }, (_, row) => Array.from({ length: 15 }, (_, column) => {
        const house = houseAt(column, row)
        const road = !house && (column >= 6 && column <= 8 || row >= 6 && row <= 8)
        const startColor = COLOR_SEATS.find((color) => START_SQUARES[color][0] === column && START_SQUARES[color][1] === row)
        const lane = row === 7 && column <= 5 ? "coral"
          : column === 7 && row <= 5 ? "mint"
            : row === 7 && column >= 9 ? "sunshine"
              : column === 7 && row >= 9 ? "sky" : null
        const color = lane ? COLORS[lane] : null
        const x = column * CELL
        const y = row * CELL
        return (
          <rect
            key={`cell-${column}-${row}`}
            x={x}
            y={y}
            width={CELL}
            height={CELL}
            fill={house ? COLORS[house].main : startColor ? COLORS[startColor].main : color ? color.main : road ? "#fff" : "#fff"}
            stroke="#111820"
            strokeWidth="1.25"
          />
        )
      }))}

      {COLOR_SEATS.map((color) => {
        const player = state.players.find((candidate) => candidate.color === color)
        const coords = color === "coral" ? [0, 0] : color === "mint" ? [360, 0] : color === "sunshine" ? [360, 360] : [0, 360]
        const [x, y] = coords
        const house = COLORS[color]
        return (
          <g key={`house-${color}`}>
            <rect x={x + 40} y={y + 40} width="160" height="160" rx="14" fill={house.pale} stroke="#111820" strokeWidth="1.4" />
            {HOME_YARDS[color].map((cell, tokenIndex) => {
              const progress = player?.tokens[tokenIndex]
              if (progress !== undefined && progress < 0) return null
              const [centerX, centerY] = cellCenter(cell)
              return <circle key={`nest-${color}-${tokenIndex}`} cx={centerX} cy={centerY} r="16" fill="#fff" fillOpacity=".8" stroke={house.main} strokeOpacity=".5" strokeWidth="1.8" />
            })}
            {player?.tokens.map((progress, tokenIndex) => {
              if (progress >= 0) return null
              const [centerX, centerY] = cellCenter(HOME_YARDS[color][tokenIndex]!)
              const canMove = player.userId === userId && state.players[state.currentPlayerIndex]?.userId === userId && state.movableTokens.includes(tokenIndex)
              return <LudoToken
                key={`yard-${player.userId}-${tokenIndex}`}
                x={centerX}
                y={centerY}
                color={color}
                rotation={rotation}
                label={`${player.name} piece ${tokenIndex + 1}`}
                movable={canMove}
                onPointerDown={(event) => beginDrag(event, player, tokenIndex)}
                onMove={() => onMove(tokenIndex)}
              />
            })}
          </g>
        )
      })}

      {Object.entries(HOME_LANES).map(([colorName, cells]) => {
        const color = colorName as LudoColor
        return cells.map((cell, index) => {
          const [x, y] = cellCenter(cell)
          return <rect key={`home-lane-${color}-${index}`} x={x - 18} y={y - 18} width="36" height="36" fill={COLORS[color].main} stroke="#111820" strokeWidth="1.1" />
        })
      })}

      <path d="M240 240 L360 240 L300 300 Z" fill={COLORS.mint.main} stroke="#111820" strokeWidth="1.5" />
      <path d="M360 240 L360 360 L300 300 Z" fill={COLORS.sunshine.main} stroke="#111820" strokeWidth="1.5" />
      <path d="M360 360 L240 360 L300 300 Z" fill={COLORS.sky.main} stroke="#111820" strokeWidth="1.5" />
      <path d="M240 360 L240 240 L300 300 Z" fill={COLORS.coral.main} stroke="#111820" strokeWidth="1.5" />

      {SAFE_INDICES.map((index) => {
        const [x, y] = cellCenter(BOARD_TRACK[index]!)
        return <path key={`safe-${index}`} d={STAR} transform={`translate(${x} ${y}) scale(1.05)`} fill="#fff" stroke="#111820" strokeWidth="1" />
      })}

      {START_ARROWS.map(({ column, row, rotation: arrowRotation }) => {
        const [x, y] = cellCenter([column, row])
        const arrowPath = "M -14 -3 H 3 V -9 L 15 0 L 3 9 V 3 H -14 Z"
        return (
          <g key={`arrow-${column}-${row}`} transform={`translate(${x} ${y}) rotate(${arrowRotation})`}>
            <path d={arrowPath} fill="#fff" stroke="#101c28" strokeOpacity=".6" strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        )
      })}

      {dropCell && drag && !busy && (
        <rect
          x={dropCell[0] * CELL + 2}
          y={dropCell[1] * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          rx="3"
          fill={COLORS[drag.color].main}
          fillOpacity=".22"
          stroke={COLORS[drag.color].main}
          strokeWidth="2.5"
          pointerEvents="none"
        />
      )}

      {visibleTokens.map(({ id: tokenId, player, tokenIndex, movementPath, cell }) => {
        const [baseX, baseY] = cell
        const stack = stacks.get(`${cell[0]}:${cell[1]}`) ?? []
        const stackIndex = stack.findIndex((token) => token.id === tokenId)
        const columns = stack.length
        const offsetX = stack.length > 1 ? (stackIndex - (columns - 1) / 2) * CELL / columns : 0
        const offsetY = 0
        const stackScale = stack.length > 1
          ? 0.82 * Math.min(CELL / columns / 30, CELL / 36)
          : 1
        const x = baseX + offsetX
        const y = baseY + offsetY
        const canMove = player.userId === userId && player.userId === activePlayer?.userId && state.movableTokens.includes(tokenIndex)
        return (
          <LudoToken
            key={`piece-${tokenId}`}
            x={x}
            y={y}
            movementPath={movementPath}
            stackScale={stackScale}
            color={player.color}
            rotation={rotation}
            movable={canMove}
            dragging={drag?.tokenId === tokenId}
            label={`Move ${player.name}'s piece ${tokenIndex + 1}`}
            onPointerDown={(event) => beginDrag(event, player, tokenIndex)}
            onMove={() => onMove(tokenIndex)}
          />
        )
      })}

      {drag && (
        <LudoToken
          x={drag.x}
          y={drag.y}
          color={drag.color}
          rotation={rotation}
          dragPreview
          label={`Dragging ${draggedPlayer?.name ?? "player"}'s piece ${drag.tokenIndex + 1}`}
        />
      )}
      </g>
    </svg>
  )
}

const DIE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function DiceFace({ value, color, disabled, current, onClick, playerName }: {
  value: number
  color: LudoColor
  disabled: boolean
  current: boolean
  onClick: () => void
  playerName: string
}) {
  return (
    <button
      type="button"
      aria-label={`${playerName} dice${current && !disabled ? ", roll" : ""}`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-[52px] grid-cols-3 grid-rows-3 gap-0.5 rounded-xl border-[2px] border-[#d6b647] bg-gradient-to-br from-white to-[#e8e4e3] p-1.5 shadow-[0_3px_10px_#0008] transition-transform sm:size-[60px] sm:rounded-2xl sm:p-2",
        current && !disabled && "cursor-pointer shadow-[0_0_18px_#e8ff00,0_3px_10px_#0008] hover:-translate-y-1",
        disabled && "cursor-default opacity-65",
      )}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className="grid place-items-center">
          {DIE_PIPS[value]?.includes(index) && <span className="size-2.5 rounded-full bg-[#20242a] shadow-inner" />}
        </span>
      ))}
      <span className="sr-only">{COLORS[color].label}</span>
    </button>
  )
}

function PlayerPanel({ player, seatColor, seatIndex, state, userId, onRoll, busy }: {
  player: LudoPlayerState | undefined
  seatColor: LudoColor
  seatIndex: number
  state: LudoGameState
  userId: string
  onRoll: () => void
  busy: boolean
}) {
  const color = player?.color ?? seatColor
  const playerIndex = player ? state.players.findIndex((candidate) => candidate.userId === player.userId) : -1
  const active = playerIndex === state.currentPlayerIndex && !state.winnerId
  const canRoll = active && player?.userId === userId && state.dice === null && !busy
  const value = playerIndex >= 0 ? state.lastRolls[playerIndex] ?? 1 : 1
  const onLeft = seatIndex === 0 || seatIndex === 3
  return (
    <div className={cn(
      "flex min-w-0 items-center gap-2 rounded-2xl border bg-[#102238]/95 p-2 shadow-[0_8px_22px_#0005] transition-all sm:gap-2.5 sm:p-2.5",
      onLeft ? "flex-row" : "flex-row-reverse",
      active ? "border-[#ffe15a] shadow-[0_0_18px_#ffd83a55,0_8px_22px_#0005]" : "border-white/15",
      !player && "opacity-70",
    )}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/70 shadow-inner sm:size-11" style={{ background: `linear-gradient(145deg, ${COLORS[color].pale}, ${COLORS[color].main})`, color: COLORS[color].deep }}>
        <UserRound className="size-6" strokeWidth={2.3} />
      </span>
      <div className={cn("min-w-0 flex-1", onLeft ? "text-left" : "text-right")}>
        <p className="truncate text-xs font-extrabold leading-tight text-white sm:text-sm">{player?.name ?? "Open"}</p>
        <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300/70 sm:text-[10px]">
          {player?.userId === userId ? "You" : player ? `${player.tokens.filter((progress) => progress === 57).length}/4 home` : COLORS[color].label}
        </p>
      </div>
      <DiceFace value={value} color={color} current={canRoll} disabled={!canRoll} onClick={onRoll} playerName={player?.name ?? "Open"} />
    </div>
  )
}

export default function Ludo({ room, userId }: GameComponentProps) {
  const { socket } = useRealtime()
  const audio = useAudioSettings()
  const [state, setState] = useState<LudoGameState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSoundState = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    const receive = (next: LudoGameState) => {
      if (!alive) return
      setState(next)
      if (lastSoundState.current !== null && next.updatedAt !== lastSoundState.current) {
        if (next.winnerId) playLudoSound("win", audio)
        else if (next.lastAction.includes("sent a rival")) playLudoSound("capture", audio)
        else if (next.lastAction.includes("rolled a")) playLudoSound("roll", audio)
      }
      lastSoundState.current = next.updatedAt
    }
    socket.on("ludo:state", receive)
    request("ludo:get-state", {}).then(receive).catch((err: unknown) => {
      if (alive) setError(describeError(err))
    })
    return () => {
      alive = false
      socket.off("ludo:state", receive)
    }
  }, [audio, room.matchId, socket])

  const act = useCallback(async (action: () => Promise<LudoGameState>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setState(await action())
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }, [busy])

  if (!state) return <div className="rounded-2xl border border-white/10 bg-[#121925] p-8 text-center text-white/70">{error ?? ""}</div>

  const playersByColor = new Map(state.players.map((player) => [player.color, player]))
  const winner = state.players.find((player) => player.userId === state.winnerId)
  const myColor = state.players.find((player) => player.userId === userId)?.color ?? "sky"
  const rotation = ({ coral: 270, mint: 180, sunshine: 90, sky: 0 } as const)[myColor]
  const visualSeats: LudoColor[] = ["coral", "coral", "coral", "coral"]
  COLOR_SEATS.forEach((color, sourceIndex) => { visualSeats[(sourceIndex + rotation / 90) % 4] = color })
  const playerPanel = (seatIndex: number) => {
    const color = visualSeats[seatIndex]!
    return <PlayerPanel key={`${seatIndex}-${color}`} player={playersByColor.get(color)} seatColor={color} seatIndex={seatIndex} state={state} userId={userId} busy={busy} onRoll={() => void act(() => request("ludo:roll", {}))} />
  }

  return (
    <div className="mx-auto max-w-[1500px] rounded-[1.8rem] border border-cyan-300/25 bg-[radial-gradient(ellipse_at_center,_#123250_0%,_#081a2b_58%,_#06111d_100%)] p-2 shadow-[0_0_48px_#04d9ff20] sm:p-4">
      <div className="mb-2 flex items-center justify-between px-1 sm:mb-3">
        <span className="text-xs font-semibold tracking-[0.22em] text-cyan-100/55">{room.code}</span>
        <button
          type="button"
          onClick={() => updateAudioSettings({ muted: !audio.muted })}
          aria-label={audio.muted ? "Turn game sounds on" : "Turn game sounds off"}
          aria-pressed={audio.muted}
          className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-cyan-100/80 hover:bg-white/10"
        >
          {audio.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-center gap-2 lg:flex-row lg:gap-4">
        <div className="hidden shrink-0 lg:flex lg:h-[min(54vw,660px,calc(100vh-300px))] lg:w-[210px] lg:flex-col lg:justify-between">{playerPanel(0)}{playerPanel(3)}</div>
        <div className="grid w-full max-w-[680px] grid-cols-2 gap-x-2 gap-y-2 lg:grid-cols-1 lg:min-w-0 lg:flex-1 lg:max-w-[min(680px,calc(100vh-300px))]">
          <div className="lg:hidden">{playerPanel(0)}</div>
          <div className="lg:hidden">{playerPanel(1)}</div>
          <div className="col-span-2 mx-auto aspect-square w-full max-w-[680px] overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-[#e9fbff] via-white to-[#dff2ff] p-1 shadow-[0_0_32px_#00dfff30] sm:p-2 lg:col-span-1 lg:max-w-[min(680px,calc(100vh-300px))]">
          <LudoBoard state={state} userId={userId} rotation={rotation} busy={busy} audio={audio} onMove={(tokenIndex) => void act(() => request("ludo:move", { tokenIndex }))} />
          </div>
          <div className="lg:hidden">{playerPanel(3)}</div>
          <div className="lg:hidden">{playerPanel(2)}</div>
        </div>
        <div className="hidden shrink-0 lg:flex lg:h-[min(54vw,660px,calc(100vh-300px))] lg:w-[210px] lg:flex-col lg:justify-between">{playerPanel(1)}{playerPanel(2)}</div>
      </div>
      {(error || winner) && <div className="mx-auto mt-3 max-w-[680px]">{error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}{winner && <p className="mt-2 rounded-xl border border-lime-300/35 bg-lime-300/10 px-4 py-3 text-center font-bold text-lime-200">{winner.name} wins</p>}</div>}
    </div>
  )
}
