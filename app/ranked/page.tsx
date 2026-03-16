"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { isBannedUser } from "@/lib/ranking"
import {
  ArrowLeft, Trophy, Shield, RotateCcw, Home,
  Clock, Target, Bomb as BombIcon, Medal, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { subscribeToAuth } from "@/lib/auth"
import { submitRankedRecord, getLeaderboard } from "@/lib/ranking"
import type { Difficulty, RankedRecord } from "@/lib/game-types"
import { DIFFICULTY_CONFIGS } from "@/lib/game-types"
import {
  createBoard,
  revealCell,
  toggleFlag,
  checkWin,
  countRemainingMines,
  revealAllMines,
  chordReveal,
  generateNoGuessSeed,
  findSafeStart,
  generateSeed,
} from "@/lib/minesweeper"
import type { CellState } from "@/lib/game-types"
import { MinesweeperBoard } from "@/components/game/minesweeper-board"
import { GameHeader } from "@/components/game/game-header"
import type { User } from "firebase/auth"

type RankedStatus = "idle" | "playing" | "won" | "lost"

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0
    ? `${m}분 ${String(s % 60).padStart(2, "0")}초`
    : `${s}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}초`
}

function getMedalColor(rank: number) {
  if (rank === 0) return "text-yellow-400"
  if (rank === 1) return "text-slate-400"
  if (rank === 2) return "text-amber-600"
  return "text-muted-foreground"
}

