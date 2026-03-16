"use client"

import { useRef, useEffect, useState } from "react"
import type { CellState } from "@/lib/game-types"
import { Cell } from "./cell"

interface MinesweeperBoardProps {
  board: CellState[][]
  disabled: boolean
  safeStartRow?: number | null
  safeStartCol?: number | null
  onCellClick: (row: number, col: number) => void
  onCellRightClick: (row: number, col: number) => void
  onChordClick?: (row: number, col: number) => void
}

export function MinesweeperBoard({
  board,
  disabled,
  safeStartRow,
  safeStartCol,
  onCellClick,
  onCellRightClick,
  onChordClick,
}: MinesweeperBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(32)

  const rows = board.length
  const cols = board[0]?.length || 0

  // Check if any cell has been revealed (to hide safe start indicator after first click)
  const anyRevealed = board.some((row) => row.some((cell) => cell._m2w))

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const container = containerRef.current
      const availableWidth = container.clientWidth - 8
      const availableHeight = window.innerHeight * 0.65

      const maxByWidth = Math.floor(availableWidth / cols)
      const maxByHeight = Math.floor(availableHeight / rows)
      const size = Math.min(maxByWidth, maxByHeight, 40)
      setCellSize(Math.max(size, 18))
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [rows, cols])

  const gap = cellSize > 24 ? 2 : 1

  return (
    <div ref={containerRef} className="flex w-full items-center justify-center overflow-auto p-1">
      <div
        className="inline-grid select-none"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
        role="grid"
        aria-label="지뢰찾기 게임 보드"
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <Cell
              key={`${r}-${c}`}
              cell={cell}
              row={r}
              col={c}
              size={cellSize - gap}
              disabled={disabled}
              isSafeStart={
                !anyRevealed &&
                safeStartRow !== undefined &&
                safeStartCol !== undefined &&
                safeStartRow !== null &&
                safeStartCol !== null &&
                r === safeStartRow &&
                c === safeStartCol
              }
              onClick={onCellClick}
              onRightClick={onCellRightClick}
              onChordClick={onChordClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
