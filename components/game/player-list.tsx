"use client"

import { Crown, Trophy, Skull } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { Player, GameMode } from "@/lib/game-types"

interface PlayerListProps {
  players: Player[]
  currentPlayerId: string
  mode: GameMode
}

export function PlayerList({ players, currentPlayerId, mode }: PlayerListProps) {
  const sortedPlayers =
    mode === "competitive"
      ? [...players].sort((a, b) => (b.progress || 0) - (a.progress || 0))
      : players

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        플레이어
      </h3>
      <div className="flex flex-col gap-1.5">
        {sortedPlayers.map((player) => (
          <div
            key={player.id}
            className="flex flex-col gap-1.5 rounded-lg bg-secondary px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                <span className="text-sm font-medium text-foreground">
                  {player.nickname}
                </span>
                {player.isHost && <Crown className="h-3 w-3 text-accent" />}
                {player.id === currentPlayerId && (
                  <span className="text-xs text-muted-foreground">(나)</span>
                )}
              </div>
              {mode === "competitive" && (
                <div className="flex items-center gap-1">
                  {player.status === "won" && (
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                  )}
                  {player.status === "lost" && (
                    <Skull className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className="text-xs font-mono text-muted-foreground">
                    {player.progress || 0}%
                  </span>
                </div>
              )}
            </div>
            {mode === "competitive" && (
              <Progress
                value={player.progress || 0}
                className="h-1.5"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
