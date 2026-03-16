"use client"

import { memo } from "react"
import type { CellState } from "@/lib/game-types"
import { NUMBER_COLORS } from "@/lib/game-types"
import { Bomb, Flag } from "lucide-react"

interface CellProps {
  cell: CellState
  row: number
  col: number
  size: number
  disabled: boolean
  isSafeStart?: boolean
  onClick: (row: number, col: number) => void
  onRightClick: (row: number, col: number) => void
  onChordClick?: (row: number, col: number) => void
}

function CellComponent({ cell, row, col, size, disabled, isSafeStart, onClick, onRightClick, onChordClick }: CellProps) {
  const handleClick = () => {
    if (disabled) return
    // If it's a revealed number cell, try chord click
    if (cell._m2w && cell._q3z > 0 && onChordClick) {
      onChordClick(row, col)
      return
    }
    if (cell._m2w || cell._p9v) return
    onClick(row, col)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (disabled || cell._m2w) return
    onRightClick(row, col)
  }

  const fontSize = Math.max(10, size * 0.5)
  const iconSize = Math.max(10, size * 0.45)

  if (cell._m2w) {
    if (cell._x7k) {
      return (
        <button
          className="flex items-center justify-center rounded-sm transition-colors"
          style={{
            width: size,
            height: size,
            backgroundColor: "var(--cell-mine)",
          }}
          disabled
          aria-label={`셀 ${row},${col}: 지뢰`}
        >
          <Bomb style={{ width: iconSize, height: iconSize }} className="text-foreground" />
        </button>
      )
    }

    return (
      <button
        className={`flex items-center justify-center rounded-sm ${
          cell._q3z > 0 && !disabled ? "cursor-pointer hover:brightness-125 active:brightness-90" : ""
        }`}
        style={{
          width: size,
          height: size,
          borderLeft: cell.revealedBy ? `2px solid ${getPlayerColorLight(cell.revealedBy)}` : undefined,
          background: "var(--cell-revealed)",
        }}
        onClick={handleClick}
        disabled={disabled && cell._q3z === 0}
        aria-label={`셀 ${row},${col}: ${cell._q3z > 0 ? cell._q3z : "빈 칸"}`}
      >
        {cell._q3z > 0 && (
          <span
            className="font-mono font-bold"
            style={{
              fontSize,
              color: NUMBER_COLORS[cell._q3z] || "#9ca3af",
            }}
          >
            {cell._q3z}
          </span>
        )}
      </button>
    )
  }

  if (cell._p9v) {
    return (
      <button
        className="flex items-center justify-center rounded-sm transition-colors"
        style={{
          width: size,
          height: size,
          backgroundColor: "var(--cell-hidden)",
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        disabled={disabled}
        aria-label={`셀 ${row},${col}: 깃발`}
      >
        <Flag
          style={{ width: iconSize, height: iconSize, color: "var(--cell-flag)" }}
        />
      </button>
    )
  }

  return (
    <button
      className={`flex items-center justify-center rounded-sm transition-colors hover:brightness-125 active:brightness-90 ${
        isSafeStart ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: isSafeStart ? "var(--cell-hidden-hover)" : "var(--cell-hidden)",
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      disabled={disabled}
      aria-label={`셀 ${row},${col}: ${isSafeStart ? "안전한 시작 지점" : "미공개"}`}
    >
      {isSafeStart && (
        <span className="text-primary font-bold" style={{ fontSize: fontSize * 0.8 }}>
          {"*"}
        </span>
      )}
    </button>
  )
}

function getPlayerColorLight(_nickname: string): string {
  return "rgba(255,255,255,0.15)"
}

export const Cell = memo(CellComponent)
