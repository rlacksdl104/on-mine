"use client"

import { useState, useEffect, useCallback, useRef, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Users, Swords, Shield, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MinesweeperBoard } from "@/components/game/minesweeper-board"
import { GameHeader } from "@/components/game/game-header"
import { PlayerList } from "@/components/game/player-list"
import { GameResultDialog } from "@/components/game/game-result-dialog"
import { GameChat } from "@/components/game/game-chat"

import {
  subscribeToRoom,
  handleCellReveal,
  handleCellFlag,
  handleChordReveal,
  resetGame,
  sendChatMessage,
} from "@/lib/firebase-game"
import type { Room, CellState, GameStatus, ChatMessage } from "@/lib/game-types"
import { DIFFICULTY_CONFIGS } from "@/lib/game-types"
import {
  createBoard,
  firebaseToBoard,
  countRemainingMines,
  toggleFlag,
  checkWin,
  revealAllMines,
  revealCell as localRevealCell,
  chordReveal as localChordReveal,
} from "@/lib/minesweeper"

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerId = searchParams.get("playerId") || ""
  const nickname = searchParams.get("nickname") || ""

  const [room, setRoom] = useState<Room | null>(null)
  const [localBoard, setLocalBoard] = useState<CellState[][] | null>(null)
  const [localStatus, setLocalStatus] = useState<GameStatus>("playing")
  const [showResult, setShowResult] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isSpectator, setIsSpectator] = useState(false)

  const boardInitRef = useRef(false)
  const roomRef = useRef<Room | null>(null)

  // 게임 중 우클릭 컨텍스트 메뉴 전체 차단
