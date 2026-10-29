import { create } from 'zustand'
import { NO_VOICE, type CallUser, type VoiceState } from '../lib/callTypes'

interface ParticipantsState {
  people: CallUser[]
  voice: Record<string, VoiceState>
  upsert: (user: CallUser) => void
  remove: (userId: string) => void
  setVoice: (userId: string, voice: VoiceState) => void
  replace: (people: CallUser[], voice: Record<string, VoiceState>) => void
  reset: () => void
}

export const useParticipantsStore = create<ParticipantsState>()((set) => ({
  people: [],
  voice: {},
  upsert: (user) =>
    set((s) => ({
      people: s.people.some((p) => p.id === user.id) ? s.people.map((p) => (p.id === user.id ? { ...p, ...user } : p)) : [...s.people, user]
    })),
  remove: (userId) =>
    set((s) => {
      const { [userId]: _gone, ...voice } = s.voice
      return { people: s.people.filter((p) => p.id !== userId), voice }
    }),
  setVoice: (userId, voice) => set((s) => ({ voice: { ...s.voice, [userId]: voice } })),
  replace: (people, voice) => set({ people, voice }),
  reset: () => set({ people: [], voice: {} })
}))

export const voiceOf = (voice: Record<string, VoiceState>, userId: string): VoiceState => voice[userId] ?? NO_VOICE
