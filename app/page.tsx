"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Bomb, Users, Swords, ArrowRight, Sparkles,
  Trophy, LogOut, Medal, Clock, ChevronRight, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createRoom, joinRoom, generatePlayerId } from "@/lib/firebase-game"
import { signInWithGoogle, signOutUser, subscribeToAuth } from "@/lib/auth"
import { getLeaderboard } from "@/lib/ranking"
import type { GameMode, Difficulty, RankedRecord } from "@/lib/game-types"
import { DIFFICULTY_CONFIGS } from "@/lib/game-types"
import type { User } from "firebase/auth"

const DIFF_TABS: { key: Difficulty; label: string }[] = [
  { key: "beginner", label: "초급" },
  { key: "intermediate", label: "중급" },
  { key: "expert", label: "고급" },
]

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

export default function HomePage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [nickname, setNickname] = useState("")
  const [playerId, setPlayerId] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [roomCode, setRoomCode] = useState("")
  const [mode, setMode] = useState<GameMode>("cooperative")
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner")
  const [isLoading, setIsLoading] = useState(false)
  const [lbDiff, setLbDiff] = useState<Difficulty>("beginner")
  const [leaderboard, setLeaderboard] = useState<RankedRecord[]>([])
  const [lbLoading, setLbLoading] = useState(false)

  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const savedId = localStorage.getItem("minesweeper-player-id")
    if (savedId) {
      setPlayerId(savedId)
    } else {
      const id = generatePlayerId()
      setPlayerId(id)
      localStorage.setItem("minesweeper-player-id", id)
    }
    const saved = localStorage.getItem("minesweeper-nickname")
    if (saved) setNickname(saved)
  }, [])

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
    fetchLeaderboard(lbDiff)
  }, [lbDiff, fetchLeaderboard])

  const saveNickname = (name: string) => {
    setNickname(name)
    localStorage.setItem("minesweeper-nickname", name)
  }

  const handleGoogleLogin = async () => {
    setAuthLoading(true)
    const u = await signInWithGoogle()
    if (u) {
      if (!nickname) saveNickname(u.displayName || "")
      toast.success(`${u.displayName}님, 환영합니다!`)
    } else {
      toast.error("로그인에 실패했습니다.")
    }
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await signOutUser()
    toast.info("로그아웃 되었습니다.")
  }

  const handleRanked = () => {
    if (!user) {
      toast.error("랭킹전은 로그인 후 이용 가능합니다.")
      return
    }
    router.push("/ranked")
  }

  const handleCreateRoom = async () => {
    if (!nickname.trim()) { toast.error("닉네임을 입력해주세요."); return }
    setIsLoading(true)
    try {
      const roomId = await createRoom(playerId, nickname.trim(), mode, difficulty)
      router.push(`/room/${roomId}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}`)
    } catch {
      toast.error("방 생성에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!nickname.trim()) { toast.error("닉네임을 입력해주세요."); return }
    if (!roomCode.trim()) { toast.error("방 코드를 입력해주세요."); return }
    setIsLoading(true)
    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), playerId, nickname.trim())
      if (result.success) {
        if (result.spectator) {
          toast.info("관전 모드로 참가합니다.")
          router.push(`/game/${roomCode.trim().toUpperCase()}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}&spectator=true`)
        } else {
          router.push(`/room/${roomCode.trim().toUpperCase()}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}`)
        }
      } else {
        toast.error(result.error || "방 참가에 실패했습니다.")
      }
    } catch {
      toast.error("방 참가에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const nicknameValid = nickname.trim().length > 0

  return (
    <main className="min-h-dvh flex flex-col lg:flex-row">

      {/* Left panel */}
      <section className="flex flex-col items-center justify-center gap-5 p-8 lg:w-[400px] lg:flex-shrink-0 lg:border-r lg:border-border">

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Bomb className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Minesweeper</h1>
          <p className="text-xs font-medium tracking-widest text-primary uppercase">Online</p>
          <p className="text-center text-sm text-muted-foreground mt-1">친구들과 즐기는 실시간 멀티플레이어 지뢰찾기</p>
        </div>

        {/* Auth */}
        <div className="w-full max-w-sm rounded-xl bg-card p-4 ring-1 ring-border">
          {authLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <Image src={user.photoURL} alt={user.displayName || ""} width={36} height={36} className="rounded-full ring-1 ring-border" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <button onClick={handleSignOut} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-1">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-3 border-border text-foreground hover:bg-secondary" onClick={handleGoogleLogin}>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 로그인
            </Button>
          )}
        </div>

        {/* Ranked button */}
        <button
          onClick={handleRanked}
          className="group w-full max-w-sm flex items-center gap-4 rounded-xl bg-gradient-to-r from-yellow-500/10 via-primary/8 to-transparent p-4 ring-1 ring-yellow-500/30 hover:ring-yellow-500/60 transition-all"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-500/15">
            <Trophy className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">랭킹전</p>
            <p className="text-xs text-muted-foreground">솔로 기록 도전 · 전 세계 순위</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-yellow-400 transition-colors" />
        </button>

        {/* Nickname (multiplayer) */}
        <div className="w-full max-w-sm rounded-xl bg-card p-4 ring-1 ring-border flex flex-col gap-2">
          <Label htmlFor="nickname" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">닉네임 (멀티플레이어)</Label>
          <Input id="nickname" placeholder="닉네임을 입력하세요" value={nickname} onChange={(e) => saveNickname(e.target.value)} maxLength={12}
            className="bg-secondary text-foreground placeholder:text-muted-foreground border-border" />
        </div>

        {/* Multi buttons */}
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button size="lg" className="h-12 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={!nicknameValid} onClick={() => setShowCreateDialog(true)}>
            <Sparkles className="h-4 w-4" />방 만들기
          </Button>
          <Button size="lg" variant="outline" className="h-12 w-full gap-2 border-border text-foreground hover:bg-secondary" disabled={!nicknameValid} onClick={() => setShowJoinDialog(true)}>
            <ArrowRight className="h-4 w-4" />방 참가하기
          </Button>
        </div>

        <div className="grid w-full max-w-sm grid-cols-3 gap-2 text-center">
          {[
            { icon: <Users className="h-4 w-4 text-primary" />, label: "협동" },
            { icon: <Swords className="h-4 w-4 text-accent" />, label: "대전" },
            { icon: <Zap className="h-4 w-4 text-yellow-400" />, label: "랭킹전" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-lg bg-card p-3 ring-1 ring-border">
              {icon}
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Right panel - Leaderboard */}
      <section className="flex flex-1 flex-col gap-4 p-8 lg:overflow-y-auto">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h2 className="text-lg font-bold text-foreground">리더보드</h2>
          <button onClick={() => fetchLeaderboard(lbDiff)} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            새로고침
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-secondary p-1 w-fit">
          {DIFF_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setLbDiff(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${lbDiff === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
              <span className="ml-1.5 text-xs opacity-60">{DIFFICULTY_CONFIGS[key].cols}×{DIFFICULTY_CONFIGS[key].rows}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-xl bg-card ring-1 ring-border overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_6rem_7rem] gap-2 px-4 py-2.5 border-b border-border bg-secondary/50">
            <span className="text-xs font-semibold text-muted-foreground text-center">#</span>
            <span className="text-xs font-semibold text-muted-foreground">플레이어</span>
            <span className="text-xs font-semibold text-muted-foreground text-right">기록</span>
            <span className="text-xs font-semibold text-muted-foreground text-right">날짜</span>
          </div>

          {lbLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Trophy className="h-10 w-10 opacity-20" />
              <p className="text-sm">아직 기록이 없습니다</p>
              <p className="text-xs opacity-70">랭킹전에서 첫 기록을 남겨보세요!</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {leaderboard.map((record, i) => {
                const isMe = user?.uid === record.uid
                return (
                  <div key={`${record.uid}-${i}`}
                    className={`grid grid-cols-[2.5rem_1fr_6rem_7rem] gap-2 items-center px-4 py-3 border-b border-border/40 last:border-0 ${isMe ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-center">
                      {i < 3 ? <Medal className={`h-4 w-4 ${getMedalColor(i)}`} /> : <span className="text-sm font-mono text-muted-foreground">{i + 1}</span>}
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {record.photoURL ? (
                        <Image src={record.photoURL} alt={record.displayName} width={24} height={24} className="rounded-full ring-1 ring-border flex-shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-muted-foreground">{record.displayName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <span className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                        {record.displayName}{isMe && <span className="ml-1 text-xs text-muted-foreground">(나)</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-mono font-semibold text-foreground">{formatTime(record.timeMs)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card text-card-foreground border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">방 만들기</DialogTitle>
            <DialogDescription className="text-muted-foreground">게임 모드와 난이도를 선택하세요</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">게임 모드</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["cooperative", "competitive"] as GameMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={`flex flex-col items-center gap-2 rounded-lg p-4 ring-1 transition-colors ${mode === m ? (m === "cooperative" ? "bg-primary/10 ring-primary text-primary" : "bg-accent/10 ring-accent text-accent") : "bg-secondary ring-border text-muted-foreground hover:bg-secondary/80"}`}
                  >
                    {m === "cooperative" ? <Users className="h-6 w-6" /> : <Swords className="h-6 w-6" />}
                    <span className="text-sm font-medium">{m === "cooperative" ? "협동" : "대전"}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">난이도</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(Object.entries(DIFFICULTY_CONFIGS) as [Difficulty, typeof DIFFICULTY_CONFIGS.beginner][]).map(([key, config]) => (
                    <SelectItem key={key} value={key} className="text-foreground">
                      {config.label} ({config.cols}×{config.rows}, {config.mines}개 지뢰)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleCreateRoom} disabled={isLoading}>
              {isLoading ? "생성 중..." : "방 생성하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-card text-card-foreground border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">방 참가하기</DialogTitle>
            <DialogDescription className="text-muted-foreground">친구에게 받은 방 코드를 입력하세요</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">방 코드</Label>
              <Input placeholder="6자리 코드 입력" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} maxLength={6}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-center text-lg font-mono tracking-[0.3em]" />
            </div>
            <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleJoinRoom} disabled={isLoading || roomCode.length < 6}>
              {isLoading ? "참가 중..." : "참가하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
