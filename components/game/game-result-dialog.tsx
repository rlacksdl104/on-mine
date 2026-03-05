"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trophy, Skull, RotateCcw, Home, Target, Flag, Bomb, Clock, Award } from "lucide-react"
import type { Player, GameMode, GameStatus } from "@/lib/game-types"

interface GameResultDialogProps {
  open: boolean
  status: GameStatus
  mode: GameMode
  players: Player[]
  currentPlayerId: string
  startTime: number | null
  endTime: number | null
  isSpectator?: boolean
  onPlayAgain: () => void
  onGoHome: () => void
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function getRankLabel(index: number): string {
  if (index === 0) return "1st"
  if (index === 1) return "2nd"
  if (index === 2) return "3rd"
  return `${index + 1}th`
}

function getRankColor(index: number): string {
  if (index === 0) return "#f59e0b" // gold
  if (index === 1) return "#9ca3af" // silver
  if (index === 2) return "#b45309" // bronze
  return "var(--muted-foreground)"
}

export function GameResultDialog({
  open,
  status,
  mode,
  players,
  currentPlayerId,
  startTime,
  endTime,
  isSpectator = false,
  onPlayAgain,
  onGoHome,
}: GameResultDialogProps) {
  const isWon = status === "won"
  const elapsed = startTime && endTime ? endTime - startTime : 0
  const timeDisplay = formatTime(elapsed)

  const sortedPlayers =
    mode === "competitive"
      ? [...players].sort((a, b) => {
          if (a.status === "won" && b.status !== "won") return -1
          if (b.status === "won" && a.status !== "won") return 1
          if (a.status === "lost" && b.status !== "lost") return 1
          if (b.status === "lost" && a.status !== "lost") return -1
          if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime
          return (b.progress || 0) - (a.progress || 0)
        })
      : [...players].sort((a, b) => (b.cellsRevealed || 0) - (a.cellsRevealed || 0))

  // Cooperative stats
  const totalCellsRevealed = players.reduce((sum, p) => sum + (p.cellsRevealed || 0), 0)
  const totalFlagsPlaced = players.reduce((sum, p) => sum + (p.flagsPlaced || 0), 0)

  return (
    <Dialog open={open}>
      <DialogContent className="bg-card text-card-foreground border-border sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            {isWon ? (
              <Trophy className="h-8 w-8 text-primary" />
            ) : (
              <Skull className="h-8 w-8 text-destructive" />
            )}
          </div>
          <DialogTitle className="text-center text-2xl text-foreground">
            {mode === "cooperative"
              ? isWon
                ? "클리어!"
                : "게임 오버"
              : "게임 종료"}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {isSpectator
              ? "관전이 종료되었습니다. 대기실로 돌아갑니다."
              : mode === "cooperative"
              ? isWon
                ? `${timeDisplay} 만에 모든 지뢰를 찾았습니다!`
                : "지뢰를 밟았습니다..."
              : "최종 결과를 확인하세요"}
          </DialogDescription>
        </DialogHeader>

