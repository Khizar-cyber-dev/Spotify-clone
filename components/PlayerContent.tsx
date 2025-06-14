"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { BiMenu } from "react-icons/bi";
import useSound from "use-sound";
import { Song } from "@/types";
import usePlayer from "@/hooks/usePlayer";
import MediaItem from "./MediaItem";
import LikeButton from "./LikeButton";
import useLocalStorage from "@/hooks/useLocalStorage";
import useVolume from "@/hooks/useVolume";
import Slider from "./Slider";


interface PlayerContentProps {
  song: Song;
  songUrl: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ song, songUrl }) => {
  const router = useRouter();
  const path = usePathname();
  const player = usePlayer();
  const vol = useVolume();
  const [isPlaying, setIsPlaying] = useState(false);
  const [storedValue, setValue] = useLocalStorage("volume-player", vol.volume);

  useEffect(() => {
    if (storedValue === null) {
      setValue(1);
    }
  }, []);

  useEffect(() => {
    setValue(vol.volume);
  }, [setValue, vol]);

  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = vol.volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  const onPlayNext = () => {
    if (player.ids.length === 0) {
      return;
    }

    const currentIndex = player.ids.findIndex((id) => id === player.activeId);
    const nextSong = player.ids[currentIndex + 1];
    if (!nextSong) {
      return player.setId(player.ids[0]);
    }
    player.setId(nextSong);
  };

  const onPlayPrevious = () => {
    if (player.ids.length === 0) {
      return;
    }

    const currentIndex = player.ids.findIndex((id) => id === player.activeId);
    const previousSong = player.ids[currentIndex - 1];
    if (!previousSong) {
      return player.setId(player.ids[player.ids.length - 1]);
    }
    player.setId(previousSong);
  };

  const [play, { pause, sound }] = useSound(songUrl, {
    volume: vol.volume === null ? storedValue : vol.volume,
    onplay: () => setIsPlaying(true),
    onend: () => {
      setIsPlaying(false);
      onPlayNext();
    },
    onpause: () => setIsPlaying(false),
    format: ["mp3"],
  });

  useEffect(() => {
    sound?.play();
    return () => {
      sound?.unload();
    };
  }, [sound]);

  const handlePlay = () => {
    if (!isPlaying) {
      play();
    } else {
      pause();
    }
  };

  const handleMute = () => {
    if (vol.volume === 0) {
      vol.setVolume(storedValue);
    } else {
      vol.setVolume(0);
    }
  };

  const handleQueue = () => {
    if (path !== "/queue") {
      router.push("/queue");
    } else {
      router.back();
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 h-full">
      <div className="flex w-full justify-start">
        <div className="flex items-center gap-x-4">
          <MediaItem data={song} />
          <LikeButton songId={song.id} />
        </div>
      </div>
      <div className="flex md:hidden col-auto w-full justify-end items-center">
        <div
          onClick={handlePlay}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-white p-1 cursor-pointer"
        >
          <Icon size={30} className="text-black" />
        </div>
      </div>
      <div className="hidden h-full md:flex justify-center items-center w-full max-w-[722px] gap-x-6">
        <AiFillStepBackward
          onClick={onPlayPrevious}
          size={30}
          className="text-neutral-400 cursor-pointer hover:text-white transition"
        />
        <div
          onClick={handlePlay}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-white p-1 cursor-pointer"
        >
          <Icon size={30} className="text-black" />
        </div>
        <AiFillStepForward
          onClick={onPlayNext}
          size={30}
          className="text-neutral-400 cursor-pointer hover:text-white transition"
        />
      </div>
      <div className="hidden md:flex w-full justify-end pr-2">
        <div className="flex items-center gap-x-2 w-[180px]">
          <BiMenu onClick={handleQueue} className="mr-1 cursor-pointer" size={26} title="Queue"/>
          <VolumeIcon onClick={handleMute} size={34} className="cursor-pointer" />
          <Slider value={vol.volume === null ? storedValue : vol.volume} onChange={(value) => vol.setVolume(value)} />
        </div>
      </div>
    </div>
  );
};

export default PlayerContent;