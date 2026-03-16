import { ref, push, get, query, orderByChild, limitToFirst } from "firebase/database"
import { database } from "./firebase"
import type { Difficulty, RankedRecord } from "./game-types"

// rankings/{difficulty}/{pushKey} = RankedRecord
export async function submitRankedRecord(record: RankedRecord): Promise<void> {
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
    limitToFirst(limit * 5) // fetch extra, filter to top N per user client-side
  )
  const snap = await get(rankRef)
  if (!snap.exists()) return []

  const all: RankedRecord[] = []
  snap.forEach((child) => {
    all.push(child.val() as RankedRecord)
  })

  // Keep only the best record per user
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
