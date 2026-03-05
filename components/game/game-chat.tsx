"use client"

import { useState, useRef, useEffect } from "react"
import { Send, MessageCircle, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ChatMessage } from "@/lib/game-types"

interface GameChatProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  currentPlayerId: string
}

export function GameChat({ messages, onSendMessage, currentPlayerId }: GameChatProps) {
  const [input, setInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setUnreadCount(0)
    }
  }, [messages, isOpen])

  useEffect(() => {
    if (!isOpen && messages.length > prevLengthRef.current) {
      setUnreadCount((prev) => prev + (messages.length - prevLengthRef.current))
    }
    prevLengthRef.current = messages.length
  }, [messages.length, isOpen])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col">
      {/* Toggle button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setUnreadCount(0)
        }}
        className="flex items-center justify-between rounded-lg bg-card px-3 py-2 ring-1 ring-border transition-colors hover:bg-card/80"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">채팅</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="mt-1 flex flex-col rounded-lg bg-card ring-1 ring-border">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex flex-col gap-1 overflow-y-auto p-3"
            style={{ maxHeight: 200, minHeight: 120 }}
          >
            {messages.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                아직 메시지가 없습니다
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <span
                  className="text-xs font-semibold shrink-0"
                  style={{ color: msg.color }}
                >
                  {msg.nickname}
                </span>
                <span className="text-xs text-foreground break-all">
                  {msg.message}
                </span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-1.5 border-t border-border p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지 입력..."
              maxLength={200}
              className="h-8 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs"
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim()}
              className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
