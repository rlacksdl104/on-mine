"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Copy,
  Check,
  Crown,
  Users,
  Swords,
  ArrowLeft,
  Play,
  Bomb,
  UserX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { subscribeToRoom, leaveRoom, setReady, startGame, kickPlayer } from "@/lib/firebase-game"
import type { Room, Player } from "@/lib/game-types"
import { DIFFICULTY_CONFIGS } from "@/lib/game-types"

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerId = searchParams.get("playerId") || ""
  const nickname = searchParams.get("nickname") || ""

  const [room, setRoom] = useState<Room | null>(null)
  const [copied, setCopied] = useState(false)
  const [kickTarget, setKickTarget] = useState<Player | null>(null)
  const [kicked, setKicked] = useState(false)

  useEffect(() => {
    if (!playerId || !roomId) return

    const unsub = subscribeToRoom(roomId, (data) => {
      if (!data) {
        if (!kicked) {
          toast.error("방이 사라졌습니다.")
        }
        router.push("/")
        return
      }

      // Check if we got kicked
      if (data.players && !data.players[playerId]) {
        setKicked(true)
        toast.error("방에서 강제퇴장 되었습니다.")
        router.push("/")
        return
      }

      setRoom(data)

      if (data.status === "playing") {
        router.push(
          `/game/${roomId}?playerId=${playerId}&nickname=${encodeURIComponent(nickname)}`
        )
      }
    })

    return () => unsub()
  }, [roomId, playerId, nickname, router, kicked])

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      toast.success("방 코드가 복사되었습니다!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("복사에 실패했습니다.")
    }
  }, [roomId])

  const handleLeave = useCallback(async () => {
    await leaveRoom(roomId, playerId)
    router.push("/")
  }, [roomId, playerId, router])

  const handleReady = useCallback(async () => {
    if (!room) return
    const player = room.players?.[playerId]
    if (!player) return
    await setReady(roomId, playerId, !player.isReady)
  }, [room, roomId, playerId])

  const handleStart = useCallback(async () => {
    await startGame(roomId)
  }, [roomId])

  const handleKick = useCallback(async () => {
    if (!kickTarget) return
    const result = await kickPlayer(roomId, playerId, kickTarget.id)
    if (result.success) {
      toast.success(`${kickTarget.nickname}님을 강제퇴장 시켰습니다.`)
    } else {
      toast.error(result.error || "강제퇴장에 실패했습니다.")
    }
    setKickTarget(null)
  }, [roomId, playerId, kickTarget])

  if (!room) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">방에 접속 중...</p>
        </div>
      </main>
    )
  }

  const players = room.players ? Object.values(room.players) : []
  const currentPlayer = room.players?.[playerId]
  const isHost = currentPlayer?.isHost
  const allReady = players.length >= 1 && players.every((p) => p.isReady)
  const config = DIFFICULTY_CONFIGS[room.difficulty]

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-lg flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            나가기
          </Button>
          <div className="flex items-center gap-2">
            <Bomb className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">대기실</span>
          </div>
          <div className="w-20" />
        </div>

        {/* Room Code */}
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 ring-1 ring-border">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            방 코드
          </p>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-3 rounded-lg bg-secondary px-6 py-3 transition-colors hover:bg-secondary/80"
          >
            <span className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
              {roomId}
            </span>
            {copied ? (
              <Check className="h-5 w-5 text-primary" />
            ) : (
              <Copy className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            클릭하여 복사, 친구에게 공유하세요
          </p>
        </div>

        {/* Game Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-card p-4 ring-1 ring-border">
            <div className="flex items-center gap-2">
              {room.mode === "cooperative" ? (
                <Users className="h-4 w-4 text-primary" />
              ) : (
                <Swords className="h-4 w-4 text-accent" />
              )}
              <span className="text-sm font-medium text-foreground">
                {room.mode === "cooperative" ? "협동 모드" : "대전 모드"}
              </span>
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 ring-1 ring-border">
            <p className="text-sm font-medium text-foreground">
              {config.label} ({config.cols}x{config.rows})
            </p>
            <p className="text-xs text-muted-foreground">
              지뢰 {config.mines}개
            </p>
          </div>
        </div>

        {/* Players */}
        <div className="rounded-xl bg-card p-4 ring-1 ring-border">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              플레이어 ({players.length}/8)
            </h3>
            {isHost && (
              <span className="text-xs text-muted-foreground">플레이어를 클릭하여 강제퇴장</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {players.map((player: Player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-lg bg-secondary px-4 py-3 ${
                  isHost && player.id !== playerId ? "cursor-pointer hover:bg-secondary/70 transition-colors" : ""
                }`}
                onClick={() => {
                  if (isHost && player.id !== playerId) {
                    setKickTarget(player)
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {player.nickname}
                  </span>
                  {player.isHost && (
                    <Crown className="h-4 w-4 text-accent" />
                  )}
                  {player.id === playerId && (
                    <span className="text-xs text-muted-foreground">(나)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      player.isReady ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {player.isReady ? "준비 완료" : "대기 중"}
                  </span>
                  {isHost && player.id !== playerId && (
                    <UserX className="h-4 w-4 text-destructive/60 hover:text-destructive" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isHost ? (
            <Button
              size="lg"
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleStart}
              disabled={!allReady || players.length < 1}
            >
              <Play className="h-5 w-5" />
              게임 시작
            </Button>
          ) : (
            <Button
              size="lg"
              className={`w-full gap-2 ${
                currentPlayer?.isReady
                  ? "bg-secondary text-foreground hover:bg-secondary/80"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              onClick={handleReady}
            >
              {currentPlayer?.isReady ? "준비 취소" : "준비 완료"}
            </Button>
          )}
        </div>
      </div>

      {/* Kick Confirmation Dialog */}
      <AlertDialog open={!!kickTarget} onOpenChange={(open) => !open && setKickTarget(null)}>
        <AlertDialogContent className="bg-card text-card-foreground border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">강제퇴장</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {kickTarget?.nickname}님을 방에서 강제퇴장 시키겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground hover:bg-secondary">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKick}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              강제퇴장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