export default function RankedPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  const [difficulty, setDifficulty] = useState<Difficulty>("beginner")
  const [board, setBoard] = useState<CellState[][] | null>(null)
  const [status, setStatus] = useState<RankedStatus>("idle")
  const [safeStart, setSafeStart] = useState<{ row: number; col: number } | null>(null)

  const startTimeRef = useRef<number | null>(null)
  const endTimeRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showResult, setShowResult] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<RankedRecord[]>([])
  const [lbLoading, setLbLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u)
      if (!u) router.push("/")
    })
    return unsub
  }, [router])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current)
      }
    }, 50)
  }, [stopTimer])

  useEffect(() => () => stopTimer(), [stopTimer])

  const fetchLeaderboard = useCallback(async (diff: Difficulty) => {
    setLbLoading(true)
    try {
      const data = await getLeaderboard(diff, 10)
      setLeaderboard(data)
    } catch {
      setLeaderboard([])
    } finally {
      setLbLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard(difficulty)
  }, [difficulty, fetchLeaderboard])

  useEffect(() => {
  const unsub = subscribeToAuth((u) => {
    setUser(u)
    if (!u) {
      router.push("/")
      return
    }
    // 밴 유저 차단
    if (isBannedUser(u.displayName || "")) {
      router.push("/")
      toast.error("접근이 제한된 계정입니다.")
    }
  })
  return unsub
}, [router])

  // ── Start a new game ───────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const config = DIFFICULTY_CONFIGS[difficulty]
    setIsGenerating(true)
    setStatus("idle")
    setBoard(null)
    setShowResult(false)
    setSubmitted(false)
    setMyRank(null)
    stopTimer()

    await new Promise((r) => setTimeout(r, 10)) // yield to UI

    const baseSeed = generateSeed()
    const seed = generateNoGuessSeed(config, baseSeed, 200)
    const safe = findSafeStart(config, seed)
    const newBoard = createBoard(config, seed)

    setSafeStart(safe)
    setBoard(newBoard)
    setIsGenerating(false)
    setElapsedMs(0)
    startTimeRef.current = null
    endTimeRef.current = null
  }, [difficulty, stopTimer])

  // ── Cell interactions ──────────────────────────────────────────────────────
  const handleCellClick = useCallback((row: number, col: number) => {
    if (!board || (status !== "idle" && status !== "playing")) return

    // Start timer on first click
    if (status === "idle") {
      startTimeRef.current = Date.now()
      setStatus("playing")
      startTimer()
    }

    const result = revealCell(board, row, col)
    if (result.hitMine) {
      const revealed = revealAllMines(result.newBoard)
      setBoard(revealed)
      endTimeRef.current = Date.now()
      stopTimer()
      setStatus("lost")
      setElapsedMs(Date.now() - (startTimeRef.current || Date.now()))
      setShowResult(true)
    } else if (checkWin(result.newBoard)) {
      setBoard(result.newBoard)
      endTimeRef.current = Date.now()
      stopTimer()
      setStatus("won")
      setElapsedMs(endTimeRef.current - (startTimeRef.current || endTimeRef.current))
      setShowResult(true)
    } else {
      setBoard(result.newBoard)
    }
  }, [board, status, startTimer, stopTimer])

  const handleChordClick = useCallback((row: number, col: number) => {
    if (!board || (status !== "idle" && status !== "playing")) return
    const result = chordReveal(board, row, col)
    if (result.revealedCells.length === 0) return

    if (status === "idle") {
      startTimeRef.current = Date.now()
      setStatus("playing")
      startTimer()
    }

    if (result.hitMine) {
      const revealed = revealAllMines(result.newBoard)
      setBoard(revealed)
      endTimeRef.current = Date.now()
      stopTimer()
      setStatus("lost")
      setElapsedMs(Date.now() - (startTimeRef.current || Date.now()))
      setShowResult(true)
    } else if (checkWin(result.newBoard)) {
      setBoard(result.newBoard)
      endTimeRef.current = Date.now()
      stopTimer()
      setStatus("won")
      setElapsedMs(endTimeRef.current - (startTimeRef.current || endTimeRef.current))
      setShowResult(true)
    } else {
      setBoard(result.newBoard)
    }
  }, [board, status, startTimer, stopTimer])

  const handleRightClick = useCallback((row: number, col: number) => {
    if (!board || (status !== "idle" && status !== "playing")) return
    setBoard(toggleFlag(board, row, col))
  }, [board, status])

  // ── Submit record ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!user || !submitted === false || status !== "won") return
    const timeMs = elapsedMs
    setSubmitting(true)
    try {
      const record: RankedRecord = {
        uid: user.uid,
        displayName: user.displayName || "Anonymous",
        photoURL: user.photoURL || undefined,
        difficulty,
        timeMs,
        date: Date.now(),
      }
      await submitRankedRecord(record)
      setSubmitted(true)
      toast.success("기록이 등록되었습니다!")

      // Refresh leaderboard & find rank
      const lb = await getLeaderboard(difficulty, 100)
      setLeaderboard(lb.slice(0, 10))
      const rank = lb.findIndex((r) => r.uid === user.uid)
      setMyRank(rank >= 0 ? rank + 1 : null)
    } catch {
      toast.error("기록 등록에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }, [user, status, elapsedMs, difficulty, submitted])

  const minesRemaining = board ? countRemainingMines(board) : 0
  const gameStatus = status === "won" ? "won" : status === "lost" ? "lost" : "playing"
  const displayMs = status === "won" || status === "lost" ? elapsedMs : elapsedMs
  const startTimeForHeader = startTimeRef.current

  return (
    <main className="flex min-h-dvh flex-col">

      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-card">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">홈</span>
        </Button>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-bold text-foreground">랭킹전</span>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {user.photoURL && (
              <Image src={user.photoURL} alt={user.displayName || ""} width={24} height={24} className="rounded-full ring-1 ring-border" />
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.displayName}</span>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">

        {/* Sidebar */}
        <aside className="w-full lg:w-72 lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border p-4 flex flex-col gap-4">
          {/* Settings */}
          <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">난이도 설정</h3>
            <Select value={difficulty} onValueChange={(v) => {
              setDifficulty(v as Difficulty)
              setBoard(null)
              setStatus("idle")
              setShowResult(false)
              stopTimer()
            }}>
              <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(Object.entries(DIFFICULTY_CONFIGS) as [Difficulty, typeof DIFFICULTY_CONFIGS.beginner][]).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-foreground">
                    {config.label} · {config.cols}×{config.rows} · 💣{config.mines}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleStart}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />보드 생성 중...</>
              ) : board ? (
                <><RotateCcw className="h-4 w-4" />다시 시작</>
              ) : (
                <><Trophy className="h-4 w-4" />게임 시작</>
              )}
            </Button>
          </div>

          {/* Leaderboard */}
          <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-border flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-3 w-3 text-yellow-400" />
                {DIFFICULTY_CONFIGS[difficulty].label} 리더보드
              </h3>
              <button onClick={() => fetchLeaderboard(difficulty)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">↻</button>
            </div>

            {lbLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Trophy className="h-8 w-8 opacity-20" />
                <p className="text-xs text-center">아직 기록이 없어요.<br/>첫 번째 기록을 남겨보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {leaderboard.map((record, i) => {
                  const isMe = user?.uid === record.uid
                  return (
                    <div key={`${record.uid}-${i}`}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMe ? "bg-primary/8 ring-1 ring-primary/20" : "hover:bg-secondary/50"}`}
                    >
                      <div className="w-5 flex-shrink-0 text-center">
                        {i < 3
                          ? <Medal className={`h-3.5 w-3.5 inline ${getMedalColor(i)}`} />
                          : <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>}
                      </div>
                      {record.photoURL ? (
                        <Image src={record.photoURL} alt={record.displayName} width={18} height={18} className="rounded-full ring-1 ring-border flex-shrink-0" />
                      ) : (
                        <div className="h-4.5 w-4.5 rounded-full bg-secondary flex-shrink-0" />
                      )}
                      <span className={`flex-1 text-xs truncate font-medium ${isMe ? "text-primary" : "text-foreground"}`}>
                        {record.displayName}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{formatTime(record.timeMs)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Game area */}
        <div className="flex flex-1 flex-col items-center gap-4 p-4">

          {!board ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-yellow-500/10 ring-2 ring-yellow-500/30">
                <Trophy className="h-10 w-10 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">랭킹전</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  추측 없이 논리로만 풀 수 있는 보드가 생성됩니다.<br />
                  클리어 기록은 전 세계 리더보드에 등록됩니다.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {[
                  { icon: <Shield className="h-4 w-4 text-primary" />, text: "No-Guess 보장 보드" },
                  { icon: <Trophy className="h-4 w-4 text-yellow-400" />, text: "전 세계 리더보드 등록" },
                  { icon: <Clock className="h-4 w-4 text-accent" />, text: "밀리초 단위 정밀 기록" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3 rounded-lg bg-card px-4 py-2.5 ring-1 ring-border">
                    {icon}
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
              {isGenerating ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">No-Guess 보드 생성 중...</span>
                </div>
              ) : (
                <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8" onClick={handleStart}>
                  <Trophy className="h-5 w-5" />시작하기
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="w-full max-w-3xl flex items-center gap-3">
                <div className="flex-1">
                  <GameHeader
                    minesRemaining={minesRemaining}
                    startTime={startTimeForHeader}
                    status={gameStatus}
                  />
                </div>
                {/* Safe start indicator */}
                {safeStart && status === "idle" && (
                  <div className="flex items-center gap-1.5 text-xs text-primary rounded-lg bg-primary/10 px-3 py-2 ring-1 ring-primary/20">
                    <Shield className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">안전 시작</span>
                  </div>
                )}
              </div>

              {/* Board */}
              <MinesweeperBoard
                board={board}
                disabled={status === "won" || status === "lost"}
                safeStartRow={status === "idle" ? safeStart?.row : undefined}
                safeStartCol={status === "idle" ? safeStart?.col : undefined}
                onCellClick={handleCellClick}
                onCellRightClick={handleRightClick}
                onChordClick={handleChordClick}
              />
            </>
          )}
        </div>
      </div>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="bg-card text-card-foreground border-border sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className={`mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full ${status === "won" ? "bg-yellow-500/15" : "bg-destructive/15"}`}>
              {status === "won"
                ? <Trophy className="h-8 w-8 text-yellow-400" />
                : <BombIcon className="h-8 w-8 text-destructive" />}
            </div>
            <DialogTitle className="text-center text-2xl text-foreground">
              {status === "won" ? "🎉 클리어!" : "💥 게임 오버"}
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              {status === "won"
                ? `${DIFFICULTY_CONFIGS[difficulty].label} · ${formatTime(elapsedMs)}`
                : "지뢰를 밟았습니다. 다시 도전해보세요!"}
            </DialogDescription>
          </DialogHeader>

          {status === "won" && (
            <div className="flex flex-col gap-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center rounded-lg bg-secondary p-3">
                  <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="font-mono text-xl font-bold text-foreground">{formatTime(elapsedMs)}</span>
                  <span className="text-xs text-muted-foreground">클리어 시간</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-secondary p-3">
                  <Target className="h-4 w-4 text-primary mb-1" />
                  <span className="font-mono text-xl font-bold text-foreground">{DIFFICULTY_CONFIGS[difficulty].label}</span>
                  <span className="text-xs text-muted-foreground">난이도</span>
                </div>
              </div>

              {/* Submit */}
              {!submitted ? (
                <Button
                  className="w-full gap-2 bg-yellow-500 text-black hover:bg-yellow-400 font-bold"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />등록 중...</>
                  ) : (
                    <><Trophy className="h-4 w-4" />리더보드에 기록 등록</>
                  )}
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className={`flex items-center gap-3 rounded-lg p-3 ring-1 ${myRank && myRank <= 3 ? "bg-yellow-500/10 ring-yellow-500/30" : "bg-primary/10 ring-primary/20"}`}>
                    {myRank && myRank <= 3 && <Medal className={`h-5 w-5 ${getMedalColor(myRank - 1)}`} />}
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {myRank ? `${myRank}위로 등록되었습니다!` : "기록이 등록되었습니다!"}
                      </p>
                      <p className="text-xs text-muted-foreground">리더보드에서 확인해보세요</p>
                    </div>
                  </div>

                  {/* Mini leaderboard preview */}
                  {leaderboard.length > 0 && (
                    <div className="rounded-lg bg-secondary/50 ring-1 ring-border overflow-hidden">
                      {leaderboard.slice(0, 5).map((record, i) => {
                        const isMe = user?.uid === record.uid
                        return (
                          <div key={`lb-${i}`} className={`flex items-center gap-2 px-3 py-2 border-b border-border/30 last:border-0 ${isMe ? "bg-primary/8" : ""}`}>
                            <div className="w-5 text-center flex-shrink-0">
                              {i < 3 ? <Medal className={`h-3 w-3 inline ${getMedalColor(i)}`} /> : <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>}
                            </div>
                            <span className={`flex-1 text-xs truncate ${isMe ? "text-primary font-semibold" : "text-foreground"}`}>{record.displayName}</span>
                            <span className="text-xs font-mono text-muted-foreground">{formatTime(record.timeMs)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 gap-2 border-border text-foreground hover:bg-secondary" onClick={() => router.push("/")}>
              <Home className="h-4 w-4" />홈
            </Button>
            <Button className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setShowResult(false); handleStart() }}>
              <RotateCcw className="h-4 w-4" />다시 하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
