import { create } from 'zustand';
import { Student, AttendanceRecord } from './types';

export interface DashboardState {
  stats: { total: number; present: number; absent: number };
  recentScans: (AttendanceRecord & { student?: Student })[];
  hasStudents: boolean;
  classes: any[];
  selectedClass: any | null;
  initialLoading: boolean;

  // Actions
  setData: (data: Partial<Omit<DashboardState, 'setData' | 'setLoading' | 'reset'>>) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  stats: { total: 0, present: 0, absent: 0 },
  recentScans: [],
  hasStudents: false,
  classes: [],
  selectedClass: null,
  initialLoading: true,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,
  setData: (data) => set((state) => ({ ...state, ...data })),
  setLoading: (loading) => set({ initialLoading: loading }),
  reset: () => set(initialState),
}));
