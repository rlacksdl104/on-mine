import type { CellState, DifficultyConfig } from "./game-types"

function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  return function () {
    h = (h ^ (h >>> 16)) * 0x45d9f3b
    h = (h ^ (h >>> 16)) * 0x45d9f3b
    h = h ^ (h >>> 16)
    return (h >>> 0) / 4294967296
  }
}

export function createBoard(
  config: DifficultyConfig,
  seed?: string,
  firstClickRow?: number,
  firstClickCol?: number
): CellState[][] {
  const { rows, cols, mines } = config
  const board: CellState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    }))
  )

  const rng = seed ? seededRandom(seed) : Math.random
  const positions: [number, number][] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        firstClickRow !== undefined &&
        firstClickCol !== undefined &&
        Math.abs(r - firstClickRow) <= 1 &&
        Math.abs(c - firstClickCol) <= 1
      ) {
        continue
      }
      positions.push([r, c])
    }
  }

  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }

  const mineCount = Math.min(mines, positions.length)
  for (let i = 0; i < mineCount; i++) {
    const [r, c] = positions[i]
    board[r][c].isMine = true
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
            count++
          }
        }
      }
      board[r][c].adjacentMines = count
    }
  }

  return board
}

export function revealCell(
  board: CellState[][],
  row: number,
  col: number,
  revealedBy?: string
): { newBoard: CellState[][]; hitMine: boolean; revealedCells: [number, number][] } {
  const rows = board.length
  const cols = board[0].length
  const newBoard = board.map((r) => r.map((c) => ({ ...c })))
  const revealedCells: [number, number][] = []

  if (newBoard[row][col].isRevealed || newBoard[row][col].isFlagged) {
    return { newBoard, hitMine: false, revealedCells }
  }

  if (newBoard[row][col].isMine) {
    newBoard[row][col].isRevealed = true
    newBoard[row][col].revealedBy = revealedBy
    return { newBoard, hitMine: true, revealedCells: [[row, col]] }
  }

  const queue: [number, number][] = [[row, col]]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    const key = `${r},${c}`
    if (visited.has(key)) continue
    visited.add(key)

    if (r < 0 || r >= rows || c < 0 || c >= cols) continue
    if (newBoard[r][c].isRevealed || newBoard[r][c].isFlagged) continue
    if (newBoard[r][c].isMine) continue

    newBoard[r][c].isRevealed = true
    newBoard[r][c].revealedBy = revealedBy
    revealedCells.push([r, c])

    if (newBoard[r][c].adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          queue.push([r + dr, c + dc])
        }
      }
    }
  }

  return { newBoard, hitMine: false, revealedCells }
}

export function toggleFlag(board: CellState[][], row: number, col: number): CellState[][] {
  const newBoard = board.map((r) => r.map((c) => ({ ...c })))
  if (!newBoard[row][col].isRevealed) {
    newBoard[row][col].isFlagged = !newBoard[row][col].isFlagged
  }
  return newBoard
}

export function checkWin(board: CellState[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.isMine && !cell.isRevealed) return false
    }
  }
  return true
}

export function countRemainingMines(board: CellState[][]): number {
  let mines = 0
  let flags = 0
  for (const row of board) {
    for (const cell of row) {
      if (cell.isMine) mines++
      if (cell.isFlagged) flags++
    }
  }
  return mines - flags
}

export function getProgress(board: CellState[][]): number {
  let total = 0
  let revealed = 0
  for (const row of board) {
    for (const cell of row) {
      if (!cell.isMine) {
        total++
        if (cell.isRevealed) revealed++
      }
    }
  }
  return total === 0 ? 0 : Math.round((revealed / total) * 100)
}

export function revealAllMines(board: CellState[][]): CellState[][] {
  return board.map((row) =>
    row.map((cell) => (cell.isMine ? { ...cell, isRevealed: true } : { ...cell }))
  )
}

export function boardToFirebase(board: CellState[][]): Record<string, Record<string, CellState>> {
  const result: Record<string, Record<string, CellState>> = {}
  for (let r = 0; r < board.length; r++) {
    result[r.toString()] = {}
    for (let c = 0; c < board[r].length; c++) {
      result[r.toString()][c.toString()] = board[r][c]
    }
  }
  return result
}

export function firebaseToBoard(
  data: Record<string, Record<string, CellState>>,
  rows: number,
  cols: number
): CellState[][] {
  const board: CellState[][] = []
  for (let r = 0; r < rows; r++) {
    board[r] = []
    for (let c = 0; c < cols; c++) {
      const cellData = data?.[r.toString()]?.[c.toString()]
      board[r][c] = cellData || {
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        adjacentMines: 0,
      }
    }
  }
  return board
}