        {/* Cooperative Team Stats */}
        {mode === "cooperative" && (
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded-lg bg-secondary p-3">
                <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="font-mono text-lg font-bold text-foreground">{timeDisplay}</span>
                <span className="text-xs text-muted-foreground">클리어 시간</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-secondary p-3">
                <Target className="h-4 w-4 text-primary mb-1" />
                <span className="font-mono text-lg font-bold text-foreground">{totalCellsRevealed}</span>
                <span className="text-xs text-muted-foreground">공개한 셀</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-secondary p-3">
                <Flag className="h-4 w-4 text-accent mb-1" />
                <span className="font-mono text-lg font-bold text-foreground">{totalFlagsPlaced}</span>
                <span className="text-xs text-muted-foreground">꽂은 깃발</span>
              </div>
            </div>

            {/* Individual contributions */}
            <div className="rounded-lg ring-1 ring-border overflow-hidden">
              <div className="bg-secondary/50 px-3 py-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  개인 기여도
                </h4>
              </div>
              <div className="flex flex-col">
                {sortedPlayers.map((player, index) => {
                  const contribution = totalCellsRevealed > 0
                    ? Math.round(((player.cellsRevealed || 0) / totalCellsRevealed) * 100)
                    : 0
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between px-3 py-2.5 ${
                        index < sortedPlayers.length - 1 ? "border-b border-border" : ""
                      } ${player.id === currentPlayerId ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        {index === 0 && totalCellsRevealed > 0 && (
                          <Award className="h-4 w-4" style={{ color: "#f59e0b" }} />
                        )}
                        {(index !== 0 || totalCellsRevealed === 0) && (
                          <span className="w-4 text-center text-xs font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                        )}
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {player.nickname}
                          {player.id === currentPlayerId && (
                            <span className="ml-1 text-xs text-muted-foreground">(나)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-mono text-foreground">{player.cellsRevealed || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flag className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-mono text-foreground">{player.flagsPlaced || 0}</span>
                        </div>
                        {player.minesHit ? (
                          <div className="flex items-center gap-1">
                            <Bomb className="h-3 w-3 text-destructive" />
                            <span className="text-xs font-mono text-destructive">{player.minesHit}</span>
                          </div>
                        ) : null}
                        <span className="min-w-8 text-right text-xs font-semibold text-primary">
                          {contribution}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Competitive Leaderboard */}
        {mode === "competitive" && (
          <div className="flex flex-col gap-3 py-2">
            {/* Podium for top 3 */}
            {sortedPlayers.length >= 1 && (
              <div className="flex items-end justify-center gap-3 py-2">
                {/* 2nd place */}
                {sortedPlayers.length >= 2 && (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: sortedPlayers[1].color }}
                    />
                    <span className="text-xs font-medium text-foreground max-w-16 truncate">
                      {sortedPlayers[1].nickname}
                    </span>
                    <div className="flex h-12 w-16 items-center justify-center rounded-t-lg bg-secondary/80">
                      <span className="text-lg font-bold" style={{ color: getRankColor(1) }}>2</span>
                    </div>
                  </div>
                )}
                {/* 1st place */}
                <div className="flex flex-col items-center gap-1">
                  <Trophy className="h-5 w-5" style={{ color: "#f59e0b" }} />
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: sortedPlayers[0].color }}
                  />
                  <span className="text-xs font-semibold text-foreground max-w-16 truncate">
                    {sortedPlayers[0].nickname}
                  </span>
                  <div className="flex h-16 w-16 items-center justify-center rounded-t-lg bg-primary/20 ring-1 ring-primary/30">
                    <span className="text-xl font-bold" style={{ color: getRankColor(0) }}>1</span>
                  </div>
                </div>
                {/* 3rd place */}
                {sortedPlayers.length >= 3 && (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: sortedPlayers[2].color }}
                    />
                    <span className="text-xs font-medium text-foreground max-w-16 truncate">
                      {sortedPlayers[2].nickname}
                    </span>
                    <div className="flex h-10 w-16 items-center justify-center rounded-t-lg bg-secondary/60">
                      <span className="text-lg font-bold" style={{ color: getRankColor(2) }}>3</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Detailed results table */}
            <div className="rounded-lg ring-1 ring-border overflow-hidden">
              <div className="bg-secondary/50 px-3 py-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  상세 결과
                </h4>
              </div>
              <div className="flex flex-col">
                {sortedPlayers.map((player, index) => {
                  const playerTime = player.finishTime && startTime
                    ? formatTime(player.finishTime - startTime)
                    : "--:--"
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between px-3 py-2.5 ${
                        index < sortedPlayers.length - 1 ? "border-b border-border" : ""
                      } ${player.id === currentPlayerId ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-8 text-xs font-bold"
                          style={{ color: getRankColor(index) }}
                        >
                          {getRankLabel(index)}
                        </span>
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {player.nickname}
                          {player.id === currentPlayerId && (
                            <span className="ml-1 text-xs text-muted-foreground">(나)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {player.status === "won" && (
                          <Trophy className="h-3.5 w-3.5 text-primary" />
                        )}
                        {player.status === "lost" && (
                          <Skull className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-mono text-foreground">{player.cellsRevealed || 0}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground min-w-10 text-right">
                          {player.progress || 0}%
                        </span>
                        <span className="text-xs font-mono text-foreground min-w-12 text-right">
                          {playerTime}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 gap-2 border-border text-foreground hover:bg-secondary"
            onClick={onGoHome}
          >
            <Home className="h-4 w-4" />
            홈으로
          </Button>
          <Button
            className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onPlayAgain}
          >
            <RotateCcw className="h-4 w-4" />
            {isSpectator ? "대기실로" : "다시 하기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
