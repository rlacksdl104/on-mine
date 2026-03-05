import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  push,
  type Unsubscribe,
} from "firebase/database"
import { database } from "./firebase"
import type { Room, Player, GameMode, Difficulty, CellState, ChatMessage } from "./game-types"
import { PLAYER_COLORS, DIFFICULTY_CONFIGS } from "./game-types"
import {
  createBoard,
  boardToFirebase,
  generateSeed,
  revealCell,
  checkWin,
  getProgress,
  revealAllMines,
  findSafeStart,
  chordReveal,
  generateNoGuessSeed,
} from "./minesweeper"

function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generatePlayerId(): string {
  return push(ref(database)).key || Math.random().toString(36).substring(2, 10)
}

export async function createRoom(
  hostId: string,
  nickname: string,
  mode: GameMode,
  difficulty: Difficulty
): Promise<string> {
  const roomId = generateRoomId()
  const roomRef = ref(database, `rooms/${roomId}`)

  const existing = await get(roomRef)
  if (existing.exists()) {
    return createRoom(hostId, nickname, mode, difficulty)
  }

  const player: Player = {
    id: hostId,
    nickname,
    color: PLAYER_COLORS[0],
    isReady: true,
    isHost: true,
  }

  const room: Room = {
    id: roomId,
    hostId,
    mode,
    difficulty,
    status: "waiting",
    players: { [hostId]: player },
    createdAt: Date.now(),
  }

  await set(roomRef, room)
  setupDisconnectHandler(roomId, hostId)

  return roomId
}

export async function joinRoom(
  roomId: string,
  playerId: string,
  nickname: string
): Promise<{ success: boolean; error?: string; spectator?: boolean }> {
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    return { success: false, error: "방을 찾을 수 없습니다." }
  }

  const room = snapshot.val() as Room

  const playerCount = room.players ? Object.keys(room.players).length : 0
  if (playerCount >= 8) {
    return { success: false, error: "방이 가득 찼습니다. (최대 8명)" }
  }

  const colorIndex = playerCount % PLAYER_COLORS.length

  // If game is already in progress, join as spectator
  if (room.status === "playing") {
    const spectator: Player = {
      id: playerId,
      nickname,
      color: PLAYER_COLORS[colorIndex],
      isReady: false,
      isHost: false,
      isSpectator: true,
    }

    await set(ref(database, `rooms/${roomId}/players/${playerId}`), spectator)
    setupDisconnectHandler(roomId, playerId)

    return { success: true, spectator: true }
  }

  if (room.status !== "waiting") {
    return { success: false, error: "방에 참가할 수 없는 상태입니다." }
  }

  const player: Player = {
    id: playerId,
    nickname,
    color: PLAYER_COLORS[colorIndex],
    isReady: false,
    isHost: false,
  }

  await set(ref(database, `rooms/${roomId}/players/${playerId}`), player)
  setupDisconnectHandler(roomId, playerId)

  return { success: true }
}

export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) return

  const room = snapshot.val() as Room
  const players = room.players || {}
  delete players[playerId]

  const remainingPlayers = Object.keys(players)

  if (remainingPlayers.length === 0) {
    await remove(roomRef)
    return
  }

  if (room.hostId === playerId) {
    const newHostId = remainingPlayers[0]
    players[newHostId] = { ...players[newHostId], isHost: true, isReady: true }
    await update(roomRef, {
      hostId: newHostId,
      players,
    })
  } else {
    await remove(ref(database, `rooms/${roomId}/players/${playerId}`))
  }
}

/** Kick a player from the room (host only) */
export async function kickPlayer(roomId: string, hostId: string, targetPlayerId: string): Promise<{ success: boolean; error?: string }> {
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return { success: false, error: "방을 찾을 수 없습니다." }

  const room = snapshot.val() as Room
  if (room.hostId !== hostId) return { success: false, error: "방장만 강제퇴장 시킬 수 있습니다." }
  if (targetPlayerId === hostId) return { success: false, error: "자기 자신을 강제퇴장 시킬 수 없습니다." }
  if (!room.players?.[targetPlayerId]) return { success: false, error: "해당 플레이어를 찾을 수 없습니다." }

  await remove(ref(database, `rooms/${roomId}/players/${targetPlayerId}`))
  return { success: true }
}

export async function setReady(roomId: string, playerId: string, ready: boolean): Promise<void> {
  await update(ref(database, `rooms/${roomId}/players/${playerId}`), { isReady: ready })
}