export function generateSeed(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

/** Chord click: if a revealed number cell has exactly that many adjacent flags,
 *  reveal all non-flagged neighbors. Returns hitMine if any neighbor was a mine. */
export function chordReveal(
  board: CellState[][],
  row: number,
  col: number,
  revealedBy?: string
): { newBoard: CellState[][]; hitMine: boolean; revealedCells: [number, number][] } {
  const rows = board.length
  const cols = board[0].length
  const cell = board[row][col]

  if (!cell.isRevealed || cell.adjacentMines === 0) {
    return { newBoard: board, hitMine: false, revealedCells: [] }
  }

  let adjacentFlags = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isFlagged) {
        adjacentFlags++
      }
    }
  }

  if (adjacentFlags !== cell.adjacentMines) {
    return { newBoard: board, hitMine: false, revealedCells: [] }
  }

  let currentBoard = board.map((r) => r.map((c) => ({ ...c })))
  let hitMine = false
  const allRevealed: [number, number][] = []

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const neighbor = currentBoard[nr][nc]
        if (!neighbor.isRevealed && !neighbor.isFlagged) {
          const result = revealCell(currentBoard, nr, nc, revealedBy)
          currentBoard = result.newBoard
          allRevealed.push(...result.revealedCells)
          if (result.hitMine) {
            hitMine = true
          }
        }
      }
    }
  }

  return { newBoard: currentBoard, hitMine, revealedCells: allRevealed }
}

/** Find a safe starting position: a cell with 0 adjacent mines */
export function findSafeStart(config: { rows: number; cols: number; mines: number }, seed: string): { row: number; col: number } {
  const board = createBoard(config, seed)
  const zeroCells: { row: number; col: number }[] = []
  const safeCells: { row: number; col: number }[] = []

  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      if (!board[r][c].isMine) {
        if (board[r][c].adjacentMines === 0) {
          zeroCells.push({ row: r, col: c })
        }
        safeCells.push({ row: r, col: c })
      }
    }
  }

  if (zeroCells.length > 0) {
    const centerR = Math.floor(config.rows / 2)
    const centerC = Math.floor(config.cols / 2)
    zeroCells.sort(
      (a, b) =>
        Math.abs(a.row - centerR) + Math.abs(a.col - centerC) -
        (Math.abs(b.row - centerR) + Math.abs(b.col - centerC))
    )
    return zeroCells[0]
  }

  const centerR = Math.floor(config.rows / 2)
  const centerC = Math.floor(config.cols / 2)
  safeCells.sort(
    (a, b) =>
      Math.abs(a.row - centerR) + Math.abs(a.col - centerC) -
      (Math.abs(b.row - centerR) + Math.abs(b.col - centerC))
  )
  return safeCells[0] || { row: 0, col: 0 }
}

/**
 * Check if a board is solvable without guessing from a given start position.
 * Uses constraint-based logical deduction: repeatedly identifies cells that
 * must be mines or must be safe based on revealed number constraints.
 * Returns { solvable, initialRevealCount } so we can pick the easiest board.
 */
