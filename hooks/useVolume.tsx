import { create } from "zustand";
import { volumeTypeProps } from "./useLocalStorage";

interface UseVolumeProps {
  volume: volumeTypeProps
  setVolume: (volume: number) => void
}

const useVolume = create<UseVolumeProps>((set) => ({
  volume: null,
  setVolume: (volumeValue: number) => set({volume: volumeValue})
}))

export default useVolume;