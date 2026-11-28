import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type ToastCtx = { show: (message: string) => void }

const Ctx = createContext<ToastCtx>({ show: () => undefined })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const show = useCallback((msg: string) => {
    setMessage(msg)
    window.setTimeout(() => setMessage(null), 2400)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {message && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