function analyzeBoardSolvability(board: CellState[][], startRow: number, startCol: number): { solvable: boolean; initialRevealCount: number } {
  const rows = board.length
  const cols = board[0].length

  const revealed: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
  const flagged: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))

  // Simulate revealing the start cell (flood fill from a zero cell)
  const revealQueue: [number, number][] = [[startRow, startCol]]
  const visited = new Set<string>()

  while (revealQueue.length > 0) {
    const [r, c] = revealQueue.shift()!
    const key = `${r},${c}`
    if (visited.has(key)) continue
    visited.add(key)
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue
    if (board[r][c].isMine) continue
    if (revealed[r][c]) continue

    revealed[r][c] = true

    if (board[r][c].adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          revealQueue.push([r + dr, c + dc])
        }
      }
    }
  }

  // Count initial reveal
  let initialRevealCount = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (revealed[r][c]) initialRevealCount++
    }
  }

  // Now iteratively apply logical deduction
  const totalSafe = rows * cols - board.flat().filter((c) => c.isMine).length
  const maxIterations = rows * cols * 2

  for (let iter = 0; iter < maxIterations; iter++) {
    let progress = false

    let revealedCount = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (revealed[r][c]) revealedCount++
      }
    }
    if (revealedCount >= totalSafe) return { solvable: true, initialRevealCount }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!revealed[r][c] || board[r][c].adjacentMines === 0) continue

        const num = board[r][c].adjacentMines
        const neighbors: [number, number][] = []
        let adjacentFlags = 0
        let adjacentUnrevealed = 0

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr
            const nc = c + dc
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (flagged[nr][nc]) {
                adjacentFlags++
              } else if (!revealed[nr][nc]) {
                adjacentUnrevealed++
                neighbors.push([nr, nc])
              }
            }
          }
        }

        // Rule 1: All remaining unrevealed neighbors are mines
        if (adjacentUnrevealed > 0 && adjacentFlags + adjacentUnrevealed === num) {
          for (const [nr, nc] of neighbors) {
            if (!flagged[nr][nc]) {
              flagged[nr][nc] = true
              progress = true
            }
          }
        }

        // Rule 2: All mines accounted for, remaining neighbors are safe
        if (adjacentUnrevealed > 0 && adjacentFlags === num) {
          for (const [nr, nc] of neighbors) {
            if (!revealed[nr][nc] && !flagged[nr][nc]) {
              revealed[nr][nc] = true
              progress = true
              if (board[nr][nc].adjacentMines === 0) {
                const floodQueue: [number, number][] = [[nr, nc]]
                const floodVisited = new Set<string>()
                while (floodQueue.length > 0) {
                  const [fr, fc] = floodQueue.shift()!
                  const fkey = `${fr},${fc}`
                  if (floodVisited.has(fkey)) continue
                  floodVisited.add(fkey)
                  for (let ddr = -1; ddr <= 1; ddr++) {
                    for (let ddc = -1; ddc <= 1; ddc++) {
                      if (ddr === 0 && ddc === 0) continue
                      const fnr = fr + ddr
                      const fnc = fc + ddc
                      if (fnr >= 0 && fnr < rows && fnc >= 0 && fnc < cols) {
                        if (!revealed[fnr][fnc] && !flagged[fnr][fnc] && !board[fnr][fnc].isMine) {
                          revealed[fnr][fnc] = true
                          if (board[fnr][fnc].adjacentMines === 0) {
                            floodQueue.push([fnr, fnc])
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!progress) break
  }

  let revealedCount = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (revealed[r][c]) revealedCount++
    }
  }
  return { solvable: revealedCount >= totalSafe, initialRevealCount }
}

/**
 * Generate a no-guess board that is also easy.
 * Among solvable candidates, pick the one with the largest initial opening
 * (most cells revealed from the first click), which makes the board
 * significantly easier to play since the player starts with more information.
 */
export function generateNoGuessSeed(
  config: { rows: number; cols: number; mines: number },
  originalSeed: string,
  maxAttempts: number = 200
): string {
  let bestSeed = originalSeed
  let bestScore = -1

  for (let i = 0; i < maxAttempts; i++) {
    const candidateSeed = i === 0 ? originalSeed : `${originalSeed}_${i}`
    const board = createBoard(config, candidateSeed)

    // Find the best starting cell for this board (largest zero-region)
    let bestStart: { row: number; col: number } | null = null
    let bestZeroCount = 0

    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        if (!board[r][c].isMine && board[r][c].adjacentMines === 0) {
          let count = 0
          const q: [number, number][] = [[r, c]]
          const v = new Set<string>()
          while (q.length > 0) {
            const [qr, qc] = q.shift()!
            const k = `${qr},${qc}`
            if (v.has(k)) continue
            v.add(k)
            if (qr < 0 || qr >= config.rows || qc < 0 || qc >= config.cols) continue
            if (board[qr][qc].isMine) continue
            count++
            if (board[qr][qc].adjacentMines === 0) {
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  if (dr === 0 && dc === 0) continue
                  q.push([qr + dr, qc + dc])
                }
              }
            }
          }
          if (count > bestZeroCount) {
            bestZeroCount = count
            bestStart = { row: r, col: c }
          }
        }
      }
    }

    if (!bestStart) continue

    // Skip boards with too small initial openings
    const totalSafe = config.rows * config.cols - config.mines
    const minOpeningRatio = 0.15 // At least 15% of safe cells revealed on first click
    if (bestZeroCount < totalSafe * minOpeningRatio) continue

    const analysis = analyzeBoardSolvability(board, bestStart.row, bestStart.col)

    if (analysis.solvable && analysis.initialRevealCount > bestScore) {
      bestScore = analysis.initialRevealCount
      bestSeed = candidateSeed
    }
  }

  return bestSeed
}
