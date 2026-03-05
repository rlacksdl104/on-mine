"use client"

import { useState, useEffect, useRef } from "react"
import { Bomb, Timer, Flag } from "lucide-react"
import type { GameStatus } from "@/lib/game-types"

interface GameHeaderProps {
  minesRemaining: number
  startTime: number | null
  status: GameStatus
}

export function GameHeader({ minesRemaining, startTime, status }: GameHeaderProps) {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (startTime && status === "playing") {
      const update = () => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }
      update()
      intervalRef.current = setInterval(update, 1000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
    if (status !== "playing" && intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [startTime, status])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

  return (
    <div className="flex items-center justify-between rounded-lg bg-card px-4 py-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Bomb className="h-4 w-4 text-destructive" />
        <span className="font-mono text-lg font-bold text-foreground">
          {String(minesRemaining).padStart(3, "0")}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {status === "won" && (
          <span className="text-sm font-semibold text-primary">CLEAR!</span>
        )}
        {status === "lost" && (
          <span className="text-sm font-semibold text-destructive">GAME OVER</span>
        )}
        {status === "playing" && (
          <span className="text-xs font-medium text-muted-foreground">진행 중</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-lg font-bold text-foreground">
          {timeDisplay}
        </span>
      </div>
    </div>
  )
}
