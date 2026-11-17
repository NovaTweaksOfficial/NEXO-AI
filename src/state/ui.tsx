import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { TabId, AIMode } from '@/types'

interface Ctx {
  tab: TabId
  setTab: (t: TabId) => void
  mode: AIMode
  setMode: (m: AIMode) => void
  paletteOpen: boolean
  setPaletteOpen: Dispatch<SetStateAction<boolean>>
  arcadeOpen: boolean
  setArcadeOpen: Dispatch<SetStateAction<boolean>>
  pendingTool: string | null
  setPendingTool: (id: string | null) => void
}

const UiCtx = createContext<Ctx | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>('home')
  const [mode, setMode] = useState<AIMode>('general')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [arcadeOpen, setArcadeOpen] = useState(false)
  const [pendingTool, setPendingTool] = useState<string | null>(null)
  return (
    <UiCtx.Provider value={{
      tab, setTab, mode, setMode,
      paletteOpen, setPaletteOpen,
      arcadeOpen, setArcadeOpen,
      pendingTool, setPendingTool,
    }}>
      {children}
    </UiCtx.Provider>
  )
}

export function useUi() {
  const ctx = useContext(UiCtx)
  if (!ctx) throw new Error('useUi outside provider')
  return ctx
}