useEffect(() => {
  const prevent = (e: MouseEvent) => e.preventDefault()
  document.addEventListener("contextmenu", prevent)
  return () => document.removeEventListener("contextmenu", prevent)
}, [])

  useEffect(() => {
    if (!roomId) return

    const unsub = subscribeToRoom(roomId, (data) => {
      if (!data) {
        toast.error("방이 사라졌습니다.")
        router.push("/")
        return
      }
      setRoom(data)
      roomRef.current = data

      // Check if current player is a spectator
      const currentPlayer = data.players?.[playerId]
      if (currentPlayer?.isSpectator) {
        setIsSpectator(true)
      }

      // Parse chat messages
      if (data.chat) {
        const msgs = Object.values(data.chat).sort((a, b) => a.timestamp - b.timestamp)
        setChatMessages(msgs)
      } else {
        setChatMessages([])
      }

      if (data.mode === "cooperative" && data.board) {
        const config = DIFFICULTY_CONFIGS[data.difficulty]
        const board = firebaseToBoard(
          data.board as unknown as Record<string, Record<string, CellState>>,
          config.rows,
          config.cols
        )
        setLocalBoard(board)
      }

      if (data.mode === "cooperative") {
        if (data.status === "won" || data.status === "lost") {
          setLocalStatus(data.status)
          setShowResult(true)
        }
      }

      // For competitive mode, spectators view but don't get their own board
      if (data.mode === "competitive" && data.boardSeed && !boardInitRef.current) {
        if (!currentPlayer?.isSpectator) {
          const config = DIFFICULTY_CONFIGS[data.difficulty]
          const board = createBoard(config, data.boardSeed)
          setLocalBoard(board)
          boardInitRef.current = true
        } else {
          // Spectators in competitive mode get a blank view board
          const config = DIFFICULTY_CONFIGS[data.difficulty]
          const board: CellState[][] = Array.from({ length: config.rows }, () =>
            Array.from({ length: config.cols }, () => ({
              _x7k: false,
              _m2w: false,
              _p9v: false,
              _q3z: 0,
            }))
          )
          setLocalBoard(board)
          boardInitRef.current = true
        }
      }

      if (data.mode === "competitive") {
        const activePlayers = Object.values(data.players || {}).filter(
          (p) => !p.isSpectator
        )
        const allDone = activePlayers.every(
          (p) => p.status === "won" || p.status === "lost"
        )
        if (allDone && activePlayers.length > 0) {
          setShowResult(true)
        }
      }

      // When game resets back to waiting, redirect to room
      if (data.status === "waiting") {
        router.push(
          `/room/${roomId}?playerId=${playerId}&nickname=${encodeURIComponent(nickname)}`
        )
      }
    })

    return () => unsub()
  }, [roomId, playerId, nickname, router])

  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (isSpectator) return
      if (!room || !localBoard) return
      if (room.mode === "cooperative" && (room.status === "won" || room.status === "lost")) return
      if (room.mode === "competitive" && localStatus !== "playing") return

      if (room.mode === "cooperative") {
        await handleCellReveal(roomId, playerId, row, col, localBoard, "cooperative", nickname)
      } else {
        const result = localRevealCell(localBoard, row, col, nickname)
        setLocalBoard(result.newBoard)

        if (result.hitMine) {
          setLocalStatus("lost")
          const revealed = revealAllMines(result.newBoard)
          setLocalBoard(revealed)
          await handleCellReveal(roomId, playerId, row, col, localBoard, "competitive", nickname)
          setShowResult(true)
        } else if (checkWin(result.newBoard)) {
          setLocalStatus("won")
          await handleCellReveal(roomId, playerId, row, col, localBoard, "competitive", nickname)
          setShowResult(true)
        } else {
          await handleCellReveal(roomId, playerId, row, col, localBoard, "competitive", nickname)
        }
      }
    },
    [room, localBoard, roomId, playerId, nickname, localStatus, isSpectator]
  )

  const handleChordClick = useCallback(
    async (row: number, col: number) => {
      if (isSpectator) return
      if (!room || !localBoard) return
      if (room.mode === "cooperative" && (room.status === "won" || room.status === "lost")) return
      if (room.mode === "competitive" && localStatus !== "playing") return

      const cell = localBoard[row][col]
      if (!cell._m2w || cell._q3z === 0) return

      if (room.mode === "cooperative") {
        await handleChordReveal(roomId, playerId, row, col, localBoard, "cooperative", nickname)
      } else {
        const result = localChordReveal(localBoard, row, col, nickname)
        if (result.revealedCells.length === 0) return

        setLocalBoard(result.newBoard)

        if (result.hitMine) {
          setLocalStatus("lost")
          const revealed = revealAllMines(result.newBoard)
          setLocalBoard(revealed)
          await handleChordReveal(roomId, playerId, row, col, localBoard, "competitive", nickname)
          setShowResult(true)
        } else if (checkWin(result.newBoard)) {
          setLocalStatus("won")
          await handleChordReveal(roomId, playerId, row, col, localBoard, "competitive", nickname)
          setShowResult(true)
        } else {
          await handleChordReveal(roomId, playerId, row, col, localBoard, "competitive", nickname)
        }
      }
    },
    [room, localBoard, roomId, playerId, nickname, localStatus, isSpectator]
  )

  const handleRightClick = useCallback(
    async (row: number, col: number) => {
      if (isSpectator) return
      if (!room || !localBoard) return
      if (room.mode === "cooperative" && (room.status === "won" || room.status === "lost")) return
      if (room.mode === "competitive" && localStatus !== "playing") return

      const cell = localBoard[row][col]
      const newFlagged = !cell._p9v
      const newBoard = toggleFlag(localBoard, row, col)

      if (room.mode === "cooperative") {
        await handleCellFlag(roomId, playerId, row, col, newFlagged, "cooperative")
      } else {
        setLocalBoard(newBoard)
      }
    },
    [room, localBoard, roomId, localStatus, playerId, isSpectator]
  )

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!room) return
      const currentPlayer = room.players?.[playerId]
      if (!currentPlayer) return
      await sendChatMessage(roomId, playerId, currentPlayer.nickname, currentPlayer.color, message)
    },
    [room, roomId, playerId]
  )

  const handlePlayAgain = useCallback(async () => {
    setShowResult(false)
    boardInitRef.current = false
    setLocalBoard(null)
    setLocalStatus("playing")
    setIsSpectator(false)
    await resetGame(roomId)
  }, [roomId])

  const handleGoHome = useCallback(() => {
    router.push("/")
  }, [router])

  if (!room || !localBoard) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">게임 로딩 중...</p>
        </div>
      </main>
    )
  }

  const players = room.players ? Object.values(room.players) : []
  const activePlayers = players.filter((p) => !p.isSpectator)
  const spectators = players.filter((p) => p.isSpectator)
  const minesRemaining = countRemainingMines(localBoard)
  const gameStatus: GameStatus =
    room.mode === "cooperative" ? room.status : localStatus
  const isGameOver = gameStatus === "won" || gameStatus === "lost"

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Spectator banner */}
      {isSpectator && (
        <div className="flex items-center justify-center gap-2 bg-muted/60 px-4 py-2 border-b border-border">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            관전 모드 - 게임이 끝나면 대기실에 참가합니다
          </span>
        </div>
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoHome}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">나가기</span>
        </Button>
        <div className="flex items-center gap-2">
          {room.mode === "cooperative" ? (
            <Users className="h-4 w-4 text-primary" />
          ) : (
            <Swords className="h-4 w-4 text-accent" />
          )}
          <span className="text-sm font-medium text-foreground">
            {room.mode === "cooperative" ? "협동" : "대전"} - {DIFFICULTY_CONFIGS[room.difficulty].label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {room.safeStartRow !== undefined && room.safeStartCol !== undefined && (
            <div className="flex items-center gap-1 text-xs text-primary" title="안전 시작 지점이 표시됩니다">
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">안전 시작</span>
            </div>
          )}
          {spectators.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="관전자">
              <Eye className="h-3.5 w-3.5" />
              <span>{spectators.length}</span>
            </div>
          )}
          <div className="text-xs font-mono text-muted-foreground">
            {roomId}
          </div>
        </div>
      </header>

      {/* Game area */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar - players & chat (desktop) */}
        <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border lg:flex">
          <div className="flex-1 overflow-y-auto p-4">
            <PlayerList
              players={activePlayers}
              currentPlayerId={playerId}
              mode={room.mode}
            />
            {spectators.length > 0 && (
              <div className="mt-4 flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  관전자
                </h3>
                <div className="flex flex-col gap-1">
                  {spectators.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1.5">
                      <div
                        className="h-2 w-2 rounded-full opacity-50"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {s.nickname}
                        {s.id === playerId && " (나)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border p-3">
            <GameChat
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentPlayerId={playerId}
            />
          </div>
        </aside>

        {/* Main game area */}
        <div className="flex flex-1 flex-col items-center gap-4 p-4">
          <div className="w-full max-w-3xl">
            <GameHeader
              minesRemaining={minesRemaining}
              startTime={room.startTime || null}
              status={gameStatus}
            />
          </div>

          <div className={isSpectator && !isGameOver ? "pointer-events-none opacity-90" : ""}>
            <MinesweeperBoard
              board={localBoard}
              disabled={isGameOver || isSpectator}
              safeStartRow={room.safeStartRow}
              safeStartCol={room.safeStartCol}
              onCellClick={handleCellClick}
              onCellRightClick={handleRightClick}
              onChordClick={handleChordClick}
            />
          </div>

          {/* Spectator competitive info */}
          {isSpectator && room.mode === "competitive" && (
            <div className="w-full max-w-3xl rounded-lg bg-muted/40 p-4 ring-1 ring-border">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                플레이어 진행 상황
              </p>
              <div className="flex flex-col gap-2">
                {activePlayers
                  .sort((a, b) => (b.progress || 0) - (a.progress || 0))
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-medium text-foreground min-w-20">{p.nickname}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${p.progress || 0}%`,
                            backgroundColor: p.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground min-w-8 text-right">
                        {p.progress || 0}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Mobile player list & chat */}
          <div className="flex w-full max-w-3xl flex-col gap-3 lg:hidden">
            <PlayerList
              players={activePlayers}
              currentPlayerId={playerId}
              mode={room.mode}
            />
            {spectators.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  관전자 ({spectators.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {spectators.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1">
                      <div
                        className="h-2 w-2 rounded-full opacity-50"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {s.nickname}
                        {s.id === playerId && " (나)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <GameChat
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentPlayerId={playerId}
            />
          </div>
        </div>
      </div>

      {/* Result Dialog */}
      <GameResultDialog
        open={showResult}
        status={gameStatus}
        mode={room.mode}
        players={activePlayers}
        currentPlayerId={playerId}
        startTime={room.startTime || null}
        endTime={room.endTime || null}
        isSpectator={isSpectator}
        onPlayAgain={handlePlayAgain}
        onGoHome={handleGoHome}
      />
    </main>
  )
}
