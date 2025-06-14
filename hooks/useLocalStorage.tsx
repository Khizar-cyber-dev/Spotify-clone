import { useState } from "react";

export type volumeTypeProps = number | null;

function useLocalStorage(key: string, value: volumeTypeProps) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      } else {
        return 1;
      }
      // return item ? JSON.parse(item) : value;
    } catch (error) {
      console.error(error);
      return value;
    }
  });

  const setValue = (value: volumeTypeProps) => {
    try {
      let valueToStore: volumeTypeProps;
      if (value === null || value === 0) {
        valueToStore = storedValue;
      } else {
        valueToStore = value;
      }
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

export default useLocalStorage;