export async function startGame(roomId: string): Promise<void> {
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return

  const room = snapshot.val() as Room
  const config = DIFFICULTY_CONFIGS[room.difficulty]
  const baseSeed = generateSeed()

  // Generate a no-guess solvable seed
  const seed = generateNoGuessSeed(config, baseSeed)

  // Find safe starting position
  const safeStart = findSafeStart(config, seed)

  if (room.mode === "cooperative") {
    const board = createBoard(config, seed)
    await update(roomRef, {
      status: "playing",
      startTime: Date.now(),
      boardSeed: seed,
      board: boardToFirebase(board),
      safeStartRow: safeStart.row,
      safeStartCol: safeStart.col,
    })
  } else {
    const updates: Record<string, unknown> = {
      status: "playing",
      startTime: Date.now(),
      boardSeed: seed,
      safeStartRow: safeStart.row,
      safeStartCol: safeStart.col,
    }

    const players = room.players || {}
    for (const pid of Object.keys(players)) {
      // Skip spectators - they don't play
      if (players[pid].isSpectator) continue
      updates[`players/${pid}/progress`] = 0
      updates[`players/${pid}/status`] = "playing"
      updates[`players/${pid}/finishTime`] = null
      updates[`players/${pid}/cellsRevealed`] = 0
      updates[`players/${pid}/flagsPlaced`] = 0
      updates[`players/${pid}/minesHit`] = 0
    }

    await update(ref(database, `rooms/${roomId}`), updates)
  }
}

export async function handleCellReveal(
  roomId: string,
  playerId: string,
  row: number,
  col: number,
  board: CellState[][],
  mode: GameMode,
  nickname: string
): Promise<{ newBoard: CellState[][]; hitMine: boolean }> {
  const result = revealCell(board, row, col, nickname)

  if (mode === "cooperative") {
    const updates: Record<string, unknown> = {}
    for (const [r, c] of result.revealedCells) {
      updates[`board/${r}/${c}/isRevealed`] = true
      updates[`board/${r}/${c}/revealedBy`] = nickname
    }

    // Track player stats
    updates[`players/${playerId}/cellsRevealed`] = (await getPlayerStat(roomId, playerId, "cellsRevealed")) + result.revealedCells.length

    if (result.hitMine) {
      updates[`board/${row}/${col}/isRevealed`] = true
      updates[`board/${row}/${col}/revealedBy`] = nickname
      updates["status"] = "lost"
      updates["endTime"] = Date.now()
      updates[`players/${playerId}/minesHit`] = (await getPlayerStat(roomId, playerId, "minesHit")) + 1

      const revealed = revealAllMines(result.newBoard)
      const mineUpdates: Record<string, unknown> = {}
      for (let r = 0; r < revealed.length; r++) {
        for (let c = 0; c < revealed[r].length; c++) {
          if (revealed[r][c].isMine) {
            mineUpdates[`board/${r}/${c}/isRevealed`] = true
          }
        }
      }
      Object.assign(updates, mineUpdates)
    } else if (checkWin(result.newBoard)) {
      updates["status"] = "won"
      updates["endTime"] = Date.now()
    }

    await update(ref(database, `rooms/${roomId}`), updates)
  } else {
    const progress = getProgress(result.newBoard)
    const currentRevealed = await getPlayerStat(roomId, playerId, "cellsRevealed")
    const updates: Record<string, unknown> = {
      [`players/${playerId}/progress`]: progress,
      [`players/${playerId}/cellsRevealed`]: currentRevealed + result.revealedCells.length,
    }

    if (result.hitMine) {
      updates[`players/${playerId}/status`] = "lost"
      updates[`players/${playerId}/finishTime`] = Date.now()
      updates[`players/${playerId}/minesHit`] = (await getPlayerStat(roomId, playerId, "minesHit")) + 1
    } else if (checkWin(result.newBoard)) {
      updates[`players/${playerId}/status`] = "won"
      updates[`players/${playerId}/progress`] = 100
      updates[`players/${playerId}/finishTime`] = Date.now()
    }

    await update(ref(database, `rooms/${roomId}`), updates)
  }

  return { newBoard: result.newBoard, hitMine: result.hitMine }
}

