import { useEffect, useRef, useState, useCallback } from 'react'
import { useAnnotationStore, selectVisibleStrokes, type DrawPoint } from '../store/annotationStore'

interface ScreenAnnotationCanvasProps {
  sharerId: string
  callId: string
  isDrawingMode: boolean
  className?: string
}

export default function ScreenAnnotationCanvas({
  sharerId,
  callId,
  isDrawingMode,
  className = ''
}: ScreenAnnotationCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const tool = useAnnotationStore((s) => s.tool)
  const color = useAnnotationStore((s) => s.color)
  const width = useAnnotationStore((s) => s.width)
  const strokes = useAnnotationStore(selectVisibleStrokes(sharerId))
  const addStroke = useAnnotationStore((s) => s.addStroke)
  const undo = useAnnotationStore((s) => s.undo)

  const [activePoints, setActivePoints] = useState<DrawPoint[] | null>(null)
  const activeStrokeId = useRef<string | null>(null)
  const isPointerDown = useRef(false)

  // Redraw logic
  const renderStrokes = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, currentPoints?: DrawPoint[] | null) => {
      ctx.clearRect(0, 0, w, h)
      const now = Date.now()
      let hasFading = false

      const drawSingle = (
        stPoints: DrawPoint[],
        stTool: string,
        stColor: string,
        stWidth: number,
        createdAt: number
      ): void => {
        if (!stPoints || stPoints.length === 0) return

        ctx.save()
        let alpha = 1.0

        if (stTool === 'laser') {
          const age = now - createdAt
          alpha = Math.max(0, 1 - age / 2500)
          if (alpha <= 0) {
            ctx.restore()
            return
          }
          hasFading = true
          ctx.shadowColor = stColor
          ctx.shadowBlur = 10
          ctx.lineWidth = stWidth * 1.5
        } else if (stTool === 'highlighter') {
          alpha = 0.4
          ctx.lineWidth = stWidth * 3.5
          ctx.lineCap = 'square'
        } else {
          ctx.lineWidth = stWidth
          ctx.lineCap = 'round'
        }

        ctx.strokeStyle = stColor
        ctx.globalAlpha = alpha
        ctx.lineJoin = 'round'

        if (stPoints.length === 1) {
          ctx.fillStyle = stColor
          ctx.beginPath()
          ctx.arc(stPoints[0].x * w, stPoints[0].y * h, ctx.lineWidth / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          return
        }

        ctx.beginPath()
        ctx.moveTo(stPoints[0].x * w, stPoints[0].y * h)
        for (let i = 1; i < stPoints.length - 1; i++) {
          const xc = (stPoints[i].x * w + stPoints[i + 1].x * w) / 2
          const yc = (stPoints[i].y * h + stPoints[i + 1].y * h) / 2
          ctx.quadraticCurveTo(stPoints[i].x * w, stPoints[i].y * h, xc, yc)
        }
        ctx.lineTo(stPoints[stPoints.length - 1].x * w, stPoints[stPoints.length - 1].y * h)
        ctx.stroke()
        ctx.restore()
      }

      // 1. Existing completed strokes
      for (const st of strokes) {
        drawSingle(st.points, st.tool, st.color, st.width, st.created_at)
      }

      // 2. Stroke in progress
      if (currentPoints && currentPoints.length > 0 && tool !== 'eraser') {
        drawSingle(currentPoints, tool, color, width, now)
      }

      return hasFading
    },
    [strokes, tool, color, width]
  )

  // Continuous animation frame loop for laser fade out
  useEffect(() => {
    let animId: number
    const canvas = canvasRef.current
    if (!canvas) return

    const loop = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const hasFading = renderStrokes(ctx, rect.width, rect.height, activePoints)
          if (hasFading) {
            animId = requestAnimationFrame(loop)
            return
          }
        }
      }
    }

    loop()
    return () => cancelAnimationFrame(animId)
  }, [renderStrokes, activePoints])

  // Sync canvas dimensions with device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const updateSize = (): void => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        renderStrokes(ctx, rect.width, rect.height, activePoints)
      }
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [renderStrokes, activePoints])

  // Coordinate normalizer
  const getNormPoint = (e: React.PointerEvent<HTMLCanvasElement>): DrawPoint | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    return { x, y }
  }

  // Check eraser collision
  const checkEraserHit = useCallback(
    (pt: DrawPoint): void => {
      const radius = 0.03
      for (let i = strokes.length - 1; i >= 0; i--) {
        const st = strokes[i]
        const hit = st.points.some((p) => {
          const dx = p.x - pt.x
          const dy = p.y - pt.y
          return Math.sqrt(dx * dx + dy * dy) < radius
        })
        if (hit) {
          undo(callId, sharerId)
          break
        }
      }
    },
    [strokes, undo, callId, sharerId]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawingMode) return
    e.preventDefault()
    e.stopPropagation()

    const pt = getNormPoint(e)
    if (!pt) return

    isPointerDown.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (tool === 'eraser') {
      checkEraserHit(pt)
    } else {
      activeStrokeId.current = 'st_' + Math.random().toString(36).substring(2, 9)
      setActivePoints([pt])
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawingMode || !isPointerDown.current) return
    e.preventDefault()
    e.stopPropagation()

    const pt = getNormPoint(e)
    if (!pt) return

    if (tool === 'eraser') {
      checkEraserHit(pt)
    } else {
      setActivePoints((prev) => (prev ? [...prev, pt] : [pt]))
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawingMode || !isPointerDown.current) return
    e.preventDefault()
    e.stopPropagation()

    isPointerDown.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (tool !== 'eraser' && activePoints && activePoints.length > 0 && activeStrokeId.current) {
      addStroke(callId, sharerId, {
        id: activeStrokeId.current,
        tool,
        color,
        width,
        points: activePoints,
        fade_out: tool === 'laser'
      })
    }
    setActivePoints(null)
    activeStrokeId.current = null
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-20 ${
        isDrawingMode ? 'pointer-events-auto' : 'pointer-events-none'
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`h-full w-full ${isDrawingMode ? (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : ''}`}
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
