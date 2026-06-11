import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../themes/ThemeProvider';

export const BackgroundVideo: React.FC = () => {
  const { theme } = useTheme();
  const player = useVideoPlayer(theme.video, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // When theme changes, swap source.
  useEffect(() => {
    if (!player) return;
    player.replace(theme.video);
    player.muted = true;
    player.loop = true;
    player.play();
  }, [theme.video, player]);

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
};
