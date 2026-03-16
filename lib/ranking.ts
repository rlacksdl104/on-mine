import { ref, push, get, query, orderByChild, limitToFirst } from "firebase/database"
import { database } from "./firebase"
import { auth } from "./auth"
import type { Difficulty, RankedRecord } from "./game-types"

export async function submitRankedRecord(record: RankedRecord): Promise<void> {
  // 현재 로그인된 유저 토큰 확인
  const user = auth.currentUser
  if (!user) throw new Error("로그인이 필요합니다.")

  // uid 일치 검증
  if (user.uid !== record.uid) throw new Error("uid 불일치")

  // 토큰 강제 갱신 (만료된 토큰 방지)
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