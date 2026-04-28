import { ref, push, get, query, orderByChild, limitToFirst } from "firebase/database"
import { database } from "./firebase"
import { auth } from "./auth"
import type { Difficulty, RankedRecord } from "./game-types"

const BANNED_USERS = [
  "whitefish",
  "blackfish", 
  "하생",
  "이생",
  "WhiteFish",
  "BlackFish",
  "Whitefish",
  "Blackfish",
  "이정한",
  "하얀색생선",
  "검정색생선",
]

export function isBannedUser(displayName: string): boolean {
  return BANNED_USERS.some(
    (banned) => banned.toLowerCase() === displayName.toLowerCase()
  )
}

export async function submitRankedRecord(record: RankedRecord): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error("로그인이 필요합니다.")
  if (user.uid !== record.uid) throw new Error("uid 불일치")
  if (isBannedUser(user.displayName || "")) throw new Error("접근이 제한된 계정입니다.")

  await user.getIdToken(true)

  const rankRef = ref(database, `rankings/${record.difficulty}`)
  await push(rankRef, record)
}

export async function getLeaderboard(
  difficulty: Difficulty,
  limit = 10
): Promise<RankedRecord[]> {
  const rankRef = query(
    ref(database, `rankings/${difficulty}`),
    orderByChild("timeMs"),
    limitToFirst(limit * 5)
  )
  const snap = await get(rankRef)
  if (!snap.exists()) return []

  const all: RankedRecord[] = []
  snap.forEach((child) => {
    all.push(child.val() as RankedRecord)
  })

  const bestByUser = new Map<string, RankedRecord>()
  for (const r of all) {
    const existing = bestByUser.get(r.uid)
    if (!existing || r.timeMs < existing.timeMs) {
      bestByUser.set(r.uid, r)
    }
  }

  return Array.from(bestByUser.values())
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, limit)
}