/** Handle chord click (clicking on a revealed number where adjacent flags match the number) */
export async function handleChordReveal(
  roomId: string,
  playerId: string,
  row: number,
  col: number,
  board: CellState[][],
  mode: GameMode,
  nickname: string
): Promise<{ newBoard: CellState[][]; hitMine: boolean }> {
  const result = chordReveal(board, row, col, nickname)

  if (result.revealedCells.length === 0) {
    return { newBoard: result.newBoard, hitMine: false }
  }

  if (mode === "cooperative") {
    const updates: Record<string, unknown> = {}
    for (const [r, c] of result.revealedCells) {
      updates[`board/${r}/${c}/isRevealed`] = true
      updates[`board/${r}/${c}/revealedBy`] = nickname
    }

    updates[`players/${playerId}/cellsRevealed`] = (await getPlayerStat(roomId, playerId, "cellsRevealed")) + result.revealedCells.length

    if (result.hitMine) {
      updates["status"] = "lost"
      updates["endTime"] = Date.now()
      updates[`players/${playerId}/minesHit`] = (await getPlayerStat(roomId, playerId, "minesHit")) + 1

      const revealed = revealAllMines(result.newBoard)
      for (let r = 0; r < revealed.length; r++) {
        for (let c = 0; c < revealed[r].length; c++) {
          if (revealed[r][c].isMine) {
            updates[`board/${r}/${c}/isRevealed`] = true
          }
        }
      }
    } else if (checkWin(result.newBoard)) {
      updates["status"] = "won"
      updates["endTime"] = Date.now()
    }

    await update(ref(database, `rooms/${roomId}`), updates)
  } else {
    const progress = getProgress(result.newBoard)
    const currentRevealed = await getPlayerStat(roomId, playerId, "cellsRevealed")
    const updates: Record<string, unknown> = {
      [`players/${playerId}/progress`]: progress,
      [`players/${playerId}/cellsRevealed`]: currentRevealed + result.revealedCells.length,
    }

    if (result.hitMine) {
      updates[`players/${playerId}/status`] = "lost"
      updates[`players/${playerId}/finishTime`] = Date.now()
      updates[`players/${playerId}/minesHit`] = (await getPlayerStat(roomId, playerId, "minesHit")) + 1
    } else if (checkWin(result.newBoard)) {
      updates[`players/${playerId}/status`] = "won"
      updates[`players/${playerId}/progress`] = 100
      updates[`players/${playerId}/finishTime`] = Date.now()
    }

    await update(ref(database, `rooms/${roomId}`), updates)
  }

  return { newBoard: result.newBoard, hitMine: result.hitMine }
}

export async function handleCellFlag(
  roomId: string,
  playerId: string,
  row: number,
  col: number,
  flagged: boolean,
  mode: GameMode
): Promise<void> {
  if (mode === "cooperative") {
    await update(ref(database, `rooms/${roomId}/board/${row}/${col}`), { isFlagged: flagged })
    if (flagged) {
      const current = await getPlayerStat(roomId, playerId, "flagsPlaced")
      await update(ref(database, `rooms/${roomId}/players/${playerId}`), { flagsPlaced: current + 1 })
    }
  }
}

/** Send a chat message */
export async function sendChatMessage(
  roomId: string,
  playerId: string,
  nickname: string,
  color: string,
  message: string
): Promise<void> {
  const chatRef = ref(database, `rooms/${roomId}/chat`)
  const newMsgRef = push(chatRef)
  const chatMessage: ChatMessage = {
    id: newMsgRef.key || Date.now().toString(),
    playerId,
    nickname,
    color,
    message: message.trim().substring(0, 200),
    timestamp: Date.now(),
  }
  await set(newMsgRef, chatMessage)
}

export function subscribeToRoom(roomId: string, callback: (room: Room | null) => void): Unsubscribe {
  const roomRef = ref(database, `rooms/${roomId}`)
  return onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as Room)
    } else {
      callback(null)
    }
  })
}

export async function resetGame(roomId: string): Promise<void> {
  const roomRef = ref(database, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  if (!snapshot.exists()) return

  const room = snapshot.val() as Room
  const updates: Record<string, unknown> = {
    status: "waiting",
    startTime: null,
    endTime: null,
    board: null,
    boardSeed: null,
    chat: null,
    safeStartRow: null,
    safeStartCol: null,
  }

  const players = room.players || {}
  for (const pid of Object.keys(players)) {
    updates[`players/${pid}/isReady`] = players[pid].isHost
    updates[`players/${pid}/progress`] = null
    updates[`players/${pid}/finishTime`] = null
    updates[`players/${pid}/status`] = null
    updates[`players/${pid}/cellsRevealed`] = null
    updates[`players/${pid}/flagsPlaced`] = null
    updates[`players/${pid}/minesHit`] = null
    // Convert spectators to regular players
    updates[`players/${pid}/isSpectator`] = null
  }

  await update(ref(database, `rooms/${roomId}`), updates)
}

function setupDisconnectHandler(roomId: string, playerId: string): void {
  const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`)
  onDisconnect(playerRef).remove()
}

async function getPlayerStat(roomId: string, playerId: string, stat: string): Promise<number> {
  const statRef = ref(database, `rooms/${roomId}/players/${playerId}/${stat}`)
  const snap = await get(statRef)
  return snap.exists() ? (snap.val() as number) : 0
}
