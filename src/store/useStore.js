import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // User state
      currentUser: null,
      currentMultiplier: 1.5,
      
      // Data state
      logs: [],
      users: [],
      filteredLogs: [],
      
      // UI state
      currentDateFilter: 'all',
      sortOrder: 'desc',
      theme: 'light',
      
      // Modal state
      deleteLogId: null,
      editLogId: null,
      
      // Actions
      setUser: (user) => set({ currentUser: user }),
      setLogs: (logs) => set({ logs }),
      setUsers: (users) => set({ users }),
      setMultiplier: (multiplier) => set({ currentMultiplier: multiplier }),
      setFilteredLogs: (logs) => set({ filteredLogs: logs }),
      setDateFilter: (filter) => set({ currentDateFilter: filter }),
      setSortOrder: (order) => set({ sortOrder: order }),
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
      setDeleteLogId: (id) => set({ deleteLogId: id }),
      setEditLogId: (id) => set({ editLogId: id }),
      
      // Computed actions
      addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
      updateLog: (id, updates) => set((state) => ({
        logs: state.logs.map(log => log.id === id ? { ...log, ...updates } : log)
      })),
      removeLog: (id) => set((state) => ({
        logs: state.logs.filter(log => log.id !== id)
      })),
      updateUser: (email, updates) => set((state) => ({
        users: state.users.map(user => user.email === email ? { ...user, ...updates } : user)
      })),
      removeUser: (email) => set((state) => ({
        users: state.users.filter(user => user.email !== email)
      })),
      
      // Reset
      reset: () => set({
        currentUser: null,
        logs: [],
        users: [],
        filteredLogs: [],
        deleteLogId: null,
        editLogId: null
      })
    }),
    {
      name: 'toil-tracker-storage',
      partialize: (state) => ({
        theme: state.theme,
        currentUser: state.currentUser
      })
    }
  )
);


