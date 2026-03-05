"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bomb, Users, Swords, ArrowRight, Copy, Sparkles } from "lucide-react"
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
import type { GameMode, Difficulty } from "@/lib/game-types"
import { DIFFICULTY_CONFIGS } from "@/lib/game-types"

export default function HomePage() {
  const router = useRouter()
  const [nickname, setNickname] = useState("")
  const [playerId, setPlayerId] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [roomCode, setRoomCode] = useState("")
  const [mode, setMode] = useState<GameMode>("cooperative")
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("minesweeper-nickname") : null
    if (saved) setNickname(saved)
    const savedId = typeof window !== "undefined" ? localStorage.getItem("minesweeper-player-id") : null
    if (savedId) {
      setPlayerId(savedId)
    } else {
      const id = generatePlayerId()
      setPlayerId(id)
      if (typeof window !== "undefined") localStorage.setItem("minesweeper-player-id", id)
    }
  }, [])

  const saveNickname = (name: string) => {
    setNickname(name)
    if (typeof window !== "undefined") localStorage.setItem("minesweeper-nickname", name)
  }

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      toast.error("닉네임을 입력해주세요.")
      return
    }
    setIsLoading(true)
    try {
      const roomId = await createRoom(playerId, nickname.trim(), mode, difficulty)
      router.push(`/room/${roomId}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}`)
    } catch {
      toast.error("방 생성에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!nickname.trim()) {
      toast.error("닉네임을 입력해주세요.")
      return
    }
    if (!roomCode.trim()) {
      toast.error("방 코드를 입력해주세요.")
      return
    }
    setIsLoading(true)
    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), playerId, nickname.trim())
      if (result.success) {
        if (result.spectator) {
          // Game is in progress, join as spectator directly to game page
          toast.info("게임이 진행 중이어서 관전 모드로 참가합니다.")
          router.push(`/game/${roomCode.trim().toUpperCase()}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}&spectator=true`)
        } else {
          router.push(`/room/${roomCode.trim().toUpperCase()}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}`)
        }
      } else {
        toast.error(result.error || "방 참가에 실패했습니다.")
      }
    } catch {
      toast.error("방 참가에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  const nicknameValid = nickname.trim().length > 0

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Bomb className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Minesweeper
              </h1>
              <p className="text-sm font-medium tracking-widest text-primary uppercase">
                Online
              </p>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            친구들과 함께 즐기는 실시간 멀티플레이어 지뢰찾기
          </p>
        </div>

        {/* Nickname Input */}
        <div className="w-full rounded-xl bg-card p-6 ring-1 ring-border">
          <Label htmlFor="nickname" className="mb-2 block text-sm font-medium text-muted-foreground">
            닉네임
          </Label>
          <Input
            id="nickname"
            placeholder="닉네임을 입력하세요"
            value={nickname}
            onChange={(e) => saveNickname(e.target.value)}
            maxLength={12}
            className="bg-secondary text-foreground placeholder:text-muted-foreground border-border"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-col gap-3">
          <Button
            size="lg"
            className="h-14 w-full gap-3 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!nicknameValid}
            onClick={() => setShowCreateDialog(true)}
          >
            <Sparkles className="h-5 w-5" />
            방 만들기
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full gap-3 text-base font-semibold border-border text-foreground hover:bg-secondary"
            disabled={!nicknameValid}
            onClick={() => setShowJoinDialog(true)}
          >
            <ArrowRight className="h-5 w-5" />
            방 참가하기
          </Button>
        </div>

        {/* Mode info */}
        <div className="grid w-full grid-cols-2 gap-3">
          <div className="rounded-lg bg-card p-4 ring-1 ring-border">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">협동 모드</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              같은 보드에서 함께 지뢰를 찾으세요
            </p>
          </div>
          <div className="rounded-lg bg-card p-4 ring-1 ring-border">
            <div className="mb-2 flex items-center gap-2">
              <Swords className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">대전 모드</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              누가 더 빨리 클리어하는지 겨루세요
            </p>
          </div>
        </div>
      </div>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card text-card-foreground border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">방 만들기</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              게임 모드와 난이도를 선택하세요
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">게임 모드</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("cooperative")}
                  className={`flex flex-col items-center gap-2 rounded-lg p-4 ring-1 transition-colors ${
                    mode === "cooperative"
                      ? "bg-primary/10 ring-primary text-primary"
                      : "bg-secondary ring-border text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Users className="h-6 w-6" />
                  <span className="text-sm font-medium">협동</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("competitive")}
                  className={`flex flex-col items-center gap-2 rounded-lg p-4 ring-1 transition-colors ${
                    mode === "competitive"
                      ? "bg-accent/10 ring-accent text-accent"
                      : "bg-secondary ring-border text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Swords className="h-6 w-6" />
                  <span className="text-sm font-medium">대전</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">난이도</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(Object.entries(DIFFICULTY_CONFIGS) as [Difficulty, typeof DIFFICULTY_CONFIGS.beginner][]).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key} className="text-foreground">
                        {config.label} ({config.cols}x{config.rows}, {config.mines}개 지뢰)
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleCreateRoom}
              disabled={isLoading}
            >
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
            <DialogDescription className="text-muted-foreground">
              친구에게 받은 방 코드를 입력하세요
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">방 코드</Label>
              <Input
                placeholder="6자리 코드 입력"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-center text-lg font-mono tracking-[0.3em]"
              />
            </div>
            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleJoinRoom}
              disabled={isLoading || roomCode.length < 6}
            >
              {isLoading ? "참가 중..." : "참가하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
