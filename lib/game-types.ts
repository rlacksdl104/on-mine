export type CellState = {
  _x7k: boolean
  _m2w: boolean
  _p9v: boolean
  _q3z: number
  revealedBy?: string
}

export type Difficulty = "beginner" | "intermediate" | "expert"

export type DifficultyConfig = {
  rows: number
  cols: number
  mines: number
  label: string
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  beginner: { rows: 9, cols: 9, mines: 8, label: "초급" },
  intermediate: { rows: 16, cols: 16, mines: 30, label: "중급" },
  expert: { rows: 16, cols: 30, mines: 70, label: "고급" },
}

export type GameMode = "cooperative" | "competitive"

export type GameStatus = "waiting" | "playing" | "won" | "lost"

export type Player = {
  id: string
  nickname: string
  color: string
  isReady: boolean
  isHost: boolean
  isSpectator?: boolean
  progress?: number
  finishTime?: number
  status?: "playing" | "won" | "lost"
  cellsRevealed?: number
  flagsPlaced?: number
  minesHit?: number
}

export type ChatMessage = {
  id: string
  playerId: string
  nickname: string
  color: string
  message: string
  timestamp: number
}

export type Room = {
  id: string
  hostId: string
  mode: GameMode
  difficulty: Difficulty
  status: GameStatus
  players: Record<string, Player>
  board?: Record<string, Record<string, CellState>>
  boardSeed?: string
  startTime?: number
  endTime?: number
  createdAt: number
  chat?: Record<string, ChatMessage>
  safeStartRow?: number
  safeStartCol?: number
}

export type CompetitiveBoard = {
  cells: CellState[][]
  progress: number
  status: "playing" | "won" | "lost"
  finishTime?: number
}

export const PLAYER_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
]

export const NUMBER_COLORS: Record<number, string> = {
  1: "#3b82f6",
  2: "#22c55e",
  3: "#ef4444",
  4: "#7c3aed",
  5: "#b91c1c",
  6: "#0891b2",
  7: "#1f2937",
  8: "#6b7280",
}

// ─── Ranked Mode ─────────────────────────────────────────────────────────────

export type RankedRecord = {
  uid: string
  displayName: string
  photoURL?: string
  difficulty: Difficulty
  timeMs: number          // 클리어 시간 (밀리초)
  date: number            // timestamp
